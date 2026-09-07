import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { createSiteMetadata } from '@/lib/site-metadata';
import { ContactForm } from './contact-form';

export const metadata: Metadata = createSiteMetadata({
  title: 'Contact | Force Against',
  description: 'Contact Force Against with questions, corrections, and partnership notes.',
  path: '/contact',
});

type ContactPageProps = {
  searchParams?: Promise<{ sent?: string; error?: string }>;
};

const errorMessages: Record<string, string> = {
  name: 'Enter your name.',
  email: 'Enter a valid email address.',
  message: 'Write a message between 10 and 4,000 characters.',
  server: 'The message could not be sent. Please try again in a minute.',
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const sent = params?.sent === '1';
  const error = params?.error ? errorMessages[params.error] ?? errorMessages.server : '';

  return (
    <main>
      <SiteHeader />
      {sent && (
        <div className={cn(s.contactToast, s.contactToastSuccess)} role="status" aria-live="polite">
          <strong>Message sent.</strong>
          <span>Thanks for reaching out. We’ll read it shortly.</span>
        </div>
      )}
      {error && (
        <div className={cn(s.contactToast, s.contactToastError)} role="alert">
          <strong>Message not sent.</strong>
          <span>{error}</span>
        </div>
      )}

      <section className={s.contactShell}>
        <div className={s.contactHeading}>
          <Link className={s.backLink} href="/">← Back to all actions</Link>
          <p className={s.eyebrow}><span /> CONTACT</p>
          <h1 className={s.contactTitle}>Get in touch.</h1>
          <p className={s.contactHeadingCopy}>Send corrections, questions, partnership notes, or anything else that should reach the people behind Force Against.</p>
        </div>

        <div className={s.contactPanel}>
          <ContactForm sent={sent} error={error} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
