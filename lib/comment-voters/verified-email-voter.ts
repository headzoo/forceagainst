import type { CommentVoter } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

export const verifiedEmailVoter: CommentVoter = {
  name: 'verified-email',
  async vote({ user }) {
    return user.emailVerified
      ? passVote
      : rejectVote(
        'EMAIL_NOT_VERIFIED',
        'Verify your email address before posting comments.',
        403,
      );
  },
};
