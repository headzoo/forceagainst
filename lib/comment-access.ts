import { and, eq } from 'drizzle-orm';
import { actionCommentBans, actions, organizationCommentBans, orgs, userCommentModeration } from '@/db/schema';
import { db } from '@/lib/db';

export type UserCommentAccess = {
  allowed: boolean;
  status: 'active' | 'muted' | 'banned';
  scope: 'site' | 'organization' | 'action' | null;
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

export async function getUserCommentAccess(
  userId: string,
  now = new Date(),
  actionId: number | null = null,
): Promise<UserCommentAccess> {
  const [globalRows, actionBanRows, organizationBanRows] = await Promise.all([
    db.select({
      status: userCommentModeration.status,
      restrictionExpiresAt: userCommentModeration.restrictionExpiresAt,
    }).from(userCommentModeration)
      .where(eq(userCommentModeration.userId, userId))
      .limit(1),
    actionId
      ? db.select({ userId: actionCommentBans.userId })
        .from(actionCommentBans)
        .where(and(
          eq(actionCommentBans.actionId, actionId),
          eq(actionCommentBans.userId, userId),
        ))
        .limit(1)
      : Promise.resolve([]),
    actionId
      ? db.select({ organizationName: orgs.name })
        .from(organizationCommentBans)
        .innerJoin(actions, eq(organizationCommentBans.organizationId, actions.orgId))
        .innerJoin(orgs, eq(organizationCommentBans.organizationId, orgs.id))
        .where(and(
          eq(actions.id, actionId),
          eq(organizationCommentBans.userId, userId),
        ))
        .limit(1)
      : Promise.resolve([]),
  ]);
  const moderation = globalRows[0];

  if (moderation?.status === 'muted') {
    if (!moderation.restrictionExpiresAt || moderation.restrictionExpiresAt <= now) {
      // An expired site-wide mute does not override a narrower active ban.
    } else {
      return {
        allowed: false,
        status: 'muted',
        scope: 'site',
        restrictionExpiresAt: moderation.restrictionExpiresAt.toISOString(),
        message: `Your account cannot post comments until ${formattedExpiry(moderation.restrictionExpiresAt)}. You can still use the rest of the site.`,
      };
    }
  } else if (moderation?.status === 'banned') {
    return {
      allowed: false,
      status: 'banned',
      scope: 'site',
      restrictionExpiresAt: null,
      message: 'Your account cannot post comments. You can still sign in and use the rest of the site.',
    };
  }

  const organizationBan = organizationBanRows[0];
  if (organizationBan) {
    return {
      allowed: false,
      status: 'banned',
      scope: 'organization',
      restrictionExpiresAt: null,
      message: `You cannot comment on actions from ${organizationBan.organizationName}.`,
    };
  }

  if (actionBanRows[0]) {
    return {
      allowed: false,
      status: 'banned',
      scope: 'action',
      restrictionExpiresAt: null,
      message: 'You cannot comment on this action.',
    };
  }

  return {
    allowed: true,
    status: 'active',
    scope: null,
    restrictionExpiresAt: null,
    message: null,
  };
}
