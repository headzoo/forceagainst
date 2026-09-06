import { s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';

export const metadata: Metadata = {
  title: 'About | Force Against Something',
  description: 'Learn about the mission and editorial approach behind Force Against Something.',
  alternates: { canonical: '/about' },
  openGraph: {
    url: '/about',
    title: 'About | Force Against Something',
    description: 'The mission and editorial approach behind Force Against Something.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'About | Force Against Something',
    description: 'The mission and editorial approach behind Force Against Something.',
    images: [],
  },
};

export default function AboutPage() {
  return (
    <main>
      <SiteHeader />

      <section className={s.legalHero}>
        <div className={s.legalHeroHeading}>
          <Link className={s.backLink} href="/">&larr; Back to all actions</Link>
          <p className={s.eyebrow}><span /> ABOUT</p>
          <h1 className={s.legalTitle}>Civic action<br />without a side.</h1>
          <p className={s.legalHeroCopy}>
            Force Against Something exists to make civic action easier to find, compare, and take without asking people to first adopt a single party line.
          </p>
        </div>
        <aside className={s.legalHeroAside}>
          <p className={s.step}>MISSION</p>
          <strong>Find the work. Check the facts. Act.</strong>
          <span>We organize actions around issues, organizations, and public information so people can decide what deserves their time.</span>
        </aside>
      </section>

      <section className={s.legalBody}>
        <nav className={s.legalToc} aria-label="About sections">
          <p className={s.eyebrow}><span /> SECTIONS</p>
          <a href="#mission">Mission</a>
          <a href="#neutrality">Neutrality</a>
          <a href="#listings">Listings</a>
          <a href="#accountability">Accountability</a>
        </nav>

        <article className={s.legalDocument}>
          <section id="mission" className={s.legalSection}>
            <h2>Mission</h2>
            <p>
              Force Against Something is a directory for people who want to respond to the world around them but do not always know where to start. We collect petitions, lawsuits, campaigns, representative contact tools, organization pages, and other public actions in one place so the next useful step is easier to see.
            </p>
            <p>
              Our goal is practical: reduce the friction between caring about an issue and doing something concrete. A good listing should tell you what the action is, who is behind it, where it leads, and why someone might consider it.
            </p>
          </section>

          <section id="neutrality" className={s.legalSection}>
            <h2>Neutrality</h2>
            <p>
              We want the site to remain useful across viewpoints. That means we do not treat a party, ideology, organization, or campaign as automatically correct. We aim to describe actions plainly, separate claims from facts where we can, and avoid turning directory copy into persuasion.
            </p>
            <p>
              Unbiased does not mean careless. We can still reject spam, scams, impersonation, harassment, bad links, misleading submissions, or actions that cannot be represented honestly. The standard is not whether we personally agree with an action; the standard is whether it can be listed clearly and responsibly.
            </p>
          </section>

          <section id="listings" className={s.legalSection}>
            <h2>Listings</h2>
            <p>
              Listings may come from public sources, organization submissions, user suggestions, and our own research. Whenever possible, we point people to the original source so they can review the details before signing, donating, volunteering, contacting an official, or sharing anything further.
            </p>
            <p>
              Civic issues move quickly, and no directory is perfect. We expect entries to need correction, updating, and removal over time. If something looks wrong, outdated, or unfairly described, we want to know.
            </p>
          </section>

          <section id="accountability" className={s.legalSection}>
            <h2>Accountability</h2>
            <p>
              Remaining unbiased is an ongoing practice, not a badge we can award ourselves once. We will keep improving how actions are sourced, labeled, reviewed, and corrected as the site grows.
            </p>
            <p>
              Questions, corrections, and concerns can be sent through the <Link href="/contact">contact page</Link>.
            </p>
          </section>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
