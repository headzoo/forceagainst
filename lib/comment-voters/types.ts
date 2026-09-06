export type CommentVoterContext = {
  actionId: number;
  body: string;
  normalizedBody: string;
  normalizedBodyHash: string;
  now: Date;
  user: {
    id: string;
    emailVerified: boolean;
    createdAt: Date;
  };
};

export type CommentVote =
  | { decision: 'pass' }
  | {
    decision: 'reject';
    code: string;
    message: string;
    status: number;
    retryAfter?: number;
  };

export interface CommentVoter {
  name: string;
  vote(context: CommentVoterContext): Promise<CommentVote>;
}

export const passVote: CommentVote = { decision: 'pass' };

export function rejectVote(
  code: string,
  message: string,
  status: number,
  retryAfter?: number,
): CommentVote {
  return { decision: 'reject', code, message, status, ...(retryAfter ? { retryAfter } : {}) };
}
