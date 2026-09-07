import { and, eq } from 'drizzle-orm';
import { actionCommentBans, actions, organizationCommentBans, organizationMembers, orgs } from '@/db/schema';
import { resolveActionCommentModerationPermissions } from '@/lib/comment-moderation-policy';
import { db } from '@/lib/db';

export type ActionCommentModerationAccess = {
  actionId: number;
  organizationId: number;
  organizationName: string;
  canModerate: boolean;
  canBanOrganization: boolean;
};

export type CommentBanScopes = Record<string, {
  action: boolean;
  organization: boolean;
}>;

export async function getActionCommentModerationAccess(
  actionId: number,
  userId: string,
): Promise<ActionCommentModerationAccess | null> {
  const [action] = await db
    .select({
      actionId: actions.id,
      organizationId: actions.orgId,
      organizationName: orgs.name,
      submittedByUserId: actions.submittedByUserId,
      moderatorMembershipId: organizationMembers.id,
    })
    .from(actions)
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .leftJoin(organizationMembers, and(
      eq(organizationMembers.organizationId, orgs.id),
      eq(organizationMembers.userId, userId),
    ))
    .where(eq(actions.id, actionId))
    .limit(1);

  if (!action) return null;

  const permissions = resolveActionCommentModerationPermissions({
    submittedByUserId: action.submittedByUserId,
    isOrganizationModerator: action.moderatorMembershipId !== null,
  }, userId);

  return {
    actionId: action.actionId,
    organizationId: action.organizationId,
    organizationName: action.organizationName,
    ...permissions,
  };
}

export async function getActionCommentBanScopes(
  actionId: number,
  organizationId: number,
): Promise<CommentBanScopes> {
  const [actionBans, organizationBans] = await Promise.all([
    db.select({ userId: actionCommentBans.userId })
      .from(actionCommentBans)
      .where(eq(actionCommentBans.actionId, actionId)),
    db.select({ userId: organizationCommentBans.userId })
      .from(organizationCommentBans)
      .where(eq(organizationCommentBans.organizationId, organizationId)),
  ]);

  const scopes: CommentBanScopes = {};
  for (const ban of actionBans) {
    scopes[ban.userId] = { action: true, organization: false };
  }
  for (const ban of organizationBans) {
    scopes[ban.userId] = {
      action: scopes[ban.userId]?.action ?? false,
      organization: true,
    };
  }

  return scopes;
}
