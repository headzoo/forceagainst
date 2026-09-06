import type { CommentVoter } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

const linkPattern = /(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const repeatedCharacterPattern = /(.)\1{15,}/u;
const NEW_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1_000;

function linkHosts(body: string) {
  return (body.match(linkPattern) ?? []).flatMap((candidate) => {
    try {
      const url = new URL(candidate.startsWith('www.') ? `https://${candidate}` : candidate);
      return [url.hostname.toLowerCase().replace(/^www\./, '')];
    } catch {
      return [];
    }
  });
}

export const contentVoter: CommentVoter = {
  name: 'content',
  async vote({ body, normalizedBody, now, user }) {
    if (!normalizedBody) {
      return rejectVote('COMMENT_EMPTY', 'Write a visible message before posting.', 400);
    }

    if (repeatedCharacterPattern.test(normalizedBody)) {
      return rejectVote('COMMENT_REPEATED_CHARACTERS', 'Please remove excessive repeated characters.', 400);
    }

    const hosts = linkHosts(body);
    const isNewAccount = now.getTime() - user.createdAt.getTime() < NEW_ACCOUNT_AGE_MS;
    const linkLimit = isNewAccount ? 1 : 4;

    if (hosts.length > linkLimit) {
      return rejectVote(
        'COMMENT_LINK_LIMIT',
        `This comment contains too many links. ${isNewAccount ? 'New accounts can include one link.' : 'Comments can include up to four links.'}`,
        400,
      );
    }

    const hostCounts = new Map<string, number>();
    for (const host of hosts) hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    if ([...hostCounts.values()].some((count) => count > 2)) {
      return rejectVote('COMMENT_REPEATED_DOMAIN', 'Please do not repeat the same link several times.', 400);
    }

    return passVote;
  },
};
