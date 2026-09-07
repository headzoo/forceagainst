export type OrganizationModeratorTier = {
  membershipId: number;
  userId: string;
  organizationId: number;
};

export function canRemoveOrganizationModerator(
  actor: OrganizationModeratorTier,
  target: OrganizationModeratorTier,
  ownerUserId: string | null,
) {
  return actor.organizationId === target.organizationId
    && target.userId !== ownerUserId
    && target.membershipId > actor.membershipId;
}
