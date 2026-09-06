import { getUserCommentAccess } from '@/lib/comment-access';
import { getMemberSession } from '@/lib/member';

export async function GET(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to check comment access.' }, { status: 401 });

  const requestedActionId = new URL(request.url).searchParams.get('actionId');
  const actionId = requestedActionId === null ? null : Number(requestedActionId);
  if (actionId !== null && (!Number.isSafeInteger(actionId) || actionId <= 0)) {
    return Response.json({ error: 'Choose a valid action.' }, { status: 400 });
  }

  return Response.json(await getUserCommentAccess(session.user.id, new Date(), actionId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
