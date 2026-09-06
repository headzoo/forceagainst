'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LikeButton } from '@/app/action-like-button';
import type { LikedAction } from '@/lib/db';

export function LikedActionsList({ actions: initialActions }: { actions: LikedAction[] }) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  async function unlikeAction(actionId: number) {
    if (updating.has(actionId)) return;

    const removedAction = actions.find((action) => action.id === actionId);
    setError('');
    setActions((current) => current.filter((action) => action.id !== actionId));
    setUpdating((current) => new Set(current).add(actionId));

    try {
      const response = await fetch('/api/likes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not update that like.');
      }
      router.refresh();
    } catch (reason) {
      if (removedAction) {
        setActions((current) => initialActions.filter((candidate) => (
          candidate.id === removedAction.id || current.some((action) => action.id === candidate.id)
        )));
      }
      setError(reason instanceof Error ? reason.message : 'Could not update that like.');
    } finally {
      setUpdating((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  if (actions.length === 0) {
    return (
      <div className={s.likedEmpty}>
        <h2>No likes yet.</h2>
        <p>Tap the heart beside any action to keep it here for later.</p>
      </div>
    );
  }

  return (
    <>
      <div className={s.actionListBordered}>
        {actions.map((action) => (
          <article className={s.actionCard} key={action.id}>
            <div className={s.cardMain}>
              <div className={s.actionTitleRow}>
                <LikeButton
                  actionTitle={action.title}
                  liked
                  disabled={updating.has(action.id)}
                  onClick={() => unlikeAction(action.id)}
                />
                <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
              </div>
              <p>{action.detail}</p>
              <span className={s.organization}>
                <span className={s.typePill}>{action.type}</span>{action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>} <span className={s.organizationPrefix}>BY</span> <Link href={`/o/${action.organizationSlug}`}>{action.organization.toUpperCase()}</Link> <span className={s.organizationSeparator}>·</span> <Link href={`/i/${action.issueSlug}`}>{action.issue.toUpperCase()}</Link>
              </span>
            </div>
            <div className={s.cardAction}><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION</Link><span>{action.effort}</span></div>
          </article>
        ))}
      </div>
      {error && <p className={s.likeError} role="alert">{error}</p>}
    </>
  );
}
