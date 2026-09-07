import { neon } from '@neondatabase/serverless';
import { and, asc, count, desc, eq, exists, getTableColumns, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/db/schema';
import {
  actionComments,
  actionLikes,
  actions,
  commentReports,
  commentUserBlocks,
  congressMembers,
  issues,
  orgs,
  user,
  type ActionRecord,
  type CongressDistrictOffice,
  type CongressMember,
  type CongressMemberSocialHandles,
  type Issue,
} from '@/db/schema';
import type { ActionCommentView } from '@/lib/action-comments';

export type {
  ActionRecord,
  CongressDistrictOffice,
  CongressMember,
  CongressMemberSocialHandles,
  Issue,
  Organization,
} from '@/db/schema';

const { searchTsv: _actionsSearchTsv, ...actionColumns } = getTableColumns(actions);
void _actionsSearchTsv;

export type PublicAction = Omit<ActionRecord, 'searchTsv'>;
export type DirectoryAction = PublicAction & { organization: string; organizationSlug: string; issueSlug: string };
export type LikedAction = DirectoryAction & { issue: string; likedAt: Date };
export type UserComment = {
  id: number;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
  actionTitle: string;
  actionSlug: string;
  issueSlug: string;
};
export type UserCommentsPage = {
  comments: UserComment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type PublishedOrganization = {
  id: number;
  slug: string;
  name: string;
  avatar: string | null;
  website: string | null;
  openGraph: schema.OpenGraphMetadata | null;
  description: string;
  sidebar: string;
  actions: Array<PublicAction & { issue: string; issueSlug: string }>;
};

export type OrganizationDirectoryItem = {
  id: number;
  slug: string;
  name: string;
  avatar: string | null;
  website: string | null;
  description: string;
  actionCount: number;
};

export type PublishedIssue = Issue & {
  actions: DirectoryAction[];
};

export type SearchActionResult = {
  id: number;
  slug: string;
  issueSlug: string;
  title: string;
  type: PublicAction['type'];
  detail: string;
  organization: string;
  issue: string;
};

export type SearchOrganizationResult = {
  id: number;
  slug: string;
  name: string;
  description: string;
};

export type SearchResults = {
  actions: SearchActionResult[];
  organizations: SearchOrganizationResult[];
};

export type PublicCongressMember = {
  bioguideId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  nickname: string | null;
  officialFullName: string;
  party: string;
  chamber: CongressMember['chamber'];
  state: string;
  district: number | null;
  senateClass: number | null;
  senateRank: number | null;
  displayTitle: string;
  officialWebsite: string | null;
  contactFormUrl: string | null;
  capitolPhone: string | null;
  capitolOffice: string | null;
  mailingAddress: string | null;
  congressGovProfileUrl: string | null;
  officialImageUrl: string | null;
  officialImageAttribution: string | null;
  officialSocialHandles: CongressMemberSocialHandles | null;
  districtOffices: CongressDistrictOffice[] | null;
};

export type CongressMembersByJurisdiction = {
  senators: PublicCongressMember[];
  representative: PublicCongressMember | null;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured. Connect the site to Neon or add it to the local environment.');
}

export const db = drizzle(neon(connectionString), { schema });

const congressMemberPublicColumns = {
  bioguideId: congressMembers.bioguideId,
  firstName: congressMembers.firstName,
  middleName: congressMembers.middleName,
  lastName: congressMembers.lastName,
  suffix: congressMembers.suffix,
  nickname: congressMembers.nickname,
  officialFullName: congressMembers.officialFullName,
  party: congressMembers.party,
  chamber: congressMembers.chamber,
  state: congressMembers.state,
  district: congressMembers.district,
  senateClass: congressMembers.senateClass,
  senateRank: congressMembers.senateRank,
  displayTitle: congressMembers.displayTitle,
  officialWebsite: congressMembers.officialWebsite,
  contactFormUrl: congressMembers.contactFormUrl,
  capitolPhone: congressMembers.capitolPhone,
  capitolOffice: congressMembers.capitolOffice,
  mailingAddress: congressMembers.mailingAddress,
  congressGovProfileUrl: congressMembers.congressGovProfileUrl,
  officialImageUrl: congressMembers.officialImageUrl,
  officialImageAttribution: congressMembers.officialImageAttribution,
  officialSocialHandles: congressMembers.officialSocialHandles,
  districtOffices: congressMembers.districtOffices,
};

function currentCongressMemberCondition() {
  return eq(congressMembers.isCurrent, true);
}

const congressChamberSortOrder = sql<number>`CASE ${congressMembers.chamber} WHEN 'senate' THEN 0 ELSE 1 END`;

export async function getCurrentCongressMembers(): Promise<PublicCongressMember[]> {
  return db
    .select(congressMemberPublicColumns)
    .from(congressMembers)
    .where(currentCongressMemberCondition())
    .orderBy(
      asc(congressChamberSortOrder),
      asc(congressMembers.state),
      asc(congressMembers.district),
      asc(congressMembers.senateClass),
      asc(congressMembers.senateRank),
      asc(congressMembers.lastName),
      asc(congressMembers.firstName),
    );
}

export async function getCurrentCongressMemberByBioguideId(
  bioguideId: string,
): Promise<PublicCongressMember | null> {
  const [member] = await db
    .select(congressMemberPublicColumns)
    .from(congressMembers)
    .where(and(
      currentCongressMemberCondition(),
      eq(congressMembers.bioguideId, bioguideId),
    ))
    .limit(1);

  return member ?? null;
}

export async function getCongressMembersByJurisdiction(
  state: string,
  district: number,
): Promise<CongressMembersByJurisdiction> {
  const [senators, houseMembers] = await Promise.all([
    db
      .select(congressMemberPublicColumns)
      .from(congressMembers)
      .where(and(
        currentCongressMemberCondition(),
        eq(congressMembers.chamber, 'senate'),
        eq(congressMembers.state, state),
      ))
      .orderBy(
        asc(congressMembers.senateRank),
        asc(congressMembers.senateClass),
        asc(congressMembers.lastName),
        asc(congressMembers.firstName),
      ),
    db
      .select(congressMemberPublicColumns)
      .from(congressMembers)
      .where(and(
        currentCongressMemberCondition(),
        eq(congressMembers.chamber, 'house'),
        eq(congressMembers.state, state),
        eq(congressMembers.district, district),
      ))
      .limit(1),
  ]);

  return {
    senators,
    representative: houseMembers[0] ?? null,
  };
}

export function publicActionVisibilityCondition() {
  const now = sql<Date>`now()`;
  return and(
    eq(actions.approved, true),
    eq(actions.published, true),
    or(isNull(actions.startAt), lte(actions.startAt, now)),
    or(isNull(actions.endAt), gte(actions.endAt, now)),
  );
}

export async function getDirectoryData() {
  const [issueRows, actionRows] = await Promise.all([
    db.select().from(issues).orderBy(asc(issues.sortOrder), asc(issues.name)),
    db
      .select({ ...actionColumns, organization: orgs.name, organizationSlug: orgs.slug, issueSlug: issues.slug })
      .from(actions)
      .innerJoin(orgs, eq(actions.orgId, orgs.id))
      .innerJoin(issues, eq(actions.issueId, issues.id))
      .where(publicActionVisibilityCondition())
      .orderBy(desc(actions.urgent), asc(actions.sortOrder), asc(actions.title)),
  ]);

  return {
    issues: issueRows as Issue[],
    actions: actionRows as DirectoryAction[],
  };
}

export async function getLikedActions(userId: string): Promise<LikedAction[]> {
  return db
    .select({
      ...actionColumns,
      organization: orgs.name,
      organizationSlug: orgs.slug,
      issue: issues.name,
      issueSlug: issues.slug,
      likedAt: actionLikes.createdAt,
    })
    .from(actionLikes)
    .innerJoin(actions, eq(actionLikes.actionId, actions.id))
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actionLikes.userId, userId),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actionLikes.createdAt));
}

export async function getUserComments(userId: string, requestedPage: number, pageSize = 10): Promise<UserCommentsPage> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(actionComments)
    .where(eq(actionComments.userId, userId));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const comments = await db
    .select({
      id: actionComments.id,
      body: actionComments.body,
      deletedAt: actionComments.deletedAt,
      createdAt: actionComments.createdAt,
      actionTitle: actions.title,
      actionSlug: actions.slug,
      issueSlug: issues.slug,
    })
    .from(actionComments)
    .innerJoin(actions, eq(actionComments.actionId, actions.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(eq(actionComments.userId, userId))
    .orderBy(desc(actionComments.createdAt), desc(actionComments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { comments, page, pageSize, total, totalPages };
}

export async function getActiveIssues() {
  return db
    .select({ id: issues.id, name: issues.name, slug: issues.slug })
    .from(issues)
    .where(eq(issues.status, 'active'))
    .orderBy(asc(issues.sortOrder), asc(issues.name));
}

export async function getIssueDirectory() {
  return db
    .select({
      id: issues.id,
      slug: issues.slug,
      name: issues.name,
      detail: issues.detail,
    })
    .from(issues)
    .orderBy(asc(issues.sortOrder), asc(issues.name));
}

export async function getPublishedAction(id: number) {
  const [action] = await db
    .select({
      ...actionColumns,
      organization: orgs.name,
      organizationSlug: orgs.slug,
      issue: issues.name,
      issueSlug: issues.slug,
      issueDetail: issues.detail,
    })
    .from(actions)
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.id, id),
      publicActionVisibilityCondition(),
    ))
    .limit(1);

  return action;
}

export async function getPublishedActionBySlugs(issueSlug: string, actionSlug: string) {
  const [action] = await db
    .select({
      ...actionColumns,
      organization: orgs.name,
      organizationSlug: orgs.slug,
      issue: issues.name,
      issueSlug: issues.slug,
      issueDetail: issues.detail,
    })
    .from(actions)
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(issues.slug, issueSlug),
      eq(actions.slug, actionSlug),
      publicActionVisibilityCondition(),
    ))
    .limit(1);

  return action;
}

export async function getActionComments(actionId: number, viewerId: string | null = null): Promise<ActionCommentView[]> {
  const [rows, blockedRows, reportedRows] = await Promise.all([
    db
    .select({
      id: actionComments.id,
      actionId: actionComments.actionId,
      parentId: actionComments.parentId,
      depth: actionComments.depth,
      body: actionComments.body,
      moderationStatus: actionComments.moderationStatus,
      deletedAt: actionComments.deletedAt,
      createdAt: actionComments.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorUsername: user.username,
      authorImage: user.image,
    })
    .from(actionComments)
    .leftJoin(user, eq(actionComments.userId, user.id))
    .where(eq(actionComments.actionId, actionId))
    .orderBy(asc(actionComments.createdAt), asc(actionComments.id)),
    viewerId
      ? db.select({ userId: commentUserBlocks.blockedUserId }).from(commentUserBlocks)
        .where(eq(commentUserBlocks.blockerUserId, viewerId))
      : Promise.resolve([]),
    viewerId
      ? db.select({ commentId: commentReports.commentId }).from(commentReports)
        .where(and(eq(commentReports.reporterUserId, viewerId), eq(commentReports.actionId, actionId)))
      : Promise.resolve([]),
  ]);

  const blockedUserIds = new Set(blockedRows.map((row) => row.userId));
  const reportedCommentIds = new Set(reportedRows.map((row) => row.commentId));

  return rows.map((row) => {
    const visibility = row.deletedAt !== null
      ? 'user_deleted' as const
      : row.moderationStatus === 'under_review'
        ? 'under_review' as const
        : row.moderationStatus === 'removed'
          ? 'removed' as const
          : row.authorId && blockedUserIds.has(row.authorId)
            ? 'blocked' as const
            : 'visible' as const;
    const showAuthor = visibility === 'visible' || visibility === 'blocked';
    return {
      id: row.id,
      actionId: row.actionId,
      parentId: row.parentId,
      depth: row.depth,
      body: visibility === 'visible' || visibility === 'blocked' ? row.body : null,
      visibility,
      reportedByViewer: reportedCommentIds.has(row.id),
      createdAt: row.createdAt.toISOString(),
      author: !showAuthor || !row.authorId || !row.authorName || !row.authorUsername
        ? null
        : {
          id: row.authorId,
          name: row.authorName,
          username: row.authorUsername,
          image: row.authorImage,
        },
    };
  });
}

export async function getPublishedIssue(slug: string): Promise<PublishedIssue | undefined> {
  const issue = await getIssueBySlug(slug);

  if (!issue) return undefined;

  const actionRows = await db
    .select({ ...actionColumns, organization: orgs.name, organizationSlug: orgs.slug, issueSlug: issues.slug })
    .from(actions)
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.issueId, issue.id),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actions.urgent), asc(actions.sortOrder), asc(actions.title));

  return { ...issue, actions: actionRows };
}

export async function getIssueBySlug(slug: string) {
  const [issue] = await db.select().from(issues).where(eq(issues.slug, slug)).limit(1);
  return issue;
}

export async function getPublishedOrganization(id: number): Promise<PublishedOrganization | undefined> {
  const organization = await getOrganizationById(id);

  if (!organization) return undefined;

  const actionRows = await db
    .select({ ...actionColumns, issue: issues.name, issueSlug: issues.slug })
    .from(actions)
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.orgId, id),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actions.urgent), asc(actions.sortOrder), asc(actions.title));

  return { ...organization, actions: actionRows };
}

export async function getPublishedOrganizationBySlug(slug: string): Promise<PublishedOrganization | undefined> {
  const organization = await getOrganizationBySlug(slug);

  if (!organization) return undefined;

  const actionRows = await db
    .select({ ...actionColumns, issue: issues.name, issueSlug: issues.slug })
    .from(actions)
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.orgId, organization.id),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actions.urgent), asc(actions.sortOrder), asc(actions.title));

  return { ...organization, actions: actionRows };
}

export async function getOrganizationDirectory(): Promise<OrganizationDirectoryItem[]> {
  const [organizationRows, actionCountRows] = await Promise.all([
    db
      .select({ id: orgs.id, slug: orgs.slug, name: orgs.name, avatar: orgs.avatar, website: orgs.website, description: orgs.description })
      .from(orgs)
      .orderBy(asc(orgs.name)),
    db
      .select({ organizationId: actions.orgId, actionCount: count() })
      .from(actions)
      .where(publicActionVisibilityCondition())
      .groupBy(actions.orgId),
  ]);
  const actionCounts = new Map(actionCountRows.map((row) => [row.organizationId, row.actionCount]));

  return organizationRows.map((organization) => ({
    ...organization,
    actionCount: actionCounts.get(organization.id) ?? 0,
  }));
}

const organizationPublicColumns = {
  id: orgs.id,
  slug: orgs.slug,
  name: orgs.name,
  avatar: orgs.avatar,
  website: orgs.website,
  openGraph: orgs.openGraph,
  description: orgs.description,
  sidebar: orgs.sidebar,
  createdAt: orgs.createdAt,
  updatedAt: orgs.updatedAt,
};

export async function getOrganizationById(id: number) {
  const [organization] = await db.select(organizationPublicColumns).from(orgs).where(eq(orgs.id, id)).limit(1);
  return organization;
}

export async function getOrganizationBySlug(slug: string) {
  const [organization] = await db.select(organizationPublicColumns).from(orgs).where(eq(orgs.slug, slug)).limit(1);
  return organization;
}

export async function getRecentPublishedActionsForIssue(issueId: number) {
  return db
    .select({ ...actionColumns, organization: orgs.name, organizationSlug: orgs.slug, issueSlug: issues.slug })
    .from(actions)
    .innerJoin(orgs, eq(actions.orgId, orgs.id))
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.issueId, issueId),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actions.createdAt))
    .limit(20);
}

export async function getRecentPublishedActionsForOrganization(organizationId: number) {
  return db
    .select({ ...actionColumns, issue: issues.name, issueSlug: issues.slug })
    .from(actions)
    .innerJoin(issues, eq(actions.issueId, issues.id))
    .where(and(
      eq(actions.orgId, organizationId),
      publicActionVisibilityCondition(),
    ))
    .orderBy(desc(actions.createdAt))
    .limit(20);
}

export async function searchPublishedContent(query: string): Promise<SearchResults> {
  const actionScore = sql<number>`${actions.searchTsv} <@> to_bm25query(to_tsvector('english', ${query}), 'actions_search_bm25'::regclass)`;
  const orgScore = sql<number>`${orgs.searchTsv} <@> to_bm25query(to_tsvector('english', ${query}), 'orgs_search_bm25'::regclass)`;

  const publishedAction = exists(
    db
      .select({ id: sql`1` })
      .from(actions)
      .where(and(
        eq(actions.orgId, orgs.id),
        publicActionVisibilityCondition(),
      )),
  );

  const [actionRows, organizationRows] = await Promise.all([
    db
      .select({
        id: actions.id,
        slug: actions.slug,
        issueSlug: issues.slug,
        title: actions.title,
        type: actions.type,
        detail: actions.detail,
        organization: orgs.name,
        issue: issues.name,
        score: actionScore,
      })
      .from(actions)
      .innerJoin(orgs, eq(actions.orgId, orgs.id))
      .innerJoin(issues, eq(actions.issueId, issues.id))
      .where(publicActionVisibilityCondition())
      .orderBy(asc(actionScore))
      .limit(8),
    db
      .select({
        id: orgs.id,
        slug: orgs.slug,
        name: orgs.name,
        description: orgs.description,
        score: orgScore,
      })
      .from(orgs)
      .where(publishedAction)
      .orderBy(asc(orgScore))
      .limit(5),
  ]);

  return {
    actions: actionRows.map(({ score, ...row }) => { void score; return row; }),
    organizations: organizationRows.map(({ score, description, ...row }) => {
      void score;
      return {
        ...row,
        description: description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description,
      };
    }),
  };
}
