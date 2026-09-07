import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ActionComments } from '@/app/action-comments';
import { ActionLikeButton } from '@/app/action-like-button';
import { ActionGovernmentWriter } from '@/app/government/action-government-writer';
import { OpenGraphPreview } from '@/app/open-graph-preview';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getActionCommentBanScopes, getActionCommentModerationAccess } from '@/lib/comment-moderation';
import { getActionComments, getPublishedActionBySlugs } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { createSiteMetadata, summarizeForMetadata } from '@/lib/site-metadata';

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
  if (!action) return createSiteMetadata({
    title: 'Action not found | Force Against Something',
    description: 'The requested action could not be found on Force Against Something.',
    path: '/',
  });

  const url = `/a/${action.issueSlug}/${action.slug}`;
  const description = summarizeForMetadata(
    action.detail || action.description,
    `Learn how to take action with ${action.organization}.`,
  );
  return createSiteMetadata({
    title: `${action.title} | Force Against Something`,
    description,
    path: url,
    image: action.openGraph?.image,
    imageAlt: action.openGraph?.imageAlt,
  });
}

export default async function ActionPage({ params }: ActionPageProps) {
  const action = await findAction(params);
  if (!action) notFound();
  const session = await getMemberSession();
  const [comments, moderationAccess] = await Promise.all([
    getActionComments(action.id, session?.user.id ?? null),
    session ? getActionCommentModerationAccess(action.id, session.user.id) : Promise.resolve(null),
  ]);
  const commentModeration = moderationAccess?.canModerate ? {
    canBanOrganization: moderationAccess.canBanOrganization,
    organizationName: moderationAccess.organizationName,
    bannedUsers: await getActionCommentBanScopes(action.id, moderationAccess.organizationId),
  } : null;
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
          {action.openGraph
            ? <OpenGraphPreview href={action.href} openGraph={action.openGraph} />
            : <>
              <h2>Make your<br />move.</h2>
              <p>You’ll continue on <Link className={s.organizationInlineLink} href={`/o/${action.organizationSlug}`}>{action.organization}</Link>’s website.</p>
            </>}
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
          <ActionGovernmentWriter actionTitle={action.title} />
        </div>
        <article className={s.descriptionContent}>
          <p className={s.eyebrow}><span /> THE ACTION</p>
          <div className={s.markdownContent}>
            {action.description ? <Markdown remarkPlugins={[remarkGfm]}>{action.description}</Markdown> : <p>{action.detail}</p>}
            <a className={cn(s.primaryButton, s.actionDescriptionButton)} href={action.href} target="_blank" rel="noreferrer">TAKE ACTION <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </section>

      <ActionComments actionId={action.id} initialComments={comments} commentsLocked={action.commentsLocked} slowModeSeconds={action.commentSlowModeSeconds} moderation={commentModeration} />

      <section className={s.trustBand}><div className={s.trustMark} aria-hidden="true"><span>✓</span></div><div><p className={s.eyebrowLight}><span /> OUR STANDARD</p><h2>Curated for action,<br />not attention.</h2></div><p>We prioritize credible organizations, active efforts, transparent asks, and direct links. No outrage bait. No pay-to-play placement. Just useful ways to help.</p></section>
      <SiteFooter />
    </main>
  );
}
