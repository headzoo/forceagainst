'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ActionCardMeta } from '@/app/action-card-meta';
import { LikeButton } from '@/app/action-like-button';
import { cn, s } from '@/app/tailwind-styles';
import { authClient } from '@/lib/auth-client';
import { openSignInDialog } from '@/lib/auth-dialog';
import type { DirectoryAction } from '@/lib/db';

export type ActionListItem = Pick<
  DirectoryAction,
  'id' | 'slug' | 'title' | 'detail' | 'type' | 'urgent' | 'organization' | 'organizationSlug' | 'issueSlug' | 'effort' | 'commentCount'
> & { issue?: string };

type ActionType = DirectoryAction['type'];
type ActionFilter = 'All' | ActionType;

const filters: ActionFilter[] = ['All', 'Petition', 'Lawsuit', 'Campaign'];

function pageNumbers(currentPage: number, totalPages: number) {
  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export function ActionList({
  actions,
  emptyMessage = 'No published actions match this filter yet.',
  includeIssue = false,
  linkMode = 'public',
  paginate = false,
  pageSize = 10,
}: {
  actions: ActionListItem[];
  emptyMessage?: string;
  includeIssue?: boolean;
  linkMode?: 'public' | 'manage';
  paginate?: boolean;
  pageSize?: number;
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<ActionFilter>('All');
  const [page, setPage] = useState(1);
  const [likes, setLikes] = useState<{ userId: string; actionIds: Set<number> } | null>(null);
  const [updatingLikes, setUpdatingLikes] = useState<Set<number>>(new Set());
  const [likeError, setLikeError] = useState('');
  const likedActionIds = likes && likes.userId === userId ? likes.actionIds : new Set<number>();
  const filteredActions = useMemo(
    () => filter === 'All' ? actions : actions.filter((action) => action.type === filter),
    [actions, filter],
  );
  const totalPages = paginate ? Math.max(1, Math.ceil(filteredActions.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleActions = paginate
    ? filteredActions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredActions;
  const numbers = pageNumbers(currentPage, totalPages);
  const firstVisibleAction = filteredActions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleAction = paginate
    ? Math.min(currentPage * pageSize, filteredActions.length)
    : filteredActions.length;

  useEffect(() => {
    if (!userId || linkMode !== 'public') return;

    const controller = new AbortController();
    fetch('/api/likes', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load likes.');
        return await response.json() as { actionIds: number[] };
      })
      .then(({ actionIds }) => setLikes({ userId, actionIds: new Set(actionIds) }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setLikeError(error.message);
      });

    return () => controller.abort();
  }, [linkMode, userId]);

  async function toggleLike(actionId: number) {
    if (!session) {
      openSignInDialog();
      return;
    }
    if (updatingLikes.has(actionId)) return;

    const wasLiked = likedActionIds.has(actionId);
    setLikeError('');
    setLikes((current) => {
      const next = new Set(current?.userId === session.user.id ? current.actionIds : []);
      if (wasLiked) next.delete(actionId);
      else next.add(actionId);
      return { userId: session.user.id, actionIds: next };
    });
    setUpdatingLikes((current) => new Set(current).add(actionId));

    try {
      const response = await fetch('/api/likes', {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not update that like.');
      }
    } catch (error) {
      setLikes((current) => {
        const next = new Set(current?.userId === session.user.id ? current.actionIds : []);
        if (wasLiked) next.add(actionId);
        else next.delete(actionId);
        return { userId: session.user.id, actionIds: next };
      });
      setLikeError(error instanceof Error ? error.message : 'Could not update that like.');
    } finally {
      setUpdatingLikes((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  function selectFilter(nextFilter: ActionFilter) {
    setFilter(nextFilter);
    setPage(1);
  }

  return (
    <div>
      <div className={s.filterRow} role="group" aria-label="Filter actions by type">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => selectFilter(item)}
            className={filter === item ? s.filterActive : undefined}
            aria-pressed={filter === item}
          >
            {item} {item !== 'All' && <sup>{actions.filter((action) => action.type === item).length}</sup>}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {visibleActions.map((action) => {
          const actionHref = linkMode === 'manage'
            ? `/organization/actions/${action.id}`
            : `/a/${action.issueSlug}/${action.slug}`;

          return (
            <article className={s.actionCard} key={action.id}>
              <div className={s.cardMain}>
                <div className={s.actionTitleRow}>
                  {linkMode === 'public' && (
                    <LikeButton
                      actionTitle={action.title}
                      liked={likedActionIds.has(action.id)}
                      disabled={sessionPending || updatingLikes.has(action.id)}
                      onClick={() => toggleLike(action.id)}
                    />
                  )}
                  <h3><Link href={actionHref}>{action.title}</Link></h3>
                </div>
                <p>{action.detail}</p>
                <span className={s.organization}>
                  <span className={s.typePill}>{action.type}</span>
                  {action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>}
                  <span className={s.organizationPrefix}>BY</span>
                  <Link href={`/o/${action.organizationSlug}`}>{action.organization.toUpperCase()}</Link>
                  {includeIssue && action.issue && (
                    <>
                      <span className={s.organizationSeparator}>·</span>
                      <Link href={`/i/${action.issueSlug}`}>{action.issue.toUpperCase()}</Link>
                    </>
                  )}
                </span>
              </div>
              <div className={s.cardAction}>
                <Link href={actionHref} aria-label={linkMode === 'manage' ? `Edit action: ${action.title}` : `Learn more and take action: ${action.title}`}>
                  {linkMode === 'manage' ? 'EDIT ACTION' : 'TAKE ACTION'}
                </Link>
                <ActionCardMeta commentCount={action.commentCount} effort={action.effort} />
              </div>
            </article>
          );
        })}
        {visibleActions.length === 0 && <p className={s.emptyState}>{actions.length === 0 ? emptyMessage : 'No published actions match this filter yet.'}</p>}
        {likeError && <p className={s.likeError} role="alert">{likeError}</p>}
      </div>

      {paginate && filteredActions.length > 0 && (
        <div className={s.actionPaginationShell}>
          <p className={s.actionPaginationSummary}>
            Showing {firstVisibleAction}–{lastVisibleAction} of {filteredActions.length} {filteredActions.length === 1 ? 'action' : 'actions'}
          </p>
          {totalPages > 1 && (
            <nav className={s.actionPagination} aria-label="Actions pagination">
              {currentPage > 1 && (
                <button type="button" className={s.actionPaginationButton} onClick={() => setPage(currentPage - 1)}>
                  ← Previous
                </button>
              )}
              {numbers.map((pageNumber, index) => (
                <Fragment key={pageNumber}>
                  {index > 0 && pageNumber > numbers[index - 1] + 1 && <span className={s.actionPaginationGap} aria-hidden="true">…</span>}
                  {pageNumber === currentPage
                    ? <span className={s.actionPaginationCurrent} aria-current="page">{pageNumber}</span>
                    : <button type="button" className={s.actionPaginationButton} onClick={() => setPage(pageNumber)} aria-label={`Page ${pageNumber}`}>{pageNumber}</button>}
                </Fragment>
              ))}
              {currentPage < totalPages && (
                <button type="button" className={s.actionPaginationButton} onClick={() => setPage(currentPage + 1)}>
                  Next →
                </button>
              )}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
