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
import { IssueActionsList } from '../issue-actions-list';

export const dynamic = 'force-dynamic';

type IssuePageProps = { params: Promise<{ slug: string }> };

async function findIssue(params: IssuePageProps['params']) {
  const { slug } = await params;
  return getPublishedIssue(slug);
}

export async function generateMetadata({ params }: IssuePageProps): Promise<Metadata> {
  const issue = await findIssue(params);
  if (!issue) return { title: 'Issue not found' };

  const description = issue.detail || `Find ways to take action on ${issue.name}.`;
  const url = `/i/${issue.slug}`;
  return {
    title: `${issue.name} | Force Against Something`,
    description,
    alternates: { canonical: url },
    openGraph: { url, title: issue.name, description, images: [] },
    twitter: { card: 'summary', title: issue.name, description, images: [] },
  };
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
          <Link className={s.backLink} href="/">← Back to all actions</Link>
          <p className={cn(s.eyebrow, s.orgHeadingEyebrow)}><span /> ISSUE</p>
          <h1 className={s.orgDetailTitle}>{issue.name}</h1>
          {issue.detail && <p className={s.issueDetailSummary}>{issue.detail}</p>}
        </div>
        <aside className={s.actionDetailCta}>
          <p className={s.step}>WAYS TO ACT</p>
          <h2>{String(issue.actions.length).padStart(2, '0')}<br />{issue.actions.length === 1 ? 'action.' : 'actions.'}</h2>
          <p>Published and ready for you to make a difference.</p>
          <a className={s.primaryButton} href="#issue-actions">BROWSE ACTIONS <span aria-hidden="true">↓</span></a>
        </aside>
      </section>

      {issue.description && (
        <section className={s.orgDescriptionShell}>
          <div><p className={s.eyebrow}><span /> WHY IT MATTERS</p><p>{issue.name}</p></div>
          <article className={s.markdownContent}><Markdown remarkPlugins={[remarkGfm]}>{issue.description}</Markdown></article>
        </section>
      )}

      <section className={s.orgActionsSection} id="issue-actions">
        <div className={s.sectionHeading}>
          <div><p className={s.eyebrow}><span /> MAKE YOUR MOVE</p><h2 className={s.issuePageActionHeading}>Take <span className={s.headingEndLockup}>action<Image className={s.headingEndStar} src="/issue-page-take-action-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span></h2></div>
          <p>Every listing gives you the context, organization, and direct path you need to make a difference on {issue.name}.</p>
        </div>
        <IssueActionsList actions={actions} />
      </section>

      <SiteFooter />
    </main>
  );
}
