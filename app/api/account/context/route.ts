import { desc, eq } from 'drizzle-orm';
import { actions, issues } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession, isAdminEmail } from '@/lib/member';
import {
  getOrganizationMemberships,
  getOrganizationModeratorRoster,
} from '@/lib/organization-membership';

function readOrganizationId(value: string | null) {
  const organizationId = Number(value);
  return Number.isSafeInteger(organizationId) && organizationId > 0 ? organizationId : null;
}

export async function GET(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });

  const memberships = await getOrganizationMemberships(session.user.id);
  const requestedOrganizationId = readOrganizationId(new URL(request.url).searchParams.get('organizationId'));
  const membership = requestedOrganizationId
    ? memberships.find((item) => item.organizationId === requestedOrganizationId) ?? memberships[0]
    : memberships[0];
  const organization = membership ? {
    id: membership.organizationId,
    ownerUserId: membership.ownerUserId,
    slug: membership.slug,
    name: membership.name,
    avatar: membership.avatar,
    website: membership.website,
    openGraph: membership.openGraph,
    description: membership.description,
    sidebar: membership.sidebar,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  } : null;

  const organizationActions = organization
    ? await db
      .select({
        id: actions.id,
        slug: actions.slug,
        type: actions.type,
        title: actions.title,
        detail: actions.detail,
        urgent: actions.urgent,
        issue: issues.name,
        issueSlug: issues.slug,
        effort: actions.effort,
        commentCount: actions.commentCount,
        approved: actions.approved,
        published: actions.published,
      })
      .from(actions)
      .innerJoin(issues, eq(actions.issueId, issues.id))
      .where(eq(actions.orgId, organization.id))
      .orderBy(desc(actions.createdAt))
    : [];

  return Response.json({
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    organization: organization ?? null,
    organizations: memberships.map((item) => ({
      id: item.organizationId,
      name: item.name,
      isOwner: item.ownerUserId === session.user.id,
    })),
    membership: membership ? {
      id: membership.membershipId,
      isOwner: membership.ownerUserId === session.user.id,
    } : null,
    moderators: membership ? await getOrganizationModeratorRoster(membership) : [],
    actions: organizationActions.map((action) => ({
      ...action,
      organization: organization?.name ?? '',
      organizationSlug: organization?.slug ?? '',
    })),
    isAdmin: isAdminEmail(session.user.email),
  });
}
