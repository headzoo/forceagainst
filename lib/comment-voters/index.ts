import { commentAccessVoter } from '@/lib/comment-voters/comment-access-voter';
import { contentVoter } from '@/lib/comment-voters/content-voter';
import { duplicateVoter } from '@/lib/comment-voters/duplicate-voter';
import { hashNormalizedCommentBody, normalizeCommentBody } from '@/lib/comment-voters/normalize';
import { rateLimitVoter } from '@/lib/comment-voters/rate-limit-voter';
import { runCommentVoters } from '@/lib/comment-voters/run';
import { threadPolicyVoter } from '@/lib/comment-voters/thread-policy-voter';
import type { CommentVoterContext } from '@/lib/comment-voters/types';
import { verifiedEmailVoter } from '@/lib/comment-voters/verified-email-voter';

const voters = [
  verifiedEmailVoter,
  commentAccessVoter,
  threadPolicyVoter,
  rateLimitVoter,
  contentVoter,
  duplicateVoter,
] as const;

export function prepareCommentBody(body: string) {
  const normalizedBody = normalizeCommentBody(body);
  return {
    normalizedBody,
    normalizedBodyHash: hashNormalizedCommentBody(normalizedBody),
  };
}

export function voteOnComment(context: CommentVoterContext) {
  return runCommentVoters(voters, context);
}

export { normalizeCommentBody } from '@/lib/comment-voters/normalize';
export type { CommentVote, CommentVoter, CommentVoterContext } from '@/lib/comment-voters/types';
