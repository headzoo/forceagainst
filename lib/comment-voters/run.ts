import type { CommentVote, CommentVoter, CommentVoterContext } from '@/lib/comment-voters/types';
import { passVote } from '@/lib/comment-voters/types';

export async function runCommentVoters(
  voters: readonly CommentVoter[],
  context: CommentVoterContext,
): Promise<CommentVote> {
  for (const voter of voters) {
    const vote = await voter.vote(context);
    if (vote.decision === 'reject') return vote;
  }

  return passVote;
}
