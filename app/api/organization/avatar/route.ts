import { eq } from 'drizzle-orm';
import { orgs } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';

const MAX_AVATAR_DATA_URL_LENGTH = 180_000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

export async function PATCH(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to update your organization avatar.' }, { status: 401 });

  const [organization] = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.ownerUserId, session.user.id))
    .limit(1);

  if (!organization) {
    return Response.json({ error: 'Create an organization before adding an avatar.' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null) as { image?: unknown } | null;
  const image = payload?.image;

  if (image !== null && (
    typeof image !== 'string'
    || image.length > MAX_AVATAR_DATA_URL_LENGTH
    || !AVATAR_DATA_URL_PATTERN.test(image)
  )) {
    return Response.json({ error: 'Choose a valid JPG, PNG, or WebP image.' }, { status: 400 });
  }

  await db
    .update(orgs)
    .set({ avatar: image, updatedAt: new Date() })
    .where(eq(orgs.id, organization.id));

  return Response.json({ image });
}
