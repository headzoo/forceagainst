import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, check, customType, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

export * from './auth-schema';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const issueStatus = pgEnum('issue_status', ['active', 'planned']);
export const actionType = pgEnum('action_type', ['Petition', 'Lawsuit', 'Campaign']);
export const congressChamber = pgEnum('congress_chamber', ['house', 'senate']);

export type CongressDistrictOffice = {
  id?: string;
  address?: string;
  building?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  fax?: string;
  hours?: string;
  latitude?: number;
  longitude?: number;
};

export type CongressMemberSocialHandles = {
  twitter?: string;
  facebook?: string;
  youtube?: string;
  instagram?: string;
  tiktok?: string;
};

export const issues = pgTable('issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  detail: text('detail').notNull().default(''),
  description: text('description').notNull().default(''),
  status: issueStatus('status').notNull().default('planned'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orgs = pgTable('orgs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  website: text('website'),
  description: text('description').notNull().default(''),
  searchTsv: tsvector('search_tsv').generatedAlwaysAs(sql`
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  `),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('orgs_owner_user_unique').on(table.ownerUserId),
  uniqueIndex('orgs_slug_unique').on(table.slug),
  uniqueIndex('orgs_name_unique').on(table.name),
]);

export const actions = pgTable('actions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  issueId: bigint('issue_id', { mode: 'number' }).notNull().references(() => issues.id, { onDelete: 'cascade' }),
  orgId: bigint('org_id', { mode: 'number' }).notNull().references(() => orgs.id, { onDelete: 'restrict' }),
  submittedByUserId: text('submitted_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  automaticallyAdded: boolean('automatically_added').notNull().default(false),
  slug: text('slug').notNull(),
  type: actionType('type').notNull(),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  description: text('description').notNull().default(''),
  effort: text('effort').notNull(),
  href: text('href').notNull(),
  urgent: boolean('urgent').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  approved: boolean('approved').notNull().default(false),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedByUserId: text('approved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  published: boolean('published').notNull().default(false),
  startAt: timestamp('start_at', { withTimezone: true }),
  endAt: timestamp('end_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  searchTsv: tsvector('search_tsv').generatedAlwaysAs(sql`
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(detail, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  `),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('actions_issue_approved_published_idx').on(table.issueId, table.approved, table.published, table.sortOrder),
  index('actions_visibility_idx').on(table.approved, table.published, table.startAt, table.endAt, table.sortOrder),
  index('actions_issue_visibility_idx').on(table.issueId, table.approved, table.published, table.startAt, table.endAt, table.sortOrder),
  index('actions_org_visibility_idx').on(table.orgId, table.approved, table.published, table.startAt, table.endAt, table.sortOrder),
  index('actions_org_idx').on(table.orgId),
  index('actions_submitter_idx').on(table.submittedByUserId),
  uniqueIndex('actions_issue_slug_unique').on(table.issueId, table.slug),
  uniqueIndex('actions_issue_title_unique').on(table.issueId, table.title),
]);

export const actionLikes = pgTable('action_likes', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  actionId: bigint('action_id', { mode: 'number' }).notNull().references(() => actions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.actionId] }),
  index('action_likes_action_idx').on(table.actionId),
]);

export const actionComments = pgTable('action_comments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actionId: bigint('action_id', { mode: 'number' }).notNull().references(() => actions.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  parentId: bigint('parent_id', { mode: 'number' }),
  depth: integer('depth').notNull().default(0),
  body: text('body').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'action_comments_parent_id_action_comments_id_fk',
    columns: [table.parentId],
    foreignColumns: [table.id],
  }).onDelete('cascade'),
  check('action_comments_depth_check', sql`${table.depth} between 0 and 3`),
  check('action_comments_body_length_check', sql`char_length(${table.body}) between 1 and 2000`),
  index('action_comments_action_created_idx').on(table.actionId, table.createdAt),
  index('action_comments_parent_idx').on(table.parentId),
  index('action_comments_user_idx').on(table.userId),
]);

export const congressMembers = pgTable('congress_members', {
  bioguideId: text('bioguide_id').primaryKey(),
  firstName: text('first_name').notNull(),
  middleName: text('middle_name'),
  lastName: text('last_name').notNull(),
  suffix: text('suffix'),
  nickname: text('nickname'),
  officialFullName: text('official_full_name').notNull(),
  party: text('party').notNull(),
  chamber: congressChamber('chamber').notNull(),
  state: text('state').notNull(),
  district: integer('district'),
  senateClass: integer('senate_class'),
  senateRank: integer('senate_rank'),
  displayTitle: text('display_title').notNull(),
  officialWebsite: text('official_website'),
  contactFormUrl: text('contact_form_url'),
  capitolPhone: text('capitol_phone'),
  capitolOffice: text('capitol_office'),
  mailingAddress: text('mailing_address'),
  congressGovProfileUrl: text('congress_gov_profile_url'),
  officialImageUrl: text('official_image_url'),
  officialImageAttribution: text('official_image_attribution'),
  officialSocialHandles: jsonb('official_social_handles').$type<CongressMemberSocialHandles>(),
  districtOffices: jsonb('district_offices').$type<CongressDistrictOffice[]>(),
  isCurrent: boolean('is_current').notNull().default(true),
  providerUpdatedAt: timestamp('provider_updated_at', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('congress_members_current_chamber_state_district_idx').on(
    table.isCurrent,
    table.chamber,
    table.state,
    table.district,
  ),
  index('congress_members_current_state_idx').on(table.isCurrent, table.state),
  index('congress_members_current_roster_sort_idx').on(
    table.isCurrent,
    table.chamber,
    table.state,
    table.district,
    table.senateClass,
    table.lastName,
    table.firstName,
  ),
]);

export type Issue = typeof issues.$inferSelect;
export type Organization = typeof orgs.$inferSelect;
export type ActionRecord = typeof actions.$inferSelect;
export type ActionLike = typeof actionLikes.$inferSelect;
export type ActionComment = typeof actionComments.$inferSelect;
export type CongressMember = typeof congressMembers.$inferSelect;
export type CongressMemberInsert = typeof congressMembers.$inferInsert;
