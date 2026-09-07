import { and, eq } from 'drizzle-orm';
import { actionCommentBans, actionComments, organizationCommentBans } from '@/db/schema';
import { getActionCommentModerationAccess } from '@/lib/comment-moderation';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

type RouteContext = { params: Promise<{ id: string }> };

function readBanInput(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const body = value as {
    userId?: unknown;
    banFromAction?: unknown;
    banFromOrganization?: unknown;
  };
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const banFromAction = body.banFromAction === true;
  const banFromOrganization = body.banFromOrganization === true;

  if (!userId || (!banFromAction && !banFromOrganization)) return null;
  return { userId, banFromAction, banFromOrganization };
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to moderate this discussion.' }, { status: 401 });

  const actionId = Number((await params).id);
  if (!Number.isSafeInteger(actionId) || actionId <= 0) {
    return Response.json({ error: 'Choose a valid action.' }, { status: 400 });
  }

  const input = readBanInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'Choose at least one ban option.' }, { status: 400 });
  if (input.userId === session.user.id) {
    return Response.json({ error: 'You cannot ban yourself.' }, { status: 400 });
  }

  const access = await getActionCommentModerationAccess(actionId, session.user.id);
  if (!access?.canModerate) {
    return Response.json({ error: 'Only this action’s submitter or an organization moderator can ban participants.' }, { status: 403 });
  }
  if (input.banFromOrganization && !access.canBanOrganization) {
    return Response.json({ error: 'Only an organization moderator can ban a participant from every organization action.' }, { status: 403 });
  }

  const [participant] = await db.select({ userId: actionComments.userId })
    .from(actionComments)
    .where(and(
      eq(actionComments.actionId, actionId),
      eq(actionComments.userId, input.userId),
    ))
    .limit(1);
  if (!participant?.userId) {
    return Response.json({ error: 'That account has not participated in this discussion.' }, { status: 404 });
  }

  if (input.banFromOrganization) {
    await db.insert(organizationCommentBans).values({
      organizationId: access.organizationId,
      userId: input.userId,
      bannedByUserId: session.user.id,
    }).onConflictDoNothing();
  }
  if (input.banFromAction) {
    await db.insert(actionCommentBans).values({
      actionId,
      userId: input.userId,
      bannedByUserId: session.user.id,
    }).onConflictDoNothing();
  }

  return Response.json({
    userId: input.userId,
    banned: {
      action: input.banFromAction,
      organization: input.banFromOrganization,
    },
  }, { status: 201 });
}
