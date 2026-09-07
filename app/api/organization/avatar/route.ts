import { eq } from 'drizzle-orm';
import { orgs } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { getOrganizationMembership } from '@/lib/organization-membership';

const MAX_AVATAR_DATA_URL_LENGTH = 180_000;
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

export async function PATCH(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to update your organization avatar.' }, { status: 401 });

  const payload = await request.json().catch(() => null) as { organizationId?: unknown; image?: unknown } | null;
  const organizationId = typeof payload?.organizationId === 'number'
    ? payload.organizationId
    : Number(payload?.organizationId);
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) {
    return Response.json({ error: 'Choose an organization.' }, { status: 400 });
  }
  const organization = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );

  if (!organization) {
    return Response.json({ error: 'You do not moderate that organization.' }, { status: 403 });
  }

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
    .where(eq(orgs.id, organization.organizationId));

  return Response.json({ image });
}
