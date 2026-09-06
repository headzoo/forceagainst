import { getUserCommentAccess } from '@/lib/comment-access';
import type { CommentVoter } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

export const commentAccessVoter: CommentVoter = {
  name: 'comment-access',
  async vote({ actionId, now, user }) {
    const access = await getUserCommentAccess(user.id, now, actionId);
    return access.allowed
      ? passVote
      : rejectVote(access.status === 'muted' ? 'COMMENTS_MUTED' : 'COMMENTS_BANNED', access.message!, 403);
  },
};
