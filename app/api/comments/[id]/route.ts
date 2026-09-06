import { and, eq, isNull } from 'drizzle-orm';
import { actionComments } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to delete a comment.' }, { status: 401 });

  const commentId = Number((await params).id);
  if (!Number.isSafeInteger(commentId) || commentId <= 0) {
    return Response.json({ error: 'Choose a valid comment.' }, { status: 400 });
  }

  const [deleted] = await db.update(actionComments).set({
    body: '[deleted]',
    deletedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(actionComments.id, commentId),
    eq(actionComments.userId, session.user.id),
    isNull(actionComments.deletedAt),
  )).returning({ id: actionComments.id });

  if (!deleted) return Response.json({ error: 'You can only delete your own comments.' }, { status: 403 });
  return Response.json({ id: deleted.id, deleted: true });
}
