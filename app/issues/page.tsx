import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { s } from '@/app/tailwind-styles';
import { getIssueDirectory } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Issues | Force Against',
  description: 'Browse the issues covered by Force Against and find ways to take action.',
  path: '/issues',
});

export default async function IssuesPage() {
  const issues = await getIssueDirectory();

  return (
    <main>
      <SiteHeader />

      <section className={s.likedHero}>
        <div className={s.likedHeading}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">All actions</Link></li>
              <li aria-current="page"><span>Issues</span></li>
            </ol>
          </nav>
          <p className={s.eyebrow}><span /> ISSUE DIRECTORY</p>
          <h1 className={s.orgDirectoryTitle}>Issues.</h1>
          <p className={s.likedHeadingCopy}>Choose the issue you care about, understand what is at stake, and find direct ways to help.</p>
        </div>
        <aside className={s.likedSummary}>
          <p className={s.step}>ISSUES</p>
          <strong>{String(issues.length).padStart(2, '0')}</strong>
          <span>{issues.length === 1 ? 'issue in the directory.' : 'issues in the directory.'}</span>
        </aside>
      </section>

      <section className={s.orgDirectorySection} aria-labelledby="issues-heading">
        <div className={s.sectionHeading}>
          <div>
            <p className={s.eyebrow}><span /> PICK YOUR FOCUS</p>
            <h2 id="issues-heading">All issues.</h2>
          </div>
          <p>Each issue page brings together essential context and every published action in that area.</p>
        </div>
        <div className={s.orgDirectoryList}>
          {issues.map((issue) => (
            <article className={s.actionCard} key={issue.id}>
              <div className={s.cardMain}>
                <h3>{issue.name}</h3>
                <p>{issue.detail || `Find ways to take action on ${issue.name}.`}</p>
              </div>
              <div className={s.cardAction}>
                <Link href={`/i/${issue.slug}`} aria-label={`View issue: ${issue.name}`}>VIEW ISSUE</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
