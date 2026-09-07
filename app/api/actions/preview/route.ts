import { analyzeActionHref, slugifyTitle } from '@/lib/action-metadata';
import { getMemberSession } from '@/lib/member';
import { getOrganizationMembership } from '@/lib/organization-membership';

export async function POST(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to analyze an action.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { organizationId?: unknown; href?: unknown } | null;
  const requestedOrganizationId = typeof body?.organizationId === 'number' ? body.organizationId : Number(body?.organizationId);
  if (!Number.isSafeInteger(requestedOrganizationId) || requestedOrganizationId <= 0) {
    return Response.json({ error: 'Choose an organization.' }, { status: 400 });
  }
  const organization = await getOrganizationMembership(
    session.user.id,
    requestedOrganizationId,
  );
  if (!organization) return Response.json({ error: 'Create or join an organization before submitting an action.' }, { status: 403 });

  const href = typeof body?.href === 'string' ? body.href.trim() : '';

  try {
    const metadata = await analyzeActionHref(href);
    return Response.json({ ...metadata, suggestedSlug: slugifyTitle(metadata.suggestedTitle) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'We could not analyze that page.' }, { status: 400 });
  }
}
