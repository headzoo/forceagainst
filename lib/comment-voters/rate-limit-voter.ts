import { sql } from 'drizzle-orm';
import { commentRateLimits } from '@/db/schema';
import { db } from '@/lib/db';
import type { CommentVoter, CommentVoterContext } from '@/lib/comment-voters/types';
import { passVote, rejectVote } from '@/lib/comment-voters/types';

type RateRule = { name: string; windowSeconds: number; maximum: number; actionScoped?: boolean };

const establishedAccountRules: RateRule[] = [
  { name: 'burst', windowSeconds: 10, maximum: 1 },
  { name: 'short', windowSeconds: 5 * 60, maximum: 5 },
  { name: 'hour', windowSeconds: 60 * 60, maximum: 20 },
  { name: 'day', windowSeconds: 24 * 60 * 60, maximum: 50 },
  { name: 'action', windowSeconds: 60, maximum: 3, actionScoped: true },
];

const newAccountRules: RateRule[] = [
  { name: 'new-burst', windowSeconds: 30, maximum: 1 },
  { name: 'new-hour', windowSeconds: 60 * 60, maximum: 5 },
  { name: 'new-day', windowSeconds: 24 * 60 * 60, maximum: 10 },
  { name: 'new-action', windowSeconds: 60, maximum: 2, actionScoped: true },
];

const NEW_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1_000;

async function consumeRule(key: string, rule: RateRule) {
  const databaseNow = new Date();
  const [row] = await db.insert(commentRateLimits).values({
    key,
    windowStartedAt: databaseNow,
    requestCount: 1,
    expiresAt: new Date(databaseNow.getTime() + rule.windowSeconds * 1_000),
  }).onConflictDoUpdate({
    target: commentRateLimits.key,
    set: {
      windowStartedAt: sql`CASE
        WHEN ${commentRateLimits.expiresAt} <= now() THEN now()
        ELSE ${commentRateLimits.windowStartedAt}
      END`,
      requestCount: sql`CASE
        WHEN ${commentRateLimits.expiresAt} <= now() THEN 1
        ELSE ${commentRateLimits.requestCount} + 1
      END`,
      expiresAt: sql`CASE
        WHEN ${commentRateLimits.expiresAt} <= now()
          THEN now() + make_interval(secs => ${rule.windowSeconds})
        ELSE ${commentRateLimits.expiresAt}
      END`,
    },
  }).returning({
    requestCount: commentRateLimits.requestCount,
    expiresAt: commentRateLimits.expiresAt,
  });

  if (!row) throw new Error('Comment rate limiter did not return a result.');

  return {
    allowed: row.requestCount <= rule.maximum,
    retryAfter: Math.max(1, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1_000)),
  };
}

function bucketKey(context: CommentVoterContext, rule: RateRule) {
  const actionSuffix = rule.actionScoped ? `:action:${context.actionId}` : '';
  return `comment:user:${context.user.id}:${rule.name}${actionSuffix}`;
}

export const rateLimitVoter: CommentVoter = {
  name: 'rate-limit',
  async vote(context) {
    const isNewAccount = context.now.getTime() - context.user.createdAt.getTime() < NEW_ACCOUNT_AGE_MS;
    const rules = isNewAccount ? newAccountRules : establishedAccountRules;
    const results = await Promise.all(rules.map(async (rule) => consumeRule(bucketKey(context, rule), rule)));
    const retryAfter = results.reduce((longest, result) => result.allowed ? longest : Math.max(longest, result.retryAfter), 0);

    return retryAfter === 0
      ? passVote
      : rejectVote(
        'COMMENT_RATE_LIMITED',
        `You are commenting too quickly. Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.`,
        429,
        retryAfter,
      );
  },
};
