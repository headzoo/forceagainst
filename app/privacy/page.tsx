import { s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';

export const metadata: Metadata = {
  title: 'Privacy Policy | Force Against Something',
  description: 'Read how Force Against Something collects, uses, and protects information.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    url: '/privacy',
    title: 'Privacy Policy | Force Against Something',
    description: 'How Force Against Something collects, uses, and protects information.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Force Against Something',
    description: 'How Force Against Something collects, uses, and protects information.',
    images: [],
  },
};

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />

      <section className={s.legalHero}>
        <div className={s.legalHeroHeading}>
          <Link className={s.backLink} href="/">&larr; Back to all actions</Link>
          <p className={s.eyebrow}><span /> PRIVACY POLICY</p>
          <h1 className={s.legalTitle}>Privacy for<br />civic action.</h1>
          <p className={s.legalHeroCopy}>This policy explains what information Force Against Something collects, why we use it, and the choices available to you.</p>
        </div>
        <aside className={s.legalHeroAside}>
          <p className={s.step}>EFFECTIVE DATE</p>
          <strong>September 6, 2026</strong>
          <span>Questions about privacy can be sent through the contact page.</span>
        </aside>
      </section>

      <section className={s.legalBody}>
        <nav className={s.legalToc} aria-label="Privacy sections">
          <p className={s.eyebrow}><span /> SECTIONS</p>
          <a href="#scope">Scope</a>
          <a href="#information">Information</a>
          <a href="#use">Use</a>
          <a href="#sharing">Sharing</a>
          <a href="#cookies">Cookies</a>
          <a href="#retention">Retention</a>
          <a href="#choices">Choices</a>
          <a href="#contact">Contact</a>
        </nav>

        <article className={s.legalDocument}>
          <section id="scope" className={s.legalSection}>
            <h2>Scope</h2>
            <p>This policy applies to Force Against Something and the public tools we operate from this site. It does not apply to third-party campaigns, organizations, government sites, payment processors, social platforms, or other sites we link to.</p>
          </section>

          <section id="information" className={s.legalSection}>
            <h2>Information We Collect</h2>
            <p>We collect information you provide directly, including account name, email address, password credentials, organization details, action submissions, contact form messages, and any other content you choose to send.</p>
            <p>When you use account features, we may store session information, liked actions, submitted actions, organization ownership, IP address, user agent, and timestamps needed to operate and secure the service.</p>
            <p>When you use site features, we may process search queries, action URLs submitted for review, representative lookup input, and similar request details. Contact form submissions are sent to our email service provider so we can receive and respond to them.</p>
            <p>We also collect limited technical and usage information through hosting logs, analytics, and performance tools, such as pages visited, device or browser details, referral information, approximate location derived from network data, and error or performance events.</p>
          </section>

          <section id="use" className={s.legalSection}>
            <h2>How We Use Information</h2>
            <p>We use information to provide the site, authenticate users, maintain accounts, save liked actions, review and publish submitted actions, manage organization profiles, respond to messages, monitor security, prevent abuse, fix errors, understand site performance, and improve the directory.</p>
            <p>We may use published action and organization content to operate public pages, search, JSON endpoints, MCP tools, and related public access features.</p>
          </section>

          <section id="sharing" className={s.legalSection}>
            <h2>How We Share Information</h2>
            <p>We do not sell personal information. We share information with service providers that help us operate the site, such as hosting, database, authentication, analytics, performance, email, and security providers.</p>
            <p>Published organization profiles and action listings are public. They may be viewed, indexed, copied, or accessed through public APIs and tools. If your account is associated with a submitted action, admins may see your name and email while reviewing it.</p>
            <p>We may disclose information when required by law, to protect rights and safety, to investigate abuse, or as part of a merger, acquisition, financing, or transfer of site operations.</p>
          </section>

          <section id="cookies" className={s.legalSection}>
            <h2>Cookies and Similar Technologies</h2>
            <p>We use cookies and similar technologies to keep you signed in, protect the site, remember account state, measure traffic, and understand performance. You can control cookies through your browser settings, but blocking them may prevent account features from working.</p>
          </section>

          <section id="retention" className={s.legalSection}>
            <h2>Retention and Security</h2>
            <p>We keep information for as long as needed to provide the site, comply with legal obligations, resolve disputes, enforce terms, prevent abuse, and maintain accurate public records. Public submissions may remain visible after an account is closed unless removed at our discretion or required by law.</p>
            <p>We use reasonable technical and organizational safeguards, but no internet service can guarantee absolute security.</p>
          </section>

          <section id="choices" className={s.legalSection}>
            <h2>Your Choices</h2>
            <p>You can choose not to create an account, can stop using account features, and can control cookies in your browser. You may request access, correction, deletion, or other privacy help by contacting us. We may need to verify your request before acting on it.</p>
            <p>The site is intended for a general audience and is not directed to children under 13.</p>
          </section>

          <section id="contact" className={s.legalSection}>
            <h2>Contact</h2>
            <p>Questions or privacy requests can be sent through the <Link href="/contact">contact page</Link>.</p>
          </section>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
