import { neon } from '@neondatabase/serverless';
import { neutralIssueCopyBySlug, neutralIssueSidebar } from '../lib/issue-copy';

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const sql = neon(connectionString);
const expectedSlugs = Object.keys(neutralIssueCopyBySlug).sort();
const issueRows = await sql`SELECT slug FROM issues ORDER BY slug`;
const databaseSlugs = issueRows.map((issue) => String(issue.slug)).sort();
const missingCopy = databaseSlugs.filter((slug) => !expectedSlugs.includes(slug));
const missingIssues = expectedSlugs.filter((slug) => !databaseSlugs.includes(slug));

if (missingCopy.length || missingIssues.length) {
  throw new Error([
    missingCopy.length ? `No neutral copy for database issues: ${missingCopy.join(', ')}` : '',
    missingIssues.length ? `No matching database issue for neutral copy: ${missingIssues.join(', ')}` : '',
  ].filter(Boolean).join('\n'));
}

const updates = Object.entries(neutralIssueCopyBySlug);
const results = await sql.transaction((transaction) => updates.map(([slug, copy]) => transaction`
  UPDATE issues
  SET
    detail = ${copy.detail},
    description = ${copy.description},
    sidebar = ${neutralIssueSidebar},
    updated_at = NOW()
  WHERE slug = ${slug}
  RETURNING slug
`));

const updatedSlugs = results.flatMap((rows) => rows.map((row) => String(row.slug))).sort();

if (updatedSlugs.join('\n') !== expectedSlugs.join('\n')) {
  throw new Error(`Expected to update ${expectedSlugs.length} issues but updated ${updatedSlugs.length}.`);
}

const verificationRows = await sql`
  SELECT slug, detail, description, sidebar
  FROM issues
  ORDER BY slug
`;

for (const row of verificationRows) {
  const slug = String(row.slug);
  const expected = neutralIssueCopyBySlug[slug as keyof typeof neutralIssueCopyBySlug];

  if (!expected || row.detail !== expected.detail || row.description !== expected.description || row.sidebar !== neutralIssueSidebar) {
    throw new Error(`Neutral issue copy verification failed for ${slug}.`);
  }
}

console.log(`Updated and verified neutral copy for ${updatedSlugs.length} issues.`);
