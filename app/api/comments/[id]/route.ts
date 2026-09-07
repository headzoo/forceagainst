import { and, eq, inArray, isNull } from 'drizzle-orm';
import { actionComments, actions, commentModerationEvents, commentReports, organizationMembers, orgs } from '@/db/schema';
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

  const [comment] = await db.select({
    id: actionComments.id,
    actionId: actionComments.actionId,
    authorId: actionComments.userId,
    moderationStatus: actionComments.moderationStatus,
    deletedAt: actionComments.deletedAt,
    submittedByUserId: actions.submittedByUserId,
    moderatorMembershipId: organizationMembers.id,
  })
    .from(actionComments)
    .innerJoin(actions, eq(actionComments.actionId, actions.id))
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .leftJoin(organizationMembers, and(
      eq(organizationMembers.organizationId, orgs.id),
      eq(organizationMembers.userId, session.user.id),
    ))
    .where(eq(actionComments.id, commentId))
    .limit(1);

  if (!comment || comment.deletedAt || comment.moderationStatus !== 'visible') {
    return Response.json({ error: 'That comment is no longer available.' }, { status: 404 });
  }

  const deletingOwnComment = comment.authorId === session.user.id;
  const moderatingComment = !deletingOwnComment && (
    comment.submittedByUserId === session.user.id
    || comment.moderatorMembershipId !== null
  );
  if (!deletingOwnComment && !moderatingComment) {
    return Response.json({ error: 'You can only delete your own comments unless you moderate this action.' }, { status: 403 });
  }

  const now = new Date();
  const [deleted] = await db.update(actionComments).set(deletingOwnComment ? {
    body: '[deleted]',
    deletedAt: now,
    updatedAt: now,
  } : {
    moderationStatus: 'removed',
    moderationReason: 'Removed by the action moderator.',
    moderatedAt: now,
    moderatedByAdminId: session.user.id,
    moderatedByAdminName: session.user.name,
    updatedAt: now,
  }).where(and(
    eq(actionComments.id, comment.id),
    isNull(actionComments.deletedAt),
    eq(actionComments.moderationStatus, 'visible'),
  )).returning({ id: actionComments.id });

  if (!deleted) return Response.json({ error: 'That comment changed before it could be removed.' }, { status: 409 });
  await db.update(commentReports).set({
    status: 'dismissed',
    resolutionNote: deletingOwnComment ? 'Comment deleted by its author.' : 'Comment removed by the action moderator.',
    updatedAt: now,
  }).where(and(
    eq(commentReports.commentId, deleted.id),
    inArray(commentReports.status, ['pending', 'reviewing']),
  ));

  if (moderatingComment) {
    await db.insert(commentModerationEvents).values({
      actionId: comment.actionId,
      commentId: comment.id,
      targetUserId: comment.authorId,
      event: 'comment_removed',
      reason: 'Removed by the action moderator.',
      previousState: 'visible',
      newState: 'removed',
      performedByAdminId: session.user.id,
      performedByAdminName: session.user.name,
    });
  }

  return Response.json({
    id: deleted.id,
    deleted: true,
    visibility: deletingOwnComment ? 'user_deleted' : 'removed',
  });
}
