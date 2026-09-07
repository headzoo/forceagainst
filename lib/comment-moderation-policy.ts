export type ActionModerationOwnership = {
  submittedByUserId: string | null;
  isOrganizationModerator: boolean;
};

export function resolveActionCommentModerationPermissions(
  ownership: ActionModerationOwnership,
  userId: string,
) {
  return {
    canModerate: ownership.submittedByUserId === userId || ownership.isOrganizationModerator,
    canBanOrganization: ownership.isOrganizationModerator,
  };
}
