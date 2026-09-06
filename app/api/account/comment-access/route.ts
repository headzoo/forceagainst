import { getUserCommentAccess } from '@/lib/comment-access';
import { getMemberSession } from '@/lib/member';

export async function GET() {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to check comment access.' }, { status: 401 });

  return Response.json(await getUserCommentAccess(session.user.id), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
