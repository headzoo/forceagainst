import { and, asc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { organizationMembers, orgs, user } from '@/db/schema';
import { db } from '@/lib/db';
import { canRemoveOrganizationModerator } from '@/lib/organization-moderation-policy';

const membershipColumns = {
  membershipId: organizationMembers.id,
  userId: organizationMembers.userId,
  organizationId: orgs.id,
  ownerUserId: orgs.ownerUserId,
  slug: orgs.slug,
  name: orgs.name,
  avatar: orgs.avatar,
  website: orgs.website,
  openGraph: orgs.openGraph,
  description: orgs.description,
  sidebar: orgs.sidebar,
  createdAt: orgs.createdAt,
  updatedAt: orgs.updatedAt,
};

export type OrganizationMembership = Awaited<ReturnType<typeof getOrganizationMemberships>>[number];

export async function getOrganizationMemberships(userId: string) {
  return db
    .select(membershipColumns)
    .from(organizationMembers)
    .innerJoin(orgs, eq(organizationMembers.organizationId, orgs.id))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(
      asc(sql<number>`case when ${orgs.ownerUserId} = ${userId} then 0 else 1 end`),
      asc(organizationMembers.id),
    );
}

export async function getOrganizationMembership(userId: string, organizationId?: number | null) {
  const conditions = [eq(organizationMembers.userId, userId)];
  if (organizationId) conditions.push(eq(organizationMembers.organizationId, organizationId));

  const [membership] = await db
    .select(membershipColumns)
    .from(organizationMembers)
    .innerJoin(orgs, eq(organizationMembers.organizationId, orgs.id))
    .where(and(...conditions))
    .orderBy(
      asc(sql<number>`case when ${orgs.ownerUserId} = ${userId} then 0 else 1 end`),
      asc(organizationMembers.id),
    )
    .limit(1);

  return membership ?? null;
}

export async function getOrganizationModeratorRoster(actor: OrganizationMembership) {
  const inviter = alias(user, 'organization_member_inviter');
  const rows = await db
    .select({
      membershipId: organizationMembers.id,
      organizationId: organizationMembers.organizationId,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      invitedByName: inviter.name,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(user, eq(organizationMembers.userId, user.id))
    .leftJoin(inviter, eq(organizationMembers.invitedByUserId, inviter.id))
    .where(eq(organizationMembers.organizationId, actor.organizationId))
    .orderBy(asc(organizationMembers.id));

  return rows.map((member, index) => ({
    ...member,
    tier: index + 1,
    isOwner: member.userId === actor.ownerUserId,
    canRemove: canRemoveOrganizationModerator(
      {
        membershipId: actor.membershipId,
        userId: actor.userId,
        organizationId: actor.organizationId,
      },
      member,
      actor.ownerUserId,
    ),
    joinedAt: member.joinedAt.toISOString(),
  }));
}
