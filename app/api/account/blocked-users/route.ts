import { asc, eq } from 'drizzle-orm';
import { commentUserBlocks, user } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

export async function GET() {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to manage blocked accounts.' }, { status: 401 });

  const blockedUsers = await db.select({
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
    blockedAt: commentUserBlocks.createdAt,
  }).from(commentUserBlocks)
    .innerJoin(user, eq(commentUserBlocks.blockedUserId, user.id))
    .where(eq(commentUserBlocks.blockerUserId, session.user.id))
    .orderBy(asc(user.username));

  return Response.json({
    blockedUsers: blockedUsers.map((blockedUser) => ({
      ...blockedUser,
      blockedAt: blockedUser.blockedAt.toISOString(),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
