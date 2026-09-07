import { and, eq } from 'drizzle-orm';
import { actions, issues, organizationMembers } from '@/db/schema';
import { analyzeActionHref, parsePublicHttpUrl } from '@/lib/action-metadata';
import { db } from '@/lib/db';
import { parseGovernmentActionFields } from '@/lib/government-action-context';
import { getMemberSession } from '@/lib/member';
import { uniqueActionSlug } from '@/lib/slugs';

const actionTypes = ['Petition', 'Lawsuit', 'Campaign'] as const;

function parseActionId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getModeratedAction(id: number, userId: string) {
  const [action] = await db
    .select({
      id: actions.id,
      issueId: actions.issueId,
      slug: actions.slug,
      type: actions.type,
      title: actions.title,
      detail: actions.detail,
      description: actions.description,
      governmentSubject: actions.governmentSubject,
      governmentBackground: actions.governmentBackground,
      governmentRequest: actions.governmentRequest,
      href: actions.href,
      openGraph: actions.openGraph,
      effort: actions.effort,
      approved: actions.approved,
      published: actions.published,
    })
    .from(actions)
    .innerJoin(organizationMembers, eq(actions.orgId, organizationMembers.organizationId))
    .where(and(eq(actions.id, id), eq(organizationMembers.userId, userId)))
    .limit(1);

  return action;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to edit an action.' }, { status: 401 });

  const { id: value } = await context.params;
  const id = parseActionId(value);
  if (!id) return Response.json({ error: 'Invalid action.' }, { status: 400 });

  const action = await getModeratedAction(id, session.user.id);
  if (!action) return Response.json({ error: 'Action not found.' }, { status: 404 });

  return Response.json({ action });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to edit an action.' }, { status: 401 });

  const { id: value } = await context.params;
  const id = parseActionId(value);
  if (!id) return Response.json({ error: 'Invalid action.' }, { status: 400 });

  const existing = await getModeratedAction(id, session.user.id);
  if (!existing) return Response.json({ error: 'Action not found.' }, { status: 404 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const issueId = typeof body?.issueId === 'number' ? body.issueId : Number(body?.issueId);
  const type = typeof body?.type === 'string' ? body.type : '';
  const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const detail = typeof body?.detail === 'string' ? body.detail.trim().replace(/\s+/g, ' ') : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const hrefInput = typeof body?.href === 'string' ? body.href.trim() : '';
  const governmentFields = parseGovernmentActionFields(body);

  if (!Number.isSafeInteger(issueId) || issueId < 1) return Response.json({ error: 'Choose an issue.' }, { status: 400 });
  if (!actionTypes.includes(type as (typeof actionTypes)[number])) return Response.json({ error: 'Choose a valid action type.' }, { status: 400 });
  if (title.length < 6 || title.length > 180) return Response.json({ error: 'Title must be between 6 and 180 characters.' }, { status: 400 });
  if (detail.length < 20 || detail.length > 600) return Response.json({ error: 'Summary must be between 20 and 600 characters.' }, { status: 400 });
  if (description.length < 20 || description.length > 1_000_000) return Response.json({ error: 'Description must be between 20 and 1,000,000 characters.' }, { status: 400 });
  if ('error' in governmentFields) return Response.json({ error: governmentFields.error }, { status: 400 });

  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, issueId), eq(issues.status, 'active')))
    .limit(1);
  if (!issue) return Response.json({ error: 'That issue is not accepting actions.' }, { status: 400 });

  let parsedHref: string;
  try {
    parsedHref = parsePublicHttpUrl(hrefInput).toString();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Enter a valid action URL.' }, { status: 400 });
  }

  const urlChanged = parsedHref !== existing.href;
  let href = existing.href;
  let effort = existing.effort;
  let openGraph = existing.openGraph;

  if (urlChanged) {
    try {
      const metadata = await analyzeActionHref(parsedHref);
      href = metadata.href;
      effort = metadata.effort;
      openGraph = metadata.openGraph;
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : 'We could not verify that page.' }, { status: 400 });
    }
  }

  try {
    const slug = await uniqueActionSlug(issueId, existing.slug, id);
    const [action] = await db
      .update(actions)
      .set({
        issueId,
        slug,
        type: type as (typeof actionTypes)[number],
        title,
        detail,
        description,
        ...governmentFields,
        href,
        effort,
        openGraph,
        ...(urlChanged ? {
          approved: false,
          approvedAt: null,
          approvedByUserId: null,
          published: false,
          verified: false,
          verifiedAt: null,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(actions.id, id))
      .returning({
        id: actions.id,
        title: actions.title,
        href: actions.href,
        effort: actions.effort,
        approved: actions.approved,
        published: actions.published,
      });

    return Response.json({ action, needsReapproval: urlChanged });
  } catch {
    return Response.json({ error: 'An action with that title already exists for this issue.' }, { status: 409 });
  }
}
