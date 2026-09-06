export type ActionModerationOwnership = {
  submittedByUserId: string | null;
  ownerUserId: string | null;
};

export function resolveActionCommentModerationPermissions(
  ownership: ActionModerationOwnership,
  userId: string,
) {
  return {
    canModerate: ownership.submittedByUserId === userId || ownership.ownerUserId === userId,
    canBanOrganization: ownership.ownerUserId === userId,
  };
}
