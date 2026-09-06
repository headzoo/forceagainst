import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getPublishedIssue } from '@/lib/db';
import { createSiteMetadata, summarizeForMetadata } from '@/lib/site-metadata';
import { IssueActionsList } from '../issue-actions-list';

export const dynamic = 'force-dynamic';

type IssuePageProps = { params: Promise<{ slug: string }> };

async function findIssue(params: IssuePageProps['params']) {
  const { slug } = await params;
  return getPublishedIssue(slug);
}

export async function generateMetadata({ params }: IssuePageProps): Promise<Metadata> {
  const issue = await findIssue(params);
  if (!issue) return createSiteMetadata({
    title: 'Issue not found | Force Against Something',
    description: 'The requested issue could not be found on Force Against Something.',
    path: '/issues',
  });

  const description = summarizeForMetadata(
    issue.detail || issue.description,
    `Learn about ${issue.name} and find verified ways to take action.`,
  );
  const url = `/i/${issue.slug}`;
  return createSiteMetadata({
    title: `${issue.name} | Force Against Something`,
    description,
    path: url,
  });
}

export default async function IssuePage({ params }: IssuePageProps) {
  const issue = await findIssue(params);
  if (!issue) notFound();
  const actions = issue.actions.map((action) => ({
    id: action.id,
    slug: action.slug,
    title: action.title,
    detail: action.detail,
    type: action.type,
    urgent: action.urgent,
    organization: action.organization,
    organizationSlug: action.organizationSlug,
    issueSlug: action.issueSlug,
    effort: action.effort,
    commentCount: action.commentCount,
  }));

  return (
    <main>
      <SiteHeader />

      <section className={s.orgDetailHero}>
        <div className={s.orgDetailHeading}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">All actions</Link></li>
              <li><Link href="/issues">Issues</Link></li>
              <li aria-current="page"><span>{issue.name}</span></li>
            </ol>
          </nav>
          <p className={cn(s.eyebrow, s.orgHeadingEyebrow)}><span /> ISSUE</p>
          <h1 className={s.orgDetailTitle}>{issue.name}</h1>
          {issue.detail && <p className={s.issueDetailSummary}>{issue.detail}</p>}
        </div>
        <aside className={s.actionDetailCta}>
          <p className={s.step}>ACTIONS / {String(issue.actions.length).padStart(2, '0')}</p>
          <a className={s.primaryButton} href="#issue-actions">BROWSE ACTIONS <span aria-hidden="true">↓</span></a>
        </aside>
      </section>

      {(issue.description || issue.sidebar) && (
        <section className={s.orgDescriptionShell}>
          <div>
            <p className={s.eyebrow}><span /> DO YOUR PART</p>
            {issue.sidebar && <div className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{issue.sidebar}</Markdown></div>}
          </div>
          <article className={s.descriptionContent}>
            <p className={s.eyebrow}><span /> THE ISSUE</p>
            {issue.description && <div className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{issue.description}</Markdown></div>}
          </article>
        </section>
      )}

      <section className={s.orgActionsSection} id="issue-actions">
        <div className={s.sectionHeading}>
          <div><p className={s.eyebrow}><span /> MAKE YOUR MOVE</p><h2 className={s.issuePageActionHeading}>Take <span className={s.headingEndLockup}>action<Image className={s.headingEndStar} src="/issue-page-take-action-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span></h2></div>
        </div>
        <IssueActionsList actions={actions} />
      </section>

      <SiteFooter />
    </main>
  );
}
