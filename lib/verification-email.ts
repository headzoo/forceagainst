type VerificationEmail = {
  email: string;
  name: string;
  url: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]!);
}

export async function sendVerificationEmail({ email, name, url }: VerificationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL
    ?? process.env.CONTACT_FROM_EMAIL
    ?? 'Force Against <contact@forceagainst.com>';

  if (!apiKey) throw new Error('RESEND_API_KEY is not configured for account verification.');

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'force-against/1.0',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your Force Against account',
      text: `Hi ${name},\n\nVerify your email address to join action-page conversations:\n\n${url}\n\nIf you did not create this account, you can ignore this email.`,
      html: `<p>Hi ${safeName},</p><p>Verify your email address to join action-page conversations.</p><p><a href="${safeUrl}">Verify email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    console.error('Resend verification email failed.', response.status, responseBody);
    throw new Error('Verification email could not be sent.');
  }
}
