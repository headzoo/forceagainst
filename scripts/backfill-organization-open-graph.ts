import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { orgs } from '../db/schema';
import { analyzeWebsiteHref } from '../lib/action-metadata';
import { db } from '../lib/db';

const rows = await db
  .select({ id: orgs.id, name: orgs.name, website: orgs.website })
  .from(orgs)
  .where(and(isNotNull(orgs.website), isNull(orgs.openGraph)))
  .orderBy(orgs.id);

let updated = 0;
let withoutOpenGraph = 0;
const failures: Array<{ id: number; name: string; error: string }> = [];

for (const organization of rows) {
  try {
    const metadata = await analyzeWebsiteHref(organization.website!);
    if (!metadata.openGraph) {
      withoutOpenGraph += 1;
      console.log(`[no OpenGraph] ${organization.id} ${organization.name}`);
      continue;
    }

    const [updatedOrganization] = await db
      .update(orgs)
      .set({ website: metadata.href, openGraph: metadata.openGraph })
      .where(and(eq(orgs.id, organization.id), isNull(orgs.openGraph)))
      .returning({ id: orgs.id });
    if (!updatedOrganization) continue;
    updated += 1;
    console.log(`[updated] ${organization.id} ${organization.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    failures.push({ id: organization.id, name: organization.name, error: message });
    console.warn(`[failed] ${organization.id} ${organization.name}: ${message}`);
  }
}

console.log(JSON.stringify({ scanned: rows.length, updated, withoutOpenGraph, failures }, null, 2));
