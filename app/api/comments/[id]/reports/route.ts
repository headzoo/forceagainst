import { and, count, eq, gte, isNull } from 'drizzle-orm';
import { actionComments, commentReports } from '@/db/schema';
import { getUserCommentAccess } from '@/lib/comment-access';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

const reportReasons = ['spam', 'harassment', 'hate', 'misinformation', 'other'] as const;
type ReportReason = (typeof reportReasons)[number];
type RouteContext = { params: Promise<{ id: string }> };

function readReportInput(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const { reason, details } = value as { reason?: unknown; details?: unknown };
  const normalizedReason = typeof reason === 'string' ? reason.trim().toLowerCase() : '';
  const normalizedDetails = typeof details === 'string' ? details.trim() : '';

  if (!reportReasons.includes(normalizedReason as ReportReason) || normalizedDetails.length > 1_000) return null;
  return { reason: normalizedReason as ReportReason, details: normalizedDetails || null };
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to report a comment.' }, { status: 401 });
  if (!session.user.emailVerified) {
    return Response.json({ error: 'Verify your email before reporting comments.' }, { status: 403 });
  }
  const commentId = Number((await params).id);
  if (!Number.isSafeInteger(commentId) || commentId <= 0) {
    return Response.json({ error: 'Choose a valid comment.' }, { status: 400 });
  }

  const input = readReportInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'Choose a report reason and keep details under 1,000 characters.' }, { status: 400 });

  const [comment] = await db.select({
    id: actionComments.id,
    actionId: actionComments.actionId,
    userId: actionComments.userId,
  }).from(actionComments).where(and(
    eq(actionComments.id, commentId),
    isNull(actionComments.deletedAt),
    eq(actionComments.moderationStatus, 'visible'),
  )).limit(1);

  if (!comment) return Response.json({ error: 'That comment is no longer available.' }, { status: 404 });
  if (comment.userId === session.user.id) {
    return Response.json({ error: 'You cannot report your own comment.' }, { status: 400 });
  }

  const access = await getUserCommentAccess(session.user.id, new Date(), comment.actionId);
  if (!access.allowed) {
    return Response.json({ error: 'Your account cannot submit comment reports in this discussion.' }, { status: 403 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000);
  const [{ value: recentReports }] = await db.select({ value: count() }).from(commentReports).where(and(
    eq(commentReports.reporterUserId, session.user.id),
    gte(commentReports.createdAt, oneHourAgo),
  ));
  if (recentReports >= 10) {
    return Response.json({ error: 'You have submitted several reports recently. Try again later.' }, { status: 429 });
  }

  const [created] = await db.insert(commentReports).values({
    commentId,
    actionId: comment.actionId,
    reporterUserId: session.user.id,
    reason: input.reason,
    details: input.details,
  }).onConflictDoNothing().returning({ id: commentReports.id });

  if (!created) return Response.json({ error: 'You have already reported this comment.' }, { status: 409 });
  return Response.json({ reportId: created.id, reported: true }, { status: 201 });
}
