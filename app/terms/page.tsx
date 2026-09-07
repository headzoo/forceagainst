import { s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { createSiteMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createSiteMetadata({
  title: 'Terms of Use | Force Against',
  description: 'Read the terms that govern use of Force Against.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <main>
      <SiteHeader />

      <section className={s.legalHero}>
        <div className={s.legalHeroHeading}>
          <Link className={s.backLink} href="/">&larr; Back to all actions</Link>
          <p className={s.eyebrow}><span /> TERMS OF USE</p>
          <h1 className={s.legalTitle}>Use the site<br />with care.</h1>
          <p className={s.legalHeroCopy}>These terms explain the rules for using Force Against and submitting action listings.</p>
        </div>
        <aside className={s.legalHeroAside}>
          <p className={s.step}>EFFECTIVE DATE</p>
          <strong>September 6, 2026</strong>
          <span>Questions about these terms can be sent through the contact page.</span>
        </aside>
      </section>

      <section className={s.legalBody}>
        <nav className={s.legalToc} aria-label="Terms sections">
          <p className={s.eyebrow}><span /> SECTIONS</p>
          <a href="#acceptance">Acceptance</a>
          <a href="#service">The service</a>
          <a href="#accounts">Accounts</a>
          <a href="#submissions">Submissions</a>
          <a href="#rules">Rules</a>
          <a href="#third-parties">Third parties</a>
          <a href="#disclaimers">Disclaimers</a>
          <a href="#contact">Contact</a>
        </nav>

        <article className={s.legalDocument}>
          <section id="acceptance" className={s.legalSection}>
            <h2>Acceptance</h2>
            <p>By accessing or using Force Against, you agree to these terms. If you do not agree, do not use the site.</p>
            <p>We may update these terms from time to time. The updated version applies when it is posted, unless a later effective date is stated.</p>
          </section>

          <section id="service" className={s.legalSection}>
            <h2>The Service</h2>
            <p>Force Against is a directory of civic actions, organizations, public government information, and related tools. We help people find petitions, lawsuits, campaigns, representative contact information, and other ways to act.</p>
            <p>We do not run, sponsor, or control the third-party actions listed on the site unless we say so plainly. Listings can become outdated, and you are responsible for reviewing the destination site before signing, donating, volunteering, contacting an official, or taking any other action.</p>
            <p>Nothing on the site is legal, financial, medical, political, or professional advice.</p>
          </section>

          <section id="accounts" className={s.legalSection}>
            <h2>Accounts</h2>
            <p>You may need an account to like actions, create an organization profile, submit actions, or use member-only features. You agree to provide accurate information and to keep your login credentials secure.</p>
            <p>You are responsible for activity under your account. Tell us promptly if you believe your account has been accessed without permission.</p>
          </section>

          <section id="submissions" className={s.legalSection}>
            <h2>Submissions</h2>
            <p>When you create an organization profile or submit an action, you are responsible for the content you provide and for having the rights needed to share it. Submitted actions are reviewed before publication, and we may edit, reject, unpublish, or remove submissions at our discretion.</p>
            <p>You grant us a non-exclusive, worldwide, royalty-free license to host, copy, display, distribute, modify, and otherwise use submitted content for operating, improving, and promoting the site. Published directory data may also be made available through public pages, feeds, JSON endpoints, MCP tools, search engines, and similar access methods.</p>
          </section>

          <section id="rules" className={s.legalSection}>
            <h2>Rules</h2>
            <p>Do not use the site to post false or misleading content, impersonate another person or organization, violate the rights of others, harass or threaten anyone, distribute malware, bypass security controls, interfere with site operation, or use automated requests in a way that burdens the service.</p>
            <p>We may limit, suspend, or terminate access, remove content, or take other reasonable steps if we believe these terms have been violated or if action is needed to protect the site, users, or the public.</p>
          </section>

          <section id="third-parties" className={s.legalSection}>
            <h2>Third Parties</h2>
            <p>The site links to organizations, campaigns, government offices, and other third parties. Their sites, actions, forms, donation pages, subscriptions, and communications are governed by their own terms and policies.</p>
            <p>We are not responsible for third-party content, availability, security, data practices, payments, or outcomes.</p>
          </section>

          <section id="disclaimers" className={s.legalSection}>
            <h2>Disclaimers and Liability</h2>
            <p>The site is provided &quot;as is&quot; and &quot;as available.&quot; We do not promise that the site will be uninterrupted, error-free, complete, current, secure, or suitable for any particular purpose.</p>
            <p>To the fullest extent allowed by law, Force Against and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, or loss of goodwill arising from use of the site.</p>
          </section>

          <section id="contact" className={s.legalSection}>
            <h2>Contact</h2>
            <p>Questions about these terms can be sent through the <Link href="/contact">contact page</Link>.</p>
          </section>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
