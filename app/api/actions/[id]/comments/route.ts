import { and, eq } from 'drizzle-orm';
import { actionComments, actions } from '@/db/schema';
import { MAX_COMMENT_LENGTH } from '@/lib/action-comments';
import { prepareCommentBody, voteOnComment } from '@/lib/comment-voters';
import { db, getActionComments, publicActionVisibilityCondition } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

type RouteContext = { params: Promise<{ id: string }> };

async function readActionId(params: RouteContext['params']) {
  const value = Number((await params).id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function readCommentInput(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const { body, parentId } = value as { body?: unknown; parentId?: unknown };
  const text = typeof body === 'string' ? body.trim() : '';

  if (!text || text.length > MAX_COMMENT_LENGTH) return null;
  if (parentId !== null && parentId !== undefined && (!Number.isSafeInteger(parentId) || Number(parentId) <= 0)) return null;

  return { body: text, parentId: parentId == null ? null : Number(parentId) };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const actionId = await readActionId(params);
  if (!actionId) return Response.json({ error: 'Choose a valid action.' }, { status: 400 });

  const [action] = await db.select({ id: actions.id }).from(actions)
    .where(and(eq(actions.id, actionId), publicActionVisibilityCondition())).limit(1);
  if (!action) return Response.json({ error: 'That action is not available.' }, { status: 404 });

  return Response.json({ comments: await getActionComments(actionId) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to comment.' }, { status: 401 });

  const actionId = await readActionId(params);
  if (!actionId) return Response.json({ error: 'Choose a valid action.' }, { status: 400 });

  const input = readCommentInput(await request.json().catch(() => null));
  if (!input) {
    return Response.json({ error: `Comments must be between 1 and ${MAX_COMMENT_LENGTH.toLocaleString()} characters.` }, { status: 400 });
  }

  const [action] = await db.select({ id: actions.id }).from(actions)
    .where(and(eq(actions.id, actionId), publicActionVisibilityCondition())).limit(1);
  if (!action) return Response.json({ error: 'That action is not available.' }, { status: 404 });

  let depth = 0;
  if (input.parentId !== null) {
    const [parent] = await db.select({ actionId: actionComments.actionId, depth: actionComments.depth })
      .from(actionComments).where(eq(actionComments.id, input.parentId)).limit(1);

    if (!parent || parent.actionId !== actionId) {
      return Response.json({ error: 'That reply target is not available.' }, { status: 400 });
    }

    depth = parent.depth + 1;
    if (depth > 3) return Response.json({ error: 'Comments can only be nested four levels deep.' }, { status: 400 });
  }

  const preparedBody = prepareCommentBody(input.body);
  const vote = await voteOnComment({
    actionId,
    body: input.body,
    ...preparedBody,
    now: new Date(),
    user: {
      id: session.user.id,
      emailVerified: session.user.emailVerified,
      createdAt: new Date(session.user.createdAt),
    },
  });

  if (vote.decision === 'reject') {
    return Response.json({ error: vote.message, code: vote.code }, {
      status: vote.status,
      headers: vote.retryAfter ? { 'Retry-After': String(vote.retryAfter) } : undefined,
    });
  }

  const [created] = await db.insert(actionComments).values({
    actionId,
    userId: session.user.id,
    parentId: input.parentId,
    depth,
    body: input.body,
    normalizedBodyHash: preparedBody.normalizedBodyHash,
  }).returning({ id: actionComments.id });

  const comment = (await getActionComments(actionId)).find((item) => item.id === created.id);
  return Response.json({ comment }, { status: 201 });
}
