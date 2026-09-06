import { and, desc, eq } from 'drizzle-orm';
import { actionComments, actions } from '@/db/schema';
import { db } from '@/lib/db';
import type { CommentVoter } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

export const threadPolicyVoter: CommentVoter = {
  name: 'thread-policy',
  async vote({ actionId, now, user }) {
    const [policy] = await db.select({
      locked: actions.commentsLocked,
      slowModeSeconds: actions.commentSlowModeSeconds,
    }).from(actions).where(eq(actions.id, actionId)).limit(1);

    if (!policy) {
      return rejectVote('COMMENT_THREAD_UNAVAILABLE', 'This discussion is not available.', 404);
    }

    if (policy.locked) {
      return rejectVote('COMMENT_THREAD_LOCKED', 'This discussion has been locked by the moderation team.', 403);
    }

    if (policy.slowModeSeconds === 0) return passVote;

    const [lastComment] = await db.select({ createdAt: actionComments.createdAt })
      .from(actionComments)
      .where(and(eq(actionComments.actionId, actionId), eq(actionComments.userId, user.id)))
      .orderBy(desc(actionComments.createdAt))
      .limit(1);

    if (!lastComment) return passVote;

    const retryAfter = Math.ceil(
      (lastComment.createdAt.getTime() + policy.slowModeSeconds * 1_000 - now.getTime()) / 1_000,
    );

    return retryAfter > 0
      ? rejectVote(
        'COMMENT_SLOW_MODE',
        `Slow mode is on for this discussion. Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.`,
        429,
        retryAfter,
      )
      : passVote;
  },
};
