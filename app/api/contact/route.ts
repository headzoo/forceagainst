import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function redirectToContact(request: Request, params: Record<string, string>) {
  const url = new URL('/contact', request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

function readText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function toSingleLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildMessageText({
  name,
  email,
  topic,
  message,
  referer,
}: {
  name: string;
  email: string;
  topic: string;
  message: string;
  referer: string;
}) {
  return [
    'New contact form submission',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Topic: ${topic}`,
    `Sent: ${new Date().toISOString()}`,
    referer ? `Page: ${referer}` : '',
    '',
    'Message:',
    message,
  ].filter(Boolean).join('\n');
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const website = readText(formData, 'website');

  if (website) return redirectToContact(request, { sent: '1' });

  const name = readText(formData, 'name');
  const email = readText(formData, 'email').toLowerCase();
  const topic = readText(formData, 'topic') || 'General';
  const message = readText(formData, 'message');

  if (name.length < 2 || name.length > 120) {
    return redirectToContact(request, { error: 'name' });
  }

  if (!isValidEmail(email)) {
    return redirectToContact(request, { error: 'email' });
  }

  if (message.length < 10 || message.length > 4000) {
    return redirectToContact(request, { error: 'message' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const contactToEmail = process.env.CONTACT_TO_EMAIL ?? 'contact@forceagainst.com';
  const contactFromEmail = process.env.CONTACT_FROM_EMAIL ?? 'Force Against <contact@forceagainst.com>';

  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured.');
    return redirectToContact(request, { error: 'server' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'force-against/1.0',
      },
      body: JSON.stringify({
        from: contactFromEmail,
        to: [contactToEmail],
        reply_to: email,
        subject: `Force Against contact: ${toSingleLine(topic).slice(0, 80)}`,
        text: buildMessageText({
          name: toSingleLine(name),
          email,
          topic: toSingleLine(topic).slice(0, 80),
          message,
          referer: request.headers.get('referer') ?? '',
        }),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('Resend contact email failed.', response.status, body);
      return redirectToContact(request, { error: 'server' });
    }
  } catch (error) {
    console.error('Resend contact email request failed.', error);
    return redirectToContact(request, { error: 'server' });
  }

  return redirectToContact(request, { sent: '1' });
}
