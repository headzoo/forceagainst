import { and, eq, isNull } from 'drizzle-orm';
import { actions } from '../db/schema';
import { analyzeActionHref } from '../lib/action-metadata';
import { db } from '../lib/db';

const rows = await db
  .select({ id: actions.id, title: actions.title, href: actions.href })
  .from(actions)
  .where(isNull(actions.openGraph))
  .orderBy(actions.id);

let updated = 0;
let withoutOpenGraph = 0;
const failures: Array<{ id: number; title: string; error: string }> = [];

for (const action of rows) {
  try {
    const metadata = await analyzeActionHref(action.href);
    if (!metadata.openGraph) {
      withoutOpenGraph += 1;
      console.log(`[no OpenGraph] ${action.id} ${action.title}`);
      continue;
    }

    const [updatedAction] = await db
      .update(actions)
      .set({ openGraph: metadata.openGraph })
      .where(and(eq(actions.id, action.id), isNull(actions.openGraph)))
      .returning({ id: actions.id });
    if (!updatedAction) continue;
    updated += 1;
    console.log(`[updated] ${action.id} ${action.title}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    failures.push({ id: action.id, title: action.title, error: message });
    console.warn(`[failed] ${action.id} ${action.title}: ${message}`);
  }
}

console.log(JSON.stringify({ scanned: rows.length, updated, withoutOpenGraph, failures }, null, 2));
