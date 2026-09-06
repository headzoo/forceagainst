import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ActionComments } from '@/app/action-comments';
import { ActionLikeButton } from '@/app/action-like-button';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getActionComments, getPublishedActionBySlugs } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

export const dynamic = 'force-dynamic';

type ActionPageProps = { params: Promise<{ id: string; actionSlug: string }> };

const typeDescriptions = {
  Petition: 'Add your name to a public ask or message campaign.',
  Lawsuit: 'Support legal action or advocacy tied to a court case.',
  Campaign: 'Join organized pressure, volunteering, or ongoing outreach.',
};

function formatCreatedDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(date);
}

function splitTitleEnding(title: string) {
  const trimmedTitle = title.trim();
  const finalSpaceIndex = trimmedTitle.lastIndexOf(' ');

  if (finalSpaceIndex === -1) {
    return { titleStart: '', titleEnd: trimmedTitle };
  }

  return {
    titleStart: trimmedTitle.slice(0, finalSpaceIndex + 1),
    titleEnd: trimmedTitle.slice(finalSpaceIndex + 1),
  };
}

async function findAction(params: ActionPageProps['params']) {
  const { id: issueSlug, actionSlug } = await params;
  return getPublishedActionBySlugs(issueSlug, actionSlug);
}

export async function generateMetadata({ params }: ActionPageProps): Promise<Metadata> {
  const action = await findAction(params);
  if (!action) return { title: 'Action not found' };

  const url = `/a/${action.issueSlug}/${action.slug}`;
  return {
    title: `${action.title} | Force Against Something`,
    description: action.detail,
    alternates: { canonical: url },
    openGraph: { url, title: action.title, description: action.detail, images: [] },
    twitter: { card: 'summary', title: action.title, description: action.detail, images: [] },
  };
}

export default async function ActionPage({ params }: ActionPageProps) {
  const action = await findAction(params);
  if (!action) notFound();
  const session = await getMemberSession();
  const comments = await getActionComments(action.id, session?.user.id ?? null);
  const createdDate = formatCreatedDate(action.createdAt);
  const { titleStart, titleEnd } = splitTitleEnding(action.title);

  return (
    <main>
      <SiteHeader />

      <section className={s.actionDetailHero}>
        <div className={s.actionDetailHeading}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">All actions</Link></li>
              <li><Link href={`/i/${action.issueSlug}`}>{action.issue}</Link></li>
              <li aria-current="page"><span>{action.title}</span></li>
            </ol>
          </nav>
          <div className={s.actionDetailBadges}>
            <ActionLikeButton actionId={action.id} actionTitle={action.title} />
            <span className={s.actionDetailPillRow}>
              <span className={s.typePill}>{action.type}</span>
              {action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>}
            </span>
          </div>
          <h1 className={s.actionDetailTitle}>
            {titleStart}<span className={s.actionDetailTitleEnding}>{titleEnd}<Image className={s.actionDetailTitleStar} src="/action-detail-title-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span>
          </h1>
          <p className={s.actionDetailSummary}>{action.detail}</p>
          <span className={s.organization}>BY <Link href={`/o/${action.organizationSlug}`}>{action.organization.toUpperCase()}</Link></span>
        </div>
        <aside className={s.actionDetailCta}>
          <p className={s.step}>READY TO HELP?</p>
          <h2>Make your<br />move.</h2>
          <p>You’ll continue on <Link className={s.organizationInlineLink} href={`/o/${action.organizationSlug}`}>{action.organization}</Link>’s website.</p>
          <a className={s.primaryButton} href={action.href} target="_blank" rel="noreferrer">TAKE ACTION <span aria-hidden="true">↗</span></a>
          <small>{action.effort}</small>
        </aside>
      </section>

      <section className={s.actionDescriptionShell}>
        <div>
          <p className={s.eyebrow}><span /> THE DETAILS</p>
          <ul className={s.actionDetailsList}>
            <li><small>Org</small><div><Link href={`/o/${action.organizationSlug}`}>{action.organization}</Link></div></li>
            <li><small>Link</small><div><a className={s.actionDetailsUrl} href={action.href} target="_blank" rel="noreferrer">{action.href}</a></div></li>
            <li><small>Type</small><div>{action.type}</div><p>{typeDescriptions[action.type]}</p></li>
            <li><small>Created</small><div>{createdDate}</div></li>
          </ul>
        </div>
        <article className={s.markdownContent}>
          {action.description ? <Markdown remarkPlugins={[remarkGfm]}>{action.description}</Markdown> : <p>{action.detail}</p>}
          <a className={cn(s.primaryButton, s.actionDescriptionButton)} href={action.href} target="_blank" rel="noreferrer">TAKE ACTION <span aria-hidden="true">↗</span></a>
        </article>
      </section>

      <ActionComments actionId={action.id} initialComments={comments} commentsLocked={action.commentsLocked} slowModeSeconds={action.commentSlowModeSeconds} />

      <SiteFooter />
    </main>
  );
}
