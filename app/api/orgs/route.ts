import { eq } from 'drizzle-orm';
import { orgs, type OpenGraphMetadata } from '@/db/schema';
import { db } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { analyzeWebsiteHref, parsePublicHttpUrl } from '@/lib/action-metadata';
import { getOrganizationMembership } from '@/lib/organization-membership';
import { uniqueOrganizationSlug } from '@/lib/slugs';

function readOrganizationId(value: unknown) {
  const organizationId = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(organizationId) && organizationId > 0 ? organizationId : null;
}

export async function POST(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to create an organization.' }, { status: 401 });

  const [existing] = await db.select().from(orgs).where(eq(orgs.ownerUserId, session.user.id)).limit(1);
  if (existing) return Response.json({ error: 'Your account already has an organization.', organization: existing }, { status: 409 });

  const body = await request.json().catch(() => null) as { organizationId?: unknown; name?: unknown; website?: unknown; description?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const websiteInput = typeof body?.website === 'string' ? body.website.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (name.length < 2 || name.length > 120) {
    return Response.json({ error: 'Organization name must be between 2 and 120 characters.' }, { status: 400 });
  }

  if (description.length > 20_000) {
    return Response.json({ error: 'Organization description must be 20,000 characters or fewer.' }, { status: 400 });
  }

  let website: string | null = null;
  let openGraph: OpenGraphMetadata | null = null;
  if (websiteInput) {
    try {
      const metadata = await analyzeWebsiteHref(websiteInput);
      website = metadata.href;
      openGraph = metadata.openGraph;
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Enter a valid organization website.' }, { status: 400 });
    }
  }

  try {
    const [organization] = await db.insert(orgs).values({
      ownerUserId: session.user.id,
      slug: await uniqueOrganizationSlug(name),
      name,
      website,
      openGraph,
      description,
    }).returning();

    return Response.json({ organization }, { status: 201 });
  } catch {
    return Response.json({ error: 'That organization name is already registered.' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to update your organization.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { organizationId?: unknown; name?: unknown; website?: unknown; description?: unknown } | null;
  const requestedOrganizationId = readOrganizationId(body?.organizationId);
  if (!requestedOrganizationId) return Response.json({ error: 'Choose an organization.' }, { status: 400 });
  const membership = await getOrganizationMembership(session.user.id, requestedOrganizationId);
  if (!membership) return Response.json({ error: 'You do not moderate that organization.' }, { status: 403 });

  const [existing] = await db.select().from(orgs).where(eq(orgs.id, membership.organizationId)).limit(1);
  if (!existing) return Response.json({ error: 'That organization no longer exists.' }, { status: 404 });
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const websiteInput = typeof body?.website === 'string' ? body.website.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (name.length < 2 || name.length > 120) {
    return Response.json({ error: 'Organization name must be between 2 and 120 characters.' }, { status: 400 });
  }

  if (description.length > 20_000) {
    return Response.json({ error: 'Organization description must be 20,000 characters or fewer.' }, { status: 400 });
  }

  let website: string | null = null;
  let openGraph: OpenGraphMetadata | null = null;
  if (websiteInput) {
    try {
      const normalizedWebsite = parsePublicHttpUrl(websiteInput).toString();
      if (normalizedWebsite === existing.website) {
        website = existing.website;
        openGraph = existing.openGraph;
      } else {
        const metadata = await analyzeWebsiteHref(normalizedWebsite);
        website = metadata.href;
        openGraph = metadata.openGraph;
      }
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'Enter a valid organization website.' }, { status: 400 });
    }
  }

  try {
    const [organization] = await db
      .update(orgs)
      .set({ name, website, openGraph, description, updatedAt: new Date() })
      .where(eq(orgs.id, membership.organizationId))
      .returning();

    return Response.json({ organization });
  } catch {
    return Response.json({ error: 'That organization name is already registered.' }, { status: 409 });
  }
}
