import { and, eq, gte, isNull } from 'drizzle-orm';
import { actionComments } from '@/db/schema';
import { db } from '@/lib/db';
import type { CommentVoter } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

const DUPLICATE_WINDOW_MS = 10 * 60 * 1_000;

export const duplicateVoter: CommentVoter = {
  name: 'duplicate-content',
  async vote({ normalizedBodyHash, now, user }) {
    const [duplicate] = await db.select({ id: actionComments.id })
      .from(actionComments)
      .where(and(
        eq(actionComments.userId, user.id),
        eq(actionComments.normalizedBodyHash, normalizedBodyHash),
        gte(actionComments.createdAt, new Date(now.getTime() - DUPLICATE_WINDOW_MS)),
        isNull(actionComments.deletedAt),
        eq(actionComments.moderationStatus, 'visible'),
      ))
      .limit(1);

    return duplicate
      ? rejectVote(
        'COMMENT_DUPLICATE',
        'You recently posted the same comment. Please add something new before posting again.',
        409,
      )
      : passVote;
  },
};
