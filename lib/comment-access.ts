import { eq } from 'drizzle-orm';
import { userCommentModeration } from '@/db/schema';
import { db } from '@/lib/db';

export type UserCommentAccess = {
  allowed: boolean;
  status: 'active' | 'muted' | 'banned';
  restrictionExpiresAt: string | null;
  message: string | null;
};

function formattedExpiry(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(value);
}

export async function getUserCommentAccess(userId: string, now = new Date()): Promise<UserCommentAccess> {
  const [moderation] = await db.select({
    status: userCommentModeration.status,
    restrictionExpiresAt: userCommentModeration.restrictionExpiresAt,
  }).from(userCommentModeration)
    .where(eq(userCommentModeration.userId, userId))
    .limit(1);

  if (!moderation || moderation.status === 'active') {
    return { allowed: true, status: 'active', restrictionExpiresAt: null, message: null };
  }

  if (moderation.status === 'muted') {
    if (!moderation.restrictionExpiresAt || moderation.restrictionExpiresAt <= now) {
      return { allowed: true, status: 'active', restrictionExpiresAt: null, message: null };
    }
    return {
      allowed: false,
      status: 'muted',
      restrictionExpiresAt: moderation.restrictionExpiresAt.toISOString(),
      message: `Your account cannot post comments until ${formattedExpiry(moderation.restrictionExpiresAt)}. You can still use the rest of the site.`,
    };
  }

  return {
    allowed: false,
    status: 'banned',
    restrictionExpiresAt: null,
    message: 'Your account cannot post comments. You can still sign in and use the rest of the site.',
  };
}
