import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getUserComments } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Your comments | Force Against',
  description: 'The comments you have written on Force Against.',
  path: '/comments',
});

type CommentsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function readPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function formatCommentDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function pageNumbers(currentPage: number, totalPages: number) {
  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export default async function CommentsPage({ searchParams }: CommentsPageProps) {
  const session = await getMemberSession();
  const requestedPage = readPage((await searchParams).page);
  const history = session ? await getUserComments(session.user.id, requestedPage) : null;
  const numbers = history ? pageNumbers(history.page, history.totalPages) : [];

  return (
    <main>
      <SiteHeader />

      <section className={s.likedHero}>
        <div className={s.likedHeading}>
          <Link className={cn(s.backLink, s.likedBackLink)} href="/">← Back to all actions</Link>
          <p className={s.eyebrow}><span /> YOUR CONVERSATIONS</p>
          <h1 className={s.commentsTitle}>Comments.</h1>
          <p className={s.likedHeadingCopy}>Revisit what you shared and jump back into the action where the conversation started.</p>
        </div>
        <aside className={s.likedSummary}>
          <p className={s.step}>YOUR CONTRIBUTIONS</p>
          <strong>{String(history?.total ?? 0).padStart(2, '0')}</strong>
          <span>{history?.total === 1 ? 'comment you have written.' : 'comments you have written.'}</span>
        </aside>
      </section>

      <section className={s.commentsPageSection} aria-label="Your comments">
        {!session ? (
          <div className={s.likedEmpty}>
            <h2>Sign in to see your comments.</h2>
            <p>Use the sign-in button above, then the comments you write will appear here.</p>
          </div>
        ) : history?.comments.length === 0 ? (
          <div className={s.likedEmpty}>
            <h2>No comments yet.</h2>
            <p>Join a conversation on any action and your comments will appear here.</p>
          </div>
        ) : history ? (
          <>
            <ol className={s.commentsPageList} start={(history.page - 1) * history.pageSize + 1}>
              {history.comments.map((comment) => {
                const href = `/a/${comment.issueSlug}/${comment.actionSlug}#comment-${comment.id}`;
                return (
                  <li key={comment.id}>
                    <article className={s.commentHistoryCard}>
                      <div className={s.commentHistoryCopy}>
                        <header className={s.commentHistoryMeta}>
                          <Link href={href}>{comment.actionTitle}</Link>
                          <time dateTime={comment.createdAt.toISOString()}>{formatCommentDate(comment.createdAt)}</time>
                        </header>
                        {comment.deletedAt
                          ? <p className={s.commentHistoryDeleted}>This comment has been deleted.</p>
                          : <p>{comment.body}</p>}
                      </div>
                      <Link className={s.commentHistoryLink} href={href}>Open comment <span aria-hidden="true">→</span></Link>
                    </article>
                  </li>
                );
              })}
            </ol>

            {history.totalPages > 1 && (
              <nav className={s.commentsPagination} aria-label="Comments pagination">
                {history.page > 1 && <Link className={s.commentsPaginationLink} href={`/comments?page=${history.page - 1}`} rel="prev">← Previous</Link>}
                {numbers.map((page, index) => (
                  <Fragment key={page}>
                    {index > 0 && page > numbers[index - 1] + 1 && <span className={s.commentsPaginationGap} aria-hidden="true">…</span>}
                    {page === history.page
                      ? <span className={s.commentsPaginationCurrent} aria-current="page">{page}</span>
                      : <Link className={s.commentsPaginationLink} href={`/comments?page=${page}`} aria-label={`Page ${page}`}>{page}</Link>}
                  </Fragment>
                ))}
                {history.page < history.totalPages && <Link className={s.commentsPaginationLink} href={`/comments?page=${history.page + 1}`} rel="next">Next →</Link>}
              </nav>
            )}
          </>
        ) : null}
      </section>

      <SiteFooter />
    </main>
  );
}
