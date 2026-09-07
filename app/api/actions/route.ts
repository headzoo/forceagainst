import { and, eq } from 'drizzle-orm';
import { actions, issues, orgs } from '@/db/schema';
import { analyzeActionHref } from '@/lib/action-metadata';
import { db } from '@/lib/db';
import { parseGovernmentActionFields } from '@/lib/government-action-context';
import { getMemberSession } from '@/lib/member';
import { uniqueActionSlug } from '@/lib/slugs';

const actionTypes = ['Petition', 'Lawsuit', 'Campaign'] as const;

export async function POST(request: Request) {
  const session = await getMemberSession();
  if (!session) return Response.json({ error: 'Sign in to submit an action.' }, { status: 401 });

  const [organization] = await db.select().from(orgs).where(eq(orgs.ownerUserId, session.user.id)).limit(1);
  if (!organization) return Response.json({ error: 'Create your organization before submitting an action.' }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const issueId = typeof body?.issueId === 'number' ? body.issueId : Number(body?.issueId);
  const type = typeof body?.type === 'string' ? body.type : '';
  const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
  const detail = typeof body?.detail === 'string' ? body.detail.trim().replace(/\s+/g, ' ') : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const href = typeof body?.href === 'string' ? body.href.trim() : '';
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

  let metadata;
  try {
    metadata = await analyzeActionHref(href);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'We could not verify that page.' }, { status: 400 });
  }

  try {
    const [action] = await db.insert(actions).values({
      issueId,
      orgId: organization.id,
      submittedByUserId: session.user.id,
      slug: await uniqueActionSlug(issueId, title),
      type: type as (typeof actionTypes)[number],
      title,
      detail,
      description,
      ...governmentFields,
      effort: metadata.effort,
      href: metadata.href,
      openGraph: metadata.openGraph,
      approved: false,
      published: false,
    }).returning({ id: actions.id, slug: actions.slug, title: actions.title });

    return Response.json({ action, message: 'Your action was submitted for admin approval.' }, { status: 201 });
  } catch {
    return Response.json({ error: 'An action with that title already exists for this issue.' }, { status: 409 });
  }
}
