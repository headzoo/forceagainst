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
  }));

  return (
    <main className="issue-detail-page">
      <SiteHeader />

      <section className="org-detail-hero">
        <div className="org-detail-heading">
          <Link className="back-link" href="/">← Back to all actions</Link>
          <p className="eyebrow"><span /> ISSUE</p>
          <h1>{issue.name}</h1>
          {issue.detail && <p className="issue-detail-summary">{issue.detail}</p>}
        </div>
        <aside className="action-detail-cta">
          <p className="step">WAYS TO ACT</p>
          <h2>{String(issue.actions.length).padStart(2, '0')}<br />{issue.actions.length === 1 ? 'action.' : 'actions.'}</h2>
          <p>Published and ready for you to make a difference.</p>
          <a className="primary-button" href="#issue-actions">BROWSE ACTIONS <span aria-hidden="true">↓</span></a>
        </aside>
      </section>

      {issue.description && (
        <section className="org-description-shell">
          <div className="action-description-label"><p className="eyebrow"><span /> WHY IT MATTERS</p><p>{issue.name}</p></div>
          <article className="markdown-content"><Markdown remarkPlugins={[remarkGfm]}>{issue.description}</Markdown></article>
        </section>
      )}

      <section className="org-actions-section" id="issue-actions">
        <div className="section-heading">
          <div><p className="eyebrow"><span /> MAKE YOUR MOVE</p><h2 className="issue-page-action-heading">Take <span className="heading-end-lockup">action<Image className="heading-end-star" src="/issue-page-take-action-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span></h2></div>
          <p>Every listing gives you the context, organization, and direct path you need to make a difference on {issue.name}.</p>
        </div>
        <IssueActionsList actions={actions} />
      </section>

      <SiteFooter />
    </main>
  );
}
