import { and, eq } from 'drizzle-orm';
import { commentUserBlocks, user } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

type RouteContext = { params: Promise<{ id: string }> };

async function targetUserId(params: RouteContext['params']) {
  return String((await params).id ?? '').trim();
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to block an account.' }, { status: 401 });

  const blockedUserId = await targetUserId(params);
  if (!blockedUserId || blockedUserId === session.user.id) {
    return Response.json({ error: 'Choose another account to block.' }, { status: 400 });
  }

  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, blockedUserId)).limit(1);
  if (!target) return Response.json({ error: 'That account is no longer available.' }, { status: 404 });

  await db.insert(commentUserBlocks).values({
    blockerUserId: session.user.id,
    blockedUserId,
  }).onConflictDoNothing();

  return Response.json({ blockedUserId, blocked: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to unblock an account.' }, { status: 401 });

  const blockedUserId = await targetUserId(params);
  if (!blockedUserId) return Response.json({ error: 'Choose an account to unblock.' }, { status: 400 });

  await db.delete(commentUserBlocks).where(and(
    eq(commentUserBlocks.blockerUserId, session.user.id),
    eq(commentUserBlocks.blockedUserId, blockedUserId),
  ));

  return Response.json({ blockedUserId, blocked: false });
}
