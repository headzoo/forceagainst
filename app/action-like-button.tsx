'use client';

import { cn, s } from '@/app/tailwind-styles';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

type LikeButtonProps = {
  actionTitle: string;
  liked: boolean;
  disabled: boolean;
  onClick: () => void;
};

export function LikeButton({ actionTitle, liked, disabled, onClick }: LikeButtonProps) {
  return (
    <button
      className={cn(s.likeButton, liked && s.likeButtonLiked)}
      type="button"
      aria-label={`${liked ? 'Unlike' : 'Like'} ${actionTitle}`}
      aria-pressed={liked}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>
    </button>
  );
}

export function ActionLikeButton({ actionId, actionTitle }: { actionId: number; actionTitle: string }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const [like, setLike] = useState<{ userId: string; liked: boolean } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const liked = like && like.userId === userId ? like.liked : false;

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    fetch('/api/likes', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load likes.');
        return await response.json() as { actionIds: number[] };
      })
      .then(({ actionIds }) => setLike({ userId, liked: actionIds.includes(actionId) }))
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== 'AbortError') setError(reason.message);
      });

    return () => controller.abort();
  }, [actionId, userId]);

  async function toggleLike() {
    if (!session || updating) return;

    const wasLiked = liked;
    setError('');
    setLike({ userId: session.user.id, liked: !wasLiked });
    setUpdating(true);

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
    } catch (reason) {
      setLike({ userId: session.user.id, liked: wasLiked });
      setError(reason instanceof Error ? reason.message : 'Could not update that like.');
    } finally {
      setUpdating(false);
    }
  }

  if (!session) return null;

  return (
    <div className={s.actionDetailLike}>
      <LikeButton
        actionTitle={actionTitle}
        liked={liked}
        disabled={updating}
        onClick={toggleLike}
      />
      {error && <p className={cn(s.likeError, s.actionDetailLikeError)} role="alert">{error}</p>}
    </div>
  );
}
