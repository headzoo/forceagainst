import { neon } from '@neondatabase/serverless';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { issues } from '../db/schema';
import { neutralIssueCopyBySlug, neutralIssueSidebar } from '../lib/issue-copy';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

if (/^#{1,6}\s/m.test(neutralIssueSidebar)) {
  throw new Error('Markdown headers are not allowed in issue sidebars.');
}

const db = drizzle(neon(connectionString));
const issueRows = await db
  .select({ id: issues.id, slug: issues.slug })
  .from(issues)
  .orderBy(asc(issues.sortOrder), asc(issues.name));

const expectedSlugs = Object.keys(neutralIssueCopyBySlug);
const databaseSlugs = new Set(issueRows.map((issue) => issue.slug));
const missingContent = issueRows.filter((issue) => !expectedSlugs.includes(issue.slug)).map((issue) => issue.slug);
const missingIssues = expectedSlugs.filter((slug) => !databaseSlugs.has(slug));

if (missingContent.length || missingIssues.length) {
  throw new Error([
    missingContent.length ? `No neutral sidebar content for: ${missingContent.join(', ')}` : '',
    missingIssues.length ? `No matching database issue for: ${missingIssues.join(', ')}` : '',
  ].filter(Boolean).join('\n'));
}

const now = new Date();
for (const issue of issueRows) {
  await db
    .update(issues)
    .set({ sidebar: neutralIssueSidebar, updatedAt: now })
    .where(eq(issues.id, issue.id));
}

console.log(`Backfilled neutral sidebar Markdown for ${issueRows.length} issues.`);
