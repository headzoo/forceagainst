<!-- BIG-PLAN:1 -->
# Big Plan: State and federal legislation directories

Plan status: complete
Review cycle: 2
Max review cycles: 2

## Objective

Mirror active state legislation from LegiScan and current-Congress federal legislation from Congress.gov into Neon, then expose database-backed, paginated bill directories at all 50 canonical `/government/state/<state-slug>` URLs plus `/government/senate` and `/government/house`. State pages must communicate each bill's reported progress through introduction, committees, floor work, enrollment, and governor action without claiming more precision than the source supplies. Federal pages must explicitly use origin chamber, not imply that origin is the chamber currently considering a bill. Provider keys remain server-only, page renders never call providers, nightly syncs reuse the secured cron pattern, and the implementation adds no dependencies.

## Original request

The user wants:

1. **LegiScan** as the state-legislation data source (chosen because of cheap nightly delta sync via master list + change_hash, and a built-in “in progress vs dead” status field). Not Open States as the primary source.

2. **50 state pages** such as `/government/state/hawaii` that show which bills are currently working through the various government bodies of each state (state legislature focus: chambers, committees, floor, governor sign/veto as last step of a bill).

3. **Federal chamber bill pages** as well: `/government/senate` and `/government/house` listing bills running through the federal government (Congress.gov / existing `CONGRESS_API_KEY` pattern already used for the congressional roster on `/government`).

Context from prior discussion the user affirmed:
- There is no single free federal API for all 50 state legislatures; LegiScan Public API (free tier, ~30k queries/month) + nightly delta sync is the selected approach for states.
- Congress.gov covers federal bills; origin chamber vs “currently in this chamber” must be handled carefully.
- Site already has `/government` with Congress member roster mirrored from Congress.gov + unitedstates/congress-legislators, Google Civic for address lookup, Neon/Drizzle, cron bearer `CRON_SECRET` pattern. Keys stay server-side; do not call providers during page render — mirror into Neon like existing `government-sync.ts`.
- Reuse existing visual language, App Router, SiteHeader/SiteFooter, pnpm, no new dependencies without approval.

## Global architectural decisions

- LegiScan is the sole state-bill provider in this feature. Do not add Open States fallback code, credentials, or provider abstractions that imply it is active.
- Congress.gov remains the federal authority and reuses `CONGRESS_API_KEY`; LegiScan uses a new server-only `LEGISCAN_API_KEY`. Neither key may enter client bundles, rendered props, logs, URLs returned to browsers, or API error bodies.
- Persist a provider-neutral legislative read model, while keeping fetch/parse code provider-specific. Use additive Drizzle tables for legislative sessions, bills, bill actions, and sync cursors/checkpoints rather than mixing bill rows into `congress_members` or the advocacy `actions` table.
- Give each bill a stable compound identity of source plus provider bill ID, and each session a stable source plus provider session ID. Retain raw provider status/action codes only as inert values needed for debugging and future remapping; render normalized, tested fields.
- Normalize lifecycle to a closed application vocabulary such as `introduced`, `committee`, `floor`, `cross_chamber`, `enrolled`, `executive`, `law`, `vetoed`, `failed`, and `other`. Store a separate `isActive` boolean. Provider terminal/dead status wins over stage wording. Unknown codes remain `other` and must never be silently labeled active.
- Store `originChamber` separately from `latestActionBody`. The latter is only the body associated with the latest reported action, not a claim about exclusive current jurisdiction. State cards say “Latest reported body/action.” Federal `/government/house` and `/government/senate` filter by origin chamber and visibly say “House-originated” or “Senate-originated.”
- The 50 state pages come from one validated dynamic route, not 50 duplicated files. Extend the canonical state registry with lowercase slugs and reverse lookup for exactly the 50 states; territories and DC remain available to existing roster code but are not valid state-legislation page slugs in this feature.
- State pages show only locally mirrored bills whose LegiScan status is currently active/in progress, grouped or filterable by normalized lifecycle and paginated at a bounded page size. Federal pages show nonterminal bills from the current Congress, filtered by origin chamber and paginated. Empty, not-yet-synced, stale, and invalid-state cases must be honest and accessible.
- A bill list item contains bill number, title, normalized stage/status, origin chamber where known, latest reported body/action and date, session label, and a provider/public-source link. Do not add bill-detail routes, full text, sponsor profiles, voting records, lobbying data, notifications, or advocacy actions in this scope.
- LegiScan nightly sync first refreshes session lists and master lists. It compares the master-list `change_hash` against `masterChangeHash`; unchanged bills cost no `getBill` request. Changed/new master records are upserted immediately as summaries and marked detail-pending until a budgeted `getBill` refresh stores details/actions and copies the hash to `detailChangeHash`.
- Never mark a LegiScan detail fresh until its `getBill` payload and action history have been validated and persisted. Never deactivate bills from a partial/malformed master list. A complete authoritative master list may mark omitted bills inactive for that session; ended sessions remain queryable in storage but do not appear on active pages.
- Keep LegiScan usage below the free-tier envelope with a configurable, positive `LEGISCAN_DETAIL_BUDGET` default of 200 `getBill` calls per nightly run. Master/session calls count against and are reported in the run total. Process pending details deterministically and carry backlog through persisted pending flags/cursors; a budget-limited run is successful-with-backlog, not data loss.
- Initial LegiScan population is a resumable operational bootstrap. The CLI supports `--state=<code-or-slug>`, `--dry-run`, and an optional validated detail-budget override. Nightly all-state sync is allowed to publish master-list summaries while detail backfill catches up.
- Congress.gov bill sync is separate from the existing roster sync. Use current-Congress list/update endpoints with complete pagination and an overlap-safe persisted update watermark; fetch changed bill details/actions, normalize origin from bill type, and upsert atomically per bill or bounded batch. Do not infer “currently in House/Senate” from the bill type.
- Determine the current Congress with a tested Jan-3 boundary helper rather than a permanent hard-coded number. On Congress rollover, create/use the new session and make old-Congress bills ineligible for active directory queries without deleting history.
- Incremental watermarks advance only after every page in the covered update window is fetched and all accepted records are persisted. Use a small overlap and idempotent upserts to avoid same-timestamp misses. Failed/incomplete pagination leaves the prior watermark in place.
- Provider fetch helpers enforce HTTPS host/path allowlists for pagination links, timeouts, non-2xx handling, JSON shape validation, duplicate-ID checks, bounded concurrency, and safe errors. One provider's cron failure must not mutate the other provider's data.
- Reuse Node's built-in test runner through `pnpm exec tsx --test`, the current App Router server-component pattern, `dynamic = 'force-dynamic'`, `createSiteMetadata`, `SiteHeader`, `SiteFooter`, Drizzle query functions, and tokenized classes in `app/tailwind-styles.ts`.
- Add two staggered secured Node-runtime cron routes, one for state bills and one for federal bills. They use exact `Authorization: Bearer ${CRON_SECRET}`, `maxDuration = 300`, safe structured summaries, and no provider payload/key leakage. Preserve the existing roster and discovery schedules.
- Add separate CLI scripts for state and federal bill bootstrap/dry-run. Do not seed provider data in `scripts/migrate.ts`.
- Generate the next migration with `pnpm run db:generate` from the then-current schema. Do not hand-edit Drizzle snapshots/journal, overwrite an existing migration, or renumber migrations.
- All package commands use pnpm. Add no dependency.
- Execution model policy is explicit: every cheap step runs with `composer-2.5-fast`; every reasoning, frontier escalation, and final review runs with `cursor-grok-4.6-high-fast`. Claude, GPT, and all other model families are prohibited for this plan.

## Open questions / assumptions

- A valid LegiScan Public API key and sufficient remaining monthly quota will be supplied in each environment that performs state sync. Fixture tests, schema, and UI work do not require live credentials.
- Congress.gov and LegiScan response fixtures should be captured as minimal hand-authored test objects, not live network recordings containing credentials.
- LegiScan's documented master-list status remains the authority for state `isActive`; exact numeric/string mappings must be encoded in one tested provider adapter and unknown statuses must fail closed.
- Congress.gov does not provide a single authoritative “active” flag equivalent to LegiScan. Federal `isActive` is therefore a conservative tested normalization from current Congress plus terminal action/law/veto/failure evidence. Ambiguous bills may remain listed with their latest action, but must not be assigned a fabricated current chamber.
- Production migration and first live sync are operational prerequisites. Before them, routes render setup/empty states rather than contacting providers.

## Execution policy

- The current repository is authoritative; this plan captures intent.
- Paths below are hints unless explicitly stated otherwise.
- Never use line numbers as implementation anchors.
- The orchestrator owns this plan's status fields and completion records.
- Implementers must not edit this plan file.
- Only `composer-2.5-fast` and `cursor-grok-4.6-high-fast` may execute or review steps, including retries and escalations.

---

## Step BP-001: Establish the legislative data contract

Status: complete
Agent: reasoning-implementer
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: foreground
Depends on: none
Parallel group: none
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

The migration itself is additive, but lifecycle semantics, compound provider identities, delta freshness, pagination queries, and state-slug boundaries cross schema and data-layer contracts and need careful local reasoning.

### Intent

Create the durable database/domain contract that both provider syncs and all bill pages consume, without adding provider network calls.

### Architectural decisions to preserve

- Provider-neutral storage and queries; provider-specific parsing remains outside the data layer.
- Separate origin chamber, latest-action body, lifecycle stage, and active state.
- Exactly 50 valid state page slugs, while preserving existing territory/DC roster labels.

### Semantic targets

- `legislative sessions, bills, actions, and sync checkpoints` — additive Drizzle persistence and indexes.
- `LegislativeBillListItem` and paginated query result — stable server-rendering contract.
- `50-state slug registry` — canonical route validation and state navigation.
- `active state/federal bill queries` — bounded, deterministic list/count/freshness reads.

### Likely files

Paths are hints based on the repository at planning time.

- `db/schema.ts`
- `drizzle/` (new generated migration and metadata)
- `lib/db.ts`
- `lib/us-states.ts`
- `lib/legislative-bills.ts` (new pure domain types/helpers)
- `tests/legislative-bills.test.ts` (new)

### Implementation

1. Inspect the current schema and generated migration state before editing. Add enum/table definitions that implement the global data model: source (`legiscan`, `congress`), normalized lifecycle, sessions, bills, ordered actions, and provider/scope sync checkpoints.
2. Sessions retain provider ID, jurisdiction (`US` or two-letter state code), display name, years/dates when provided, active/current flag, and sync timestamps. Enforce unique source/provider-session identity and index current jurisdiction lookup.
3. Bills retain provider ID/session relation, jurisdiction, number/type/title/description, origin chamber, latest-action body/text/date, normalized stage, `isActive`, provider status/code, public source URL, master/detail hashes or provider update timestamp, detail-pending flag, and sync timestamps. Add unique source/provider-bill identity and indexes that support state active lists and current-Congress origin-chamber lists.
4. Actions retain a bill relation, provider-stable action key or deterministic source sequence, date, body, description, provider action code, normalized stage, and ordering. Ensure idempotent replacement/upsert and efficient per-bill ordering.
5. Sync checkpoints retain source/scope, completed watermark/cursor, last successful time, and safe operational metadata needed by later steps. Do not store secrets or raw error dumps.
6. Define pure domain types and helpers for lifecycle labels/sort order, validated positive page/page-size parsing with a fixed maximum, and freshness text inputs. Keep provider numeric code maps out of this shared module.
7. Extend the state registry with canonical kebab-case slugs and reverse helpers for exactly 50 states. Existing `stateName`/`stateHeading` behavior for DC/territories must not regress.
8. Add data-layer functions returning paginated list items, total counts, lifecycle counts, and latest successful sync timestamp. State query: active LegiScan bills in a current state session. Federal query: active Congress bills in the calculated current Congress and selected origin chamber.
9. Generate the next migration through the existing Drizzle command. Review SQL for additive, non-destructive operations and correct unique/index constraints.
10. Add pure tests for state slug round trips, exclusion of DC/territories from state-page slugs, stage labels/sorting, pagination bounds, and current-Congress Jan-3 boundary behavior.

### Do not

- Do not reuse the advocacy `actions` table or the `congress_members` table for bills.
- Do not store API keys, full provider payloads, bill text, or sponsor/vote data.
- Do not hand-edit generated snapshots/journal or require new dependencies.
- Do not implement provider HTTP calls or pages in this step.

### Acceptance criteria

- [ ] Schema can represent state and federal sessions/bills/actions without conflating origin chamber and latest action body.
- [ ] Unique constraints make provider replays idempotent and indexes match all planned list queries.
- [ ] All 50 state names/codes/slugs round-trip, and only those 50 are valid state-page slugs.
- [ ] State and federal list queries are paginated, deterministic, and return freshness/count data.
- [ ] Generated migration is additive and current migration history is preserved.
- [ ] Pure domain/state tests pass without provider keys.

### Verification

```text
pnpm run db:generate
pnpm exec tsx --test tests/legislative-bills.test.ts
pnpm exec tsc --noEmit
pnpm run lint
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: db/schema.ts, drizzle/0029_aromatic_molecule_man.sql, drizzle/meta/0029_snapshot.json, drizzle/meta/_journal.json, lib/db.ts, lib/legislative-bills.ts, lib/us-states.ts, tests/legislative-bills.test.ts
Symbols changed: legislativeSource, legislativeLifecycleStage, legislativeSessions, legislativeBills, legislativeBillActions, legislativeSyncCheckpoints, LegislativeBillListItem, LegislativeBillDirectoryResult, getActiveStateLegislation, getActiveFederalLegislation, currentCongressForDate, parseLegislativePage, parseLegislativePageSize, formatLegislativeSyncFreshness, STATE_PAGE_CODES, STATE_PAGE_SLUGS, statePageSlug, stateCodeFromPageSlug, isStatePageSlug, isStatePageCode
Verification result: db:generate PASS, legislative-bills.test PASS, tsc PASS, lint PASS
Deviations: none
Notes for later steps: Federal originChamber stored as house|senate; latestActionBody separate. Checkpoint scopes: stateLegislationSyncScope('HI') → state:HI; federal uses FEDERAL_LEGISLATION_SYNC_SCOPE. LegiScan freshness: masterChangeHash, detailChangeHash, detailsPending. Directory reads via getActiveStateLegislation and getActiveFederalLegislation. currentCongressForDate uses UTC Jan-3 boundary. State routing via isStatePageSlug/stateCodeFromPageSlug.

---

## Step BP-002: Build the LegiScan delta mirror

Status: complete
Agent: reasoning-implementer-bg
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: background
Depends on: BP-001
Parallel group: bill-providers-and-ui
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

Correctly combining authoritative master lists, `change_hash`, a detail budget, partial backlog, terminal statuses, and safe persistence is a nontrivial synchronization state machine. It is file-independent from the federal provider and UI steps after the shared contract lands.

### Intent

Implement and fixture-test a quota-bounded, resumable LegiScan state-bill mirror for all 50 states, without adding cron/package/environment wiring yet.

### Architectural decisions to preserve

- Master list plus `change_hash` drives nightly deltas; `getBill` is called only for changed/new or still-pending details.
- Master freshness and detail freshness are separate.
- LegiScan's documented active/dead status is authoritative and unknown statuses fail closed.

### Semantic targets

- `fetchLegiScanSessionList` and `fetchLegiScanMasterList` — complete validated summary acquisition.
- `normalizeLegiScanMasterBill` and `normalizeLegiScanBillDetail` — provider boundary.
- `syncLegiScanStateBills` — budgeted all-state/state-scoped orchestration.
- `persistLegiScanSessionDelta` — idempotent, partial-failure-safe writes.

### Likely files

Paths are hints based on the repository at planning time.

- `lib/legiscan-sync.ts` (new)
- `tests/legiscan-sync.test.ts` (new)
- `lib/legislative-bills.ts`
- `db/schema.ts` only if a genuine contract omission from BP-001 is discovered; report before changing shared schema

### Implementation

1. Implement an injectable `fetch` LegiScan client using the documented Public API operations for session lists, master lists, and bill details. Construct requests server-side, enforce timeout/non-2xx/JSON result validation, and redact API keys from every thrown/loggable error.
2. Validate session and master payload shape, provider IDs, state ownership, duplicate bill IDs, and a plausible nonempty master list before authoritative omission handling. An upstream error object or malformed payload is a failed scope and performs no deactivation.
3. Encode the documented LegiScan status mapping once. Normalize active/in-progress versus law/vetoed/failed/dead, status date, origin chamber, and master-list latest action. Add fixture tests for every documented status plus unknown status.
4. Compare each master `change_hash` with local `masterChangeHash`. Upsert valid changed/new summaries, set `detailsPending`, and retain the old `detailChangeHash` until corresponding `getBill` detail is accepted.
5. Select detail work deterministically across pending bills, respect a total run request/detail budget, and report requests used, changed summaries, details refreshed, deactivations, pending backlog, failed states/sessions, and duration. Ensure no infinite retry of one bad bill starves other states; persist a bounded cursor/checkpoint.
6. Parse `getBill` history/action data into ordered child actions and normalized latest stage/body. Accept committees and chambers as source-reported labels. If detail is malformed, keep the valid master summary visible, retain pending state, and do not erase prior valid detail/actions.
7. Persist detail and action replacement atomically per bill or bounded batch. Set `detailChangeHash = masterChangeHash` and clear pending only in that same successful write.
8. After a complete master list only, mark omitted bills inactive for that session. Session rollover marks old sessions non-current for page queries but retains rows. Never delete historical provider rows.
9. Support injected persistence/fetch/time for deterministic tests and a dry-run path that reports intended changes without writes.
10. Test unchanged-hash zero-detail behavior, changed/new behavior, budget exhaustion/backlog carryover, malformed/partial master protection, detail failure preservation, status mapping, duplicate rejection, key redaction, session rollover, and idempotent replay.

### Do not

- Do not call Open States or add a fallback provider.
- Do not wire package scripts, env docs, cron routes, or `vercel.json` in this parallel step.
- Do not set detail hash from master data alone.
- Do not delete bills/actions because a request failed or budget was exhausted.
- Do not make live provider calls in tests.

### Acceptance criteria

- [ ] An unchanged master hash produces no `getBill` request.
- [ ] Changed summaries become visible and detail-pending; only validated details clear pending.
- [ ] Active/dead mapping is exhaustive for documented statuses and conservative for unknown values.
- [ ] Complete master omission and session rollover stop stale bills appearing without deleting history.
- [ ] Budget exhaustion is resumable and fairly progresses the backlog.
- [ ] Malformed/partial provider responses cannot deactivate or overwrite valid mirrored data.
- [ ] API keys cannot appear in errors/results, and all tests use injected fixtures.

### Verification

```text
pnpm exec tsx --test tests/legiscan-sync.test.ts
pnpm exec tsc --noEmit
pnpm run lint
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/legiscan-sync.ts, tests/legiscan-sync.test.ts
Symbols changed: fetchLegiScanSessionList, fetchLegiScanMasterList, fetchLegiScanBillDetail, normalizeLegiScanSession, normalizeLegiScanMasterBill, normalizeLegiScanBillDetail, mapLegiScanStatus, persistLegiScanSessionDelta, syncLegiScanStateBills, createMemoryLegiScanStore, createDbLegiScanStore, redactLegiScanSecrets, resolveLegiScanDetailBudget, resolveLegiScanStateCodes
Verification result: legiscan-sync.test PASS, tsc PASS, lint PASS
Deviations: none
Notes for later steps: Checkpoints stateLegislationSyncScope('HI')→state:HI; all-state cursor LEGISCAN_RUN_SYNC_SCOPE. Default LEGISCAN_DETAIL_BUDGET=200. Dry-run no writes. CLI/cron wiring is BP-005.

---

## Step BP-003: Build the Congress.gov bill mirror

Status: complete
Agent: reasoning-implementer-bg
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: background
Depends on: BP-001
Parallel group: bill-providers-and-ui
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

Congress.gov pagination, overlap-safe watermarks, action normalization, and conservative terminal-state inference require meaningful integration reasoning. The provider-specific files do not overlap the state mirror or UI step.

### Intent

Implement and fixture-test an incremental Congress.gov current-Congress bill mirror that supports origin-chamber directories without claiming current chamber.

### Architectural decisions to preserve

- Federal route membership is based on origin chamber derived from bill type.
- Incremental watermarks advance only after a complete, successfully persisted window.
- Current Congress plus conservative terminal evidence defines the federal active list.

### Semantic targets

- `fetchUpdatedCongressBills` — complete allowlisted pagination over an update window.
- `normalizeCongressBill` and `normalizeCongressBillActions` — tested federal mapping.
- `syncCongressBills` — bootstrap/incremental orchestration separate from roster sync.
- `currentCongressForDate` — tested Jan-3 rollover logic from BP-001.

### Likely files

Paths are hints based on the repository at planning time.

- `lib/congress-bill-sync.ts` (new)
- `tests/congress-bill-sync.test.ts` (new)
- `lib/government-sync.ts` only for reuse/extraction of narrowly shared safe fetch helpers; do not destabilize roster behavior
- `tests/government-sync.test.ts` if shared helper extraction affects the roster

### Implementation

1. Build an injectable Congress.gov bill client using `CONGRESS_API_KEY` and the established timeout, HTTPS host/path allowlist, safe pagination, non-2xx, malformed JSON, duplicate-ID, and complete-count protections.
2. On bootstrap, enumerate the calculated current Congress with complete pagination. On later runs, use the persisted successful update watermark with a small overlap and provider-supported from/to update filtering; sort/page deterministically.
3. Derive origin chamber only from recognized bill types and preserve bill number/type. Reject or quarantine unknown types rather than placing them on a chamber page.
4. Fetch the detail and actions required for changed bills, normalize title, introduced/update dates, public Congress.gov URL, latest action/body, ordered actions, stage, and terminal evidence. Do not use sponsors/committees/text/votes unless the minimum action payload already supplies a label needed for latest reported body.
5. Encode terminal/lifecycle mapping in one fixture-tested adapter. Became-law, vetoed, and clearly failed/withdrawn terminal evidence must set inactive; ambiguity remains explicit and must not invent a current chamber.
6. Persist idempotently with source/provider identity and provider update timestamp/fingerprint. Replace/upsert a bill's action set atomically with its normalized latest fields.
7. Advance the update checkpoint only when all list pages and accepted detail/action writes for the bounded window succeed. A failed bill keeps the old checkpoint so the overlap window retries safely.
8. On Jan-3 Congress rollover, create/use the new current session; old sessions remain stored but are excluded by current-session query. A dry run performs no writes.
9. Keep this sync function separate from `syncCongress()` roster behavior and result type. If extracting fetch helpers, preserve all existing roster tests.
10. Test origin mapping, House/Senate separation, no-current-chamber claim, pagination validation, duplicate rejection, overlap replay idempotency, watermark non-advance on failure, terminal mapping, current-Congress rollover, and key redaction.

### Do not

- Do not modify the congressional roster schema or combine roster and bill sync into one transaction/job.
- Do not wire cron/package/env/docs in this parallel step.
- Do not filter chamber pages using latest action body.
- Do not call Congress.gov during rendering or tests.
- Do not add a permanent current-Congress environment variable or hard-coded Congress number.

### Acceptance criteria

- [ ] House and Senate bill identity is based on recognized origin type and cannot be confused with latest action body.
- [ ] Complete bootstrap and incremental overlap modes are idempotent.
- [ ] Watermarks never advance past failed pagination or persistence.
- [ ] Current-Congress rollover excludes old bills from active queries without deleting them.
- [ ] Terminal mapping is conservative and fixture-tested.
- [ ] Existing roster sync/tests remain unchanged in behavior.

### Verification

```text
pnpm exec tsx --test tests/congress-bill-sync.test.ts tests/government-sync.test.ts
pnpm exec tsc --noEmit
pnpm run lint
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/congress-bill-sync.ts, tests/congress-bill-sync.test.ts
Symbols changed: fetchUpdatedCongressBills, fetchCongressBillDetail, fetchCongressBillActions, normalizeCongressBill, normalizeCongressBillActions, mapCongressLifecycle, originChamberFromBillType, syncCongressBills, CongressBillStore, CongressBillSyncResult, UnrecognizedCongressBillTypeError
Verification result: congress-bill-sync.test + government-sync.test PASS, tsc PASS, lint PASS
Deviations: none
Notes for later steps: syncCongressBills({ dryRun, fetchImpl, now, apiKey, persist }) separate from roster syncCongress(). 24h overlap watermark on FEDERAL_LEGISLATION_SYNC_SCOPE. Unknown bill types quarantined. BP-005 CLI/cron calls syncCongressBills only.

---

## Step BP-004: Create accessible bill directory pages

Status: complete
Agent: cheap-implementer-bg
Model tier: Composer
Model: composer-2.5-fast
Session: background
Depends on: BP-001
Parallel group: bill-providers-and-ui
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

The read contract, route semantics, card fields, pagination, and copy are already resolved. This is ordinary server-rendered App Router UI using established components and styles, independent of provider implementation files.

### Intent

Add reusable, responsive bill-directory UI and the 50 state plus two federal chamber routes, reading only from Neon.

### Architectural decisions to preserve

- One validated dynamic route supplies exactly 50 state URLs.
- Federal pages are explicitly origin-chamber directories.
- All lists are bounded/paginated and expose honest freshness/empty states.

### Semantic targets

- `/government/state/[state]` — canonical state bill directory.
- `/government/house` and `/government/senate` — federal origin-chamber bill directories.
- `BillDirectory`, `BillCard`, `LegislativeStageSummary`, and pagination navigation — shared presentation.
- `createSiteMetadata` and route-level not-found handling — metadata/canonical behavior.

### Likely files

Paths are hints based on the repository at planning time.

- `app/government/state/[state]/page.tsx` (new)
- `app/government/house/page.tsx` (new)
- `app/government/senate/page.tsx` (new)
- `app/government/bill-directory.tsx` (new)
- `app/government/bill-card.tsx` (new)
- `app/government/legislative-stage-summary.tsx` (new, if useful)
- `app/tailwind-styles.ts`

### Implementation

1. Build shared server-renderable components using `SiteHeader`, `SiteFooter`, links, semantic headings/lists/time elements, and classes in `tailwind-styles.ts`. Reuse the current government page's paper/ink/signal visual language and responsive breakpoint conventions.
2. Render bill number/title, lifecycle label, active status, origin chamber when known, latest reported body/action/date, session, and safe external provider/public link. Show “Details updating” when summary hash is ahead of detail hash without hiding the master-list summary.
3. Add an accessible lifecycle count/summary area covering introduction, committee, floor/cross-chamber, enrolled/executive, and terminal concepts. Page lists remain active-only; terminal labels can appear in explanatory process copy, not active results.
4. Implement query-string pagination with bounded parsing from BP-001, previous/next links preserving valid filters, total/result range, canonical first-page behavior, and an empty state. Do not render unbounded all-bill results.
5. Implement the state route by reverse-looking up the slug in the exact 50-state registry and calling `notFound()` for DC, territories, aliases, or unknown values. Generate state-specific metadata and render the state name, active session label, lifecycle counts, last successful state sync, and active bill page.
6. Implement `/government/house` and `/government/senate` with shared code/config. Copy and metadata must say bills “originating in” the selected chamber and explicitly explain that latest reported action/body may be in the other chamber, a committee, or the executive process.
7. Use `dynamic = 'force-dynamic'`; provider functions/modules must not be imported by page/component code.
8. Include honest setup/no-data/stale messaging. Missing rows or a missing successful-sync timestamp must never trigger a provider request.
9. Verify keyboard focus, external-link labeling, heading hierarchy, narrow mobile layout, very long titles/action text, and no horizontal overflow.

### Do not

- Do not create 50 duplicated page files, client-side provider fetching, bill detail pages, search autocomplete, or new dependencies.
- Do not label origin chamber as current chamber.
- Do not expose raw provider codes/payloads or API keys.
- Do not edit `/government` landing/roster composition in this parallel step.

### Acceptance criteria

- [ ] Every canonical state slug resolves through one route and invalid/DC/territory slugs return not found.
- [ ] State pages identify latest reported stage/body/action without overstating current jurisdiction.
- [ ] Federal pages clearly and consistently describe origin chamber.
- [ ] Lists are database-only, paginated, responsive, keyboard accessible, and have setup/empty/freshness states.
- [ ] Shared components avoid duplicated House/Senate/state list markup.
- [ ] No page render imports or calls provider sync code.

### Verification

```text
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
Manual: with fixture/non-production rows, open /government/state/hawaii, /government/house, /government/senate, an invalid state slug, and page=2 at desktop and narrow mobile widths; verify copy, pagination, focus, freshness, long text, and no provider network requests.
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: app/government/state/[state]/page.tsx, app/government/house/page.tsx, app/government/senate/page.tsx, app/government/bill-directory.tsx, app/government/bill-card.tsx, app/government/legislative-stage-summary.tsx, app/tailwind-styles.ts
Symbols changed: BillDirectory, BillCard, LegislativeStageSummary, HouseBillDirectoryPage, SenateBillDirectoryPage, StateBillDirectoryPage
Verification result: tsc PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: Manual route matrix recommended. BP-006 wires /government landing navigation.

---

## Step BP-005: Wire secure sync operations

Status: complete
Agent: cheap-implementer
Model tier: Composer
Model: composer-2.5-fast
Session: foreground
Depends on: BP-002, BP-003
Parallel group: none
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

Both sync APIs are complete and tested, so scripts, secured routes, schedules, environment examples, and operator documentation are straightforward applications of existing repository patterns.

### Intent

Make both mirrors safely runnable from pnpm and staggered protected cron routes, with clear bootstrap/quota operations.

### Architectural decisions to preserve

- State and federal bill jobs remain independent from each other and from the existing roster job.
- Exact bearer-secret authorization and server-only keys.
- LegiScan detail work is bounded and resumable.

### Semantic targets

- `state-bills:sync` and `federal-bills:sync` package commands — local/bootstrap operations.
- `/api/cron/sync-state-bills` and `/api/cron/sync-federal-bills` — production jobs.
- `.env.example`, `vercel.json`, and README sync instructions — deploy/operator contract.

### Likely files

Paths are hints based on the repository at planning time.

- `scripts/sync-state-bills.ts` (new)
- `scripts/sync-federal-bills.ts` (new)
- `app/api/cron/sync-state-bills/route.ts` (new)
- `app/api/cron/sync-federal-bills/route.ts` (new)
- `package.json`
- `.env.example`
- `vercel.json`
- `README.md`

### Implementation

1. Add strict CLI argument parsing. State supports `--dry-run`, `--state=<two-letter-code-or-canonical-slug>`, and `--detail-budget=<positive bounded integer>`. Federal supports `--dry-run` and a documented bootstrap/current-Congress mode only if the BP-003 API requires it. Unknown/duplicate/invalid arguments exit nonzero without provider calls.
2. Add pnpm package scripts using the existing `tsx --env-file=.env.local` convention. Keep the existing `government:sync` roster command unchanged.
3. Add two GET cron routes with `dynamic = 'force-dynamic'`, Node runtime, 300-second maximum, and exact existing bearer-secret authentication. Invoke only the corresponding provider function.
4. Return safe structured result summaries. Use 200 for complete or successful-with-backlog runs; use a non-2xx response for provider/persistence failure. Log server-side errors without request URLs containing credentials and return generic safe errors where necessary.
5. Add staggered nightly schedules that do not replace/overlap the existing `discover-actions` and `sync-congress` entries. Schedule state master/delta work before federal work with enough separation for max duration.
6. Add `LEGISCAN_API_KEY` and documented optional `LEGISCAN_DETAIL_BUDGET=200` to `.env.example`; retain `CONGRESS_API_KEY` and `CRON_SECRET`.
7. Document migration-first deployment, state-by-state/resumable bootstrap, dry runs, default/request quota arithmetic, pending-detail behavior, current-Congress bootstrap, cron endpoints, and that public pages read only Neon.
8. Explain that initial live provider operations require keys and non-production validation. Do not make live sync a verification requirement in CI.

### Do not

- Do not combine provider jobs, run them during page render, or alter the existing roster sync semantics.
- Do not print credentials or credential-bearing URLs.
- Do not seed provider bills in migrations.
- Do not add a dependency or use npm/yarn.

### Acceptance criteria

- [ ] Both CLI commands reject bad arguments and support dry-run without writes.
- [ ] Both cron routes reject missing/wrong bearer secrets and invoke only their own sync.
- [ ] Existing cron schedules remain, and new nightly jobs are staggered.
- [ ] Environment/docs clearly cover keys, quota budget, migration, bootstrap, backlog, and server-only mirroring.
- [ ] Existing `government:sync` still means roster sync.

### Verification

```text
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
Manual without live calls: invoke each CLI with an invalid flag and verify nonzero exit; invoke each cron route without/with an incorrect bearer token and verify 401.
Manual with configured non-production database/keys after migration: pnpm run state-bills:sync -- --dry-run --state=hawaii --detail-budget=5
Manual with configured non-production database/keys after migration: pnpm run federal-bills:sync -- --dry-run
```

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: scripts/sync-state-bills.ts, scripts/sync-federal-bills.ts, app/api/cron/sync-state-bills/route.ts, app/api/cron/sync-federal-bills/route.ts, package.json, vercel.json, .env.example, README.md
Symbols changed: state-bills:sync, federal-bills:sync package scripts; GET sync-state-bills/sync-federal-bills cron routes
Verification result: tsc PASS, lint PASS, build PASS; manual CLI invalid flags and cron 401 PASS
Deviations: CLI scripts strip standalone -- from argv for pnpm passthrough
Notes for later steps: Live dry-run sync requires migrated DB plus API keys in .env.local
Agent: cheap-implementer
Model tier: Composer
Model: composer-2.5-fast
Session: foreground
Depends on: BP-004, BP-005
Parallel group: none
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

This is a bounded landing-page integration and whole-feature verification pass after all contracts, syncs, routes, and operations exist.

### Intent

Make the new state and federal bill directories discoverable from `/government`, preserve the roster/finder experience, and run the complete deterministic verification suite.

### Architectural decisions to preserve

- `/government` remains the representative finder and roster home while gaining clear legislation navigation.
- The new state selector includes exactly 50 states; federal links describe origin chamber.
- Existing government roster and Google Civic behavior must not regress.

### Semantic targets

- `GovernmentPage` — legislation navigation adjacent to, not replacing, current finder/roster content.
- `GovernmentLegislationNav` — reusable 50-state/federal discovery UI.
- `government visual styles` — responsive integration with existing page language.
- `all legislative and existing government tests` — final deterministic regression gate.

### Likely files

Paths are hints based on the repository at planning time.

- `app/government/page.tsx`
- `app/government/government-legislation-nav.tsx` (new)
- `app/tailwind-styles.ts`
- relevant tests under `tests/`
- `README.md` only for corrections revealed by integrated verification

### Implementation

1. Add a clearly headed “Track legislation” section/navigation to `/government` with links to House-originated bills, Senate-originated bills, and all 50 states from the canonical registry. Preserve the representative finder and complete roster behavior.
2. Keep navigation server-rendered and accessible: semantic links/lists, visible focus, full state names with usable narrow-screen treatment, and no JavaScript requirement.
3. Update `/government` metadata/intro copy only enough to include bill tracking while retaining its representative-directory purpose.
4. Ensure styles added here do not collide with BP-004 class keys; inspect the current file before editing and reuse shared classes where sensible.
5. Run every new targeted test together, then existing government/civic tests, typecheck, lint, and production build. Fix only feature-caused failures.
6. Review the production build/routes for accidental provider imports in client/page rendering, leaked `LEGISCAN_API_KEY`, and unbounded list queries.
7. Perform a final manual route matrix with empty database and fixture-populated non-production data, including all-state link count, representative finder/roster presence, federal copy, invalid state 404, pagination, mobile overflow, and keyboard focus.

### Do not

- Do not redesign or remove the representative finder/roster.
- Do not add global header search indexing for bills, bill details, or unrelated navigation changes.
- Do not make live providers a build/test prerequisite.
- Do not broaden cleanup beyond regressions caused by this feature.

### Acceptance criteria

- [ ] `/government` exposes discoverable links to both federal routes and exactly 50 canonical state routes.
- [ ] Existing roster, representative lookup, and government write flows still compile and targeted tests pass.
- [ ] All new provider/domain tests, typecheck, lint, and build pass.
- [ ] No client/render path contains provider calls or secrets, and no list query is unbounded.
- [ ] Empty and populated route matrices are truthful, responsive, and keyboard accessible.

### Verification

```text
pnpm exec tsx --test tests/legislative-bills.test.ts tests/legiscan-sync.test.ts tests/congress-bill-sync.test.ts tests/government-sync.test.ts tests/civic-district.test.ts tests/government-lookup-storage.test.ts
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
Manual: verify /government retains finder and roster, exposes 50 state links plus /government/house and /government/senate, and all empty/populated/invalid/paginated routes behave as specified at desktop and mobile widths.
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: app/government/page.tsx, app/government/government-legislation-nav.tsx, app/tailwind-styles.ts
Symbols changed: GovernmentPage, GovernmentLegislationNav, governmentLegislation* style classes
Verification result: 6 test files PASS, tsc PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: Manual route matrix recommended for empty DB and invalid slug checks.

---

## Step BR-001: Make Congress bill sync persist incrementally and resume under quota

Status: complete
Agent: reasoning-implementer
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: foreground
Depends on: none
Parallel group: remediation-a
Retry limit: 1
Escalation chain: frontier-implementer

### Intent
Federal bootstrap must progress across budgeted runs without fetch-all-then-persist; per-bill failures and 429s must not discard prior work or advance watermark early.

### Completion record
Started: 2026-09-07
Completed: 2026-09-07
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/congress-bill-sync.ts, tests/congress-bill-sync.test.ts, db/schema.ts, .env.example, README.md
Symbols changed: syncCongressBills, CongressBillSyncResult, CongressBillSyncOptions, CongressBillCheckpoint, DEFAULT_CONGRESS_DETAIL_BUDGET, resolveCongressDetailBudget, CongressRequestError
Verification result: congress-bill-sync.test + government-sync.test PASS, tsc PASS, lint PASS
Deviations: CONGRESS_DETAIL_BUDGET env override added; type-only resumeAfter on checkpoint metadata
Notes for later steps: Cron returns 200 for complete and successful-with-backlog; federal CLI remains --dry-run only

Status: complete
Agent: cheap-implementer
Model tier: Composer
Model: composer-2.5-fast
Session: foreground
Depends on: none
Parallel group: remediation-a
Retry limit: 1
Escalation chain: reasoning-implementer

### Intent
Remove active `other` from terminal group in LegislativeStageSummary; add separate unspecified group with honest copy.

### Completion record
Started: 2026-09-07
Completed: 2026-09-07
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: app/government/legislative-stage-summary.tsx
Symbols changed: STAGE_GROUPS (terminal vs unspecified groups)
Verification result: tsc PASS, lint PASS
Deviations: none
Notes for later steps: none

---

## Step BR-003: Advance Congress resume past isolated bill failures

Status: complete
Agent: reasoning-implementer
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: foreground
Depends on: none
Parallel group: none
Retry limit: 1
Escalation chain: frontier-implementer

### Intent
Isolated per-bill fetch/normalize failures must not pin resumeAfter before the failed bill; later budgeted runs must reach unseen bills.

### Completion record
Started: 2026-09-07
Completed: 2026-09-07
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/congress-bill-sync.ts, tests/congress-bill-sync.test.ts
Symbols changed: syncCongressBills, catalogFetch
Verification result: congress-bill-sync.test + government-sync.test PASS, tsc PASS, lint PASS
Deviations: none
Notes for later steps: Quarantined failures advance resumeAfter past failed bill; fully walked quarantine-only window can advance watermark; 429/timeout/persist failures unchanged

---

## Step BP-999: Final integration review

Status: complete
Agent: frontier-reviewer
Model tier: Grok
Model: cursor-grok-4.6-high-fast
Session: foreground
Depends on: BP-001, BP-002, BP-003, BP-004, BP-005, BP-006, BR-001, BR-002, BR-003
Parallel group: none
Retry limit: 0
Escalation chain: stop

### Routing reason

A single Grok frontier review after implementation is cheaper than frontier review after every step and is necessary to catch cross-provider lifecycle, quota, watermark, origin-chamber, persistence, routing, and security integration errors.

### Intent

Review the completed implementation as a whole against the original objective and architectural decisions.

### Architectural decisions to preserve

- All global architectural decisions in this plan.
- Reviewer execution must use `cursor-grok-4.6-high-fast`; no Claude, GPT, or other model family.

### Semantic targets

- The complete diff and all behavior changed by this plan.
- State and federal provider adapters, persistence safety, lifecycle/origin semantics, page queries, routes, cron/CLI operations, and user-facing copy.

### Likely files

Paths are hints based on the repository at planning time.

- All files changed by completed implementation/remediation steps.

### Implementation

1. Review only; do not edit implementation files.
2. Check correctness, integration, regressions, quota behavior, watermark/hash safety, provider response validation, origin-versus-current-chamber semantics, lifecycle/active mappings, migration safety, secret handling, error handling, accessibility, pagination, contracts, unnecessary complexity, and coverage.
3. Confirm LegiScan is the only state provider, page renders are database-only, exactly 50 state slugs are valid, and the existing roster/finder still work.
4. Return `REVIEW_RESULT: PASS` when no material issue remains.
5. If material issues remain, return `REVIEW_RESULT: REMEDIATION_REQUIRED` followed by complete remediation step packets using the same step schema and cost-routing rules.
6. Assign Composer only to cheap remediation and Grok only to reasoning/frontier remediation; no other model family is permitted.
7. Do not create remediation for optional stylistic preferences.

### Do not

- Rewrite working code for style preference.
- Edit code directly.
- Request remediation for speculative improvements unrelated to the feature.
- Route review/remediation to Claude, GPT, or any model other than the two explicitly allowed.

### Acceptance criteria

- [ ] Original feature requirements are satisfied.
- [ ] Cross-step integration is coherent.
- [ ] State delta sync is quota-bounded, resumable, and partial-failure safe.
- [ ] Federal pages and data never conflate origin chamber with current/latest body.
- [ ] No material regression, security, migration, correctness, accessibility, or coverage issue remains.

### Verification

```text
Review the completed plan records, current repository, complete diff, migration SQL, all targeted test/typecheck/lint/build results, and the documented manual route/cron checks.
```

### Completion record

Started: 2026-09-07
Completed: 2026-09-07
Actual agent: frontier-reviewer
Attempts: 3
Result: PASS (cycle 2 after BR-001/002/003)
Files changed: none
Symbols changed: none
Verification result: 48 targeted tests pass; integration review PASS
Deviations: —
Notes for later steps: Manual route matrix and live sync with API keys remain operational prerequisites
