import { and, desc, eq } from 'drizzle-orm';
import { actionCommentBans, actions, organizationCommentBans, orgs, user } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

type BanRemovalInput = {
  scope: 'action' | 'organization';
  userId: string;
  actionId: number | null;
};

async function getOwnedOrganization(userId: string) {
  const [organization] = await db.select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.ownerUserId, userId))
    .limit(1);
  return organization ?? null;
}

function readRemovalInput(value: unknown): BanRemovalInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { scope?: unknown; userId?: unknown; actionId?: unknown };
  const scope = body.scope === 'action' || body.scope === 'organization' ? body.scope : null;
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const actionId = body.actionId == null ? null : Number(body.actionId);

  if (!scope || !userId) return null;
  if (scope === 'action' && (!Number.isSafeInteger(actionId) || Number(actionId) <= 0)) return null;
  return { scope, userId, actionId };
}

export async function GET() {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to manage organization bans.' }, { status: 401 });

  const organization = await getOwnedOrganization(session.user.id);
  if (!organization) return Response.json({ error: 'Create an organization before managing bans.' }, { status: 404 });

  const [organizationBans, actionBans] = await Promise.all([
    db.select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bannedAt: organizationCommentBans.createdAt,
    })
      .from(organizationCommentBans)
      .innerJoin(user, eq(organizationCommentBans.userId, user.id))
      .where(eq(organizationCommentBans.organizationId, organization.id))
      .orderBy(desc(organizationCommentBans.createdAt)),
    db.select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      actionId: actions.id,
      actionTitle: actions.title,
      bannedAt: actionCommentBans.createdAt,
    })
      .from(actionCommentBans)
      .innerJoin(actions, eq(actionCommentBans.actionId, actions.id))
      .innerJoin(user, eq(actionCommentBans.userId, user.id))
      .where(eq(actions.orgId, organization.id))
      .orderBy(desc(actionCommentBans.createdAt)),
  ]);

  const bans = [
    ...organizationBans.map((ban) => ({
      scope: 'organization' as const,
      user: { id: ban.userId, name: ban.name, username: ban.username, image: ban.image },
      action: null,
      bannedAt: ban.bannedAt.toISOString(),
    })),
    ...actionBans.map((ban) => ({
      scope: 'action' as const,
      user: { id: ban.userId, name: ban.name, username: ban.username, image: ban.image },
      action: { id: ban.actionId, title: ban.actionTitle },
      bannedAt: ban.bannedAt.toISOString(),
    })),
  ].sort((left, right) => right.bannedAt.localeCompare(left.bannedAt));

  return Response.json({ bans }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to manage organization bans.' }, { status: 401 });

  const organization = await getOwnedOrganization(session.user.id);
  if (!organization) return Response.json({ error: 'Only the organization owner can remove bans.' }, { status: 403 });

  const input = readRemovalInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'Choose a valid ban to remove.' }, { status: 400 });

  if (input.scope === 'organization') {
    await db.delete(organizationCommentBans).where(and(
      eq(organizationCommentBans.organizationId, organization.id),
      eq(organizationCommentBans.userId, input.userId),
    ));
  } else {
    const [ownedAction] = await db.select({ id: actions.id })
      .from(actions)
      .where(and(eq(actions.id, input.actionId!), eq(actions.orgId, organization.id)))
      .limit(1);
    if (!ownedAction) return Response.json({ error: 'That action does not belong to your organization.' }, { status: 404 });

    await db.delete(actionCommentBans).where(and(
      eq(actionCommentBans.actionId, ownedAction.id),
      eq(actionCommentBans.userId, input.userId),
    ));
  }

  return Response.json({ removed: true, ...input });
}
