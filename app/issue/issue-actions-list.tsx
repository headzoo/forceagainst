'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LikeButton } from '@/app/action-like-button';
import { ActionCardMeta } from '@/app/action-card-meta';
import { authClient } from '@/lib/auth-client';
import type { DirectoryAction } from '@/lib/db';

type IssueActionCard = Pick<
  DirectoryAction,
  'id' | 'slug' | 'title' | 'detail' | 'type' | 'urgent' | 'organization' | 'organizationSlug' | 'issueSlug' | 'effort' | 'commentCount'
>;

export function IssueActionsList({ actions }: { actions: IssueActionCard[] }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [likes, setLikes] = useState<{ userId: string; actionIds: Set<number> } | null>(null);
  const [updatingLikes, setUpdatingLikes] = useState<Set<number>>(new Set());
  const [likeError, setLikeError] = useState('');
  const likedActionIds = likes && likes.userId === userId ? likes.actionIds : new Set<number>();

  useEffect(() => {
    if (!userId) return;

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
  }, [userId]);

  async function toggleLike(actionId: number) {
    if (!session || updatingLikes.has(actionId)) return;

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

  return (
    <div>
      {actions.map((action) => (
        <article className={s.actionCard} key={action.id}>
          <div className={s.cardMain}>
            <div className={s.actionTitleRow}>
              {session && (
                <LikeButton
                  actionTitle={action.title}
                  liked={likedActionIds.has(action.id)}
                  disabled={updatingLikes.has(action.id)}
                  onClick={() => toggleLike(action.id)}
                />
              )}
              <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
            </div>
            <p>{action.detail}</p>
            <span className={s.organization}>
              <span className={s.typePill}>{action.type}</span>{action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>} <span className={s.organizationPrefix}>BY</span> <Link href={`/o/${action.organizationSlug}`}>{action.organization.toUpperCase()}</Link>
            </span>
          </div>
          <div className={s.cardAction}><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION</Link><ActionCardMeta commentCount={action.commentCount} effort={action.effort} /></div>
        </article>
      ))}
      {actions.length === 0 && <p className={s.emptyState}>No published actions for this issue yet.</p>}
      {likeError && <p className={s.likeError} role="alert">{likeError}</p>}
    </div>
  );
}
