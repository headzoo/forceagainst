import { and, eq, sql } from 'drizzle-orm';
import { organizationMembers, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  getOrganizationMembership,
  getOrganizationModeratorRoster,
} from '@/lib/organization-membership';
import { getMemberSession } from '@/lib/member';

function readOrganizationId(value: unknown) {
  const organizationId = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(organizationId) && organizationId > 0 ? organizationId : null;
}

function readEmail(value: unknown) {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export async function GET(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to manage organization moderators.' }, { status: 401 });

  const organizationId = readOrganizationId(new URL(request.url).searchParams.get('organizationId'));
  if (!organizationId) return Response.json({ error: 'Choose an organization.' }, { status: 400 });

  const actor = await getOrganizationMembership(session.user.id, organizationId);
  if (!actor) return Response.json({ error: 'You do not moderate that organization.' }, { status: 403 });

  return Response.json(
    { moderators: await getOrganizationModeratorRoster(actor) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to invite organization moderators.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { organizationId?: unknown; email?: unknown } | null;
  const organizationId = readOrganizationId(body?.organizationId);
  const email = readEmail(body?.email);
  if (!organizationId) return Response.json({ error: 'Choose an organization.' }, { status: 400 });
  if (!email) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const actor = await getOrganizationMembership(session.user.id, organizationId);
  if (!actor) return Response.json({ error: 'You do not moderate that organization.' }, { status: 403 });

  const [invitee] = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  if (!invitee) {
    return Response.json({ error: 'No account uses that email address. Ask them to create an account first.' }, { status: 404 });
  }
  if (invitee.id === session.user.id) {
    return Response.json({ error: 'You are already a moderator of this organization.' }, { status: 409 });
  }

  try {
    const [membership] = await db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId: invitee.id,
        invitedByUserId: session.user.id,
      })
      .returning({ id: organizationMembers.id });

    const moderators = await getOrganizationModeratorRoster(actor);
    return Response.json({ membershipId: membership.id, moderators }, { status: 201 });
  } catch {
    return Response.json({ error: 'That account is already a moderator of this organization.' }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to remove organization moderators.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { organizationId?: unknown; membershipId?: unknown } | null;
  const organizationId = readOrganizationId(body?.organizationId);
  const membershipId = readOrganizationId(body?.membershipId);
  if (!organizationId || !membershipId) {
    return Response.json({ error: 'Choose a moderator to remove.' }, { status: 400 });
  }

  const actor = await getOrganizationMembership(session.user.id, organizationId);
  if (!actor) return Response.json({ error: 'You do not moderate that organization.' }, { status: 403 });

  const [removed] = await db
    .delete(organizationMembers)
    .where(and(
      eq(organizationMembers.id, membershipId),
      eq(organizationMembers.organizationId, organizationId),
      sql`${organizationMembers.id} > ${actor.membershipId}`,
      sql`${organizationMembers.userId} <> ${actor.ownerUserId}`,
    ))
    .returning({ id: organizationMembers.id });

  if (!removed) {
    return Response.json({ error: 'You can only remove moderators who joined after you. The creator cannot be removed.' }, { status: 403 });
  }

  return Response.json({ removed: true, membershipId: removed.id });
}
