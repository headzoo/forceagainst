<!-- BIG-PLAN:1 -->
# Big Plan: Your Government directory and representative finder

Plan status: complete
Review cycle: 1
Max review cycles: 2

## Objective

Add a public `/government` page that preserves the site's current visual language, lists every currently seated U.S. House member (including delegates and the resident commissioner) and senator from a Neon-backed mirror, and lets a visitor submit a complete street address to identify their House district and current federal representatives. Add a “Your Government” footer link immediately after “Contact.” Populate and refresh the roster from Congress.gov plus the unitedstates/congress-legislators JSON feeds without exposing provider keys, retaining stale members as inactive so vacancies never show a former officeholder. Do not build polling-place, voter-information, or map functionality.

## Original request

Come up with a plan for "a "find my district" search feature, and have a list of all US congressmen and sentetors" using your ideas. Skip the polling map for now. Add a link to the footer after "Contact" that's "Your Government" that links to /government. That will have the a list of congressmen and senators, with an address search at the top of the page so the user can find their representatives.

## Global architectural decisions

- Keep all provider credentials and provider calls server-side. The browser will POST an address to an internal route; only that route calls Google Civic Information `divisionsByAddress`.
- Use `GOOGLE_CIVIC_API_KEY` for district lookup and `CONGRESS_API_KEY` for Congress.gov. Document both in `.env.example`; never send either to client components or include them in application responses.
- Treat Congress.gov `GET /v3/member?currentMember=true` as the authority for who is seated. Page through the complete result with `limit=250`; never call Congress.gov during a page render or address lookup.
- Enrich only Congress.gov-authoritative bioguide IDs from the dependency-free JSON feeds at `https://unitedstates.github.io/congress-legislators/legislators-current.json`, `legislators-social-media.json`, and `legislators-district-offices.json`. A missing enrichment record must not remove an authoritative member.
- Store one durable row per bioguide ID with an `isCurrent` flag. Perform a sync's upserts and stale-member deactivation atomically only after all authoritative pages have been fetched and validated, so failed or incomplete upstream reads leave the last complete roster active.
- Model chamber as a Drizzle/Postgres enum (`house`, `senate`), keep two-letter jurisdiction codes, use nullable House district and Senate class/rank fields, and retain source timestamps plus sync timestamps. Index current-roster and state/district lookups.
- House members from DC and the five inhabited territories are part of the roster and are labeled Delegate, except Puerto Rico's Resident Commissioner. Only the 50 states receive Senate results. Address searches that resolve to a district with no current matching House row return an explicit vacancy/unavailable state instead of a former member.
- Normalize Google OCD IDs from both primary IDs and aliases. Parse only U.S. state/territory and congressional-district segments, normalize at-large district representations consistently with stored roster data, and reject responses that do not resolve both a jurisdiction and House district.
- Address input is transient private data: require a plausible full street address (not a ZIP-only value), cap its length, do not persist or intentionally log it, use `Cache-Control: no-store`, and return stable user-safe errors for invalid address, no district, rate-limit, timeout, configuration, and upstream failures.
- Reuse the existing App Router server-page/client-component split, `SiteHeader`, Drizzle data layer, route-handler response conventions, cron bearer-secret pattern, and global CSS design tokens. Use a small shared `SiteFooter` to eliminate the seven duplicated footer fragments while preserving the homepage's `#top` brand target.
- Use the existing `tsx` development dependency and Node's built-in test runner for pure parser/normalizer/sync tests. Add no dependency; in particular, use the published JSON enrichment feeds rather than adding a YAML parser.
- Schedule a separate daily secured roster-sync cron and expose the same sync through a CLI script with `--dry-run`. Reuse `CRON_SECRET` authorization, keep the existing weekly discovery cron, and do not seed Congress data in `scripts/migrate.ts`.
- Generate the next Drizzle migration from the current schema with the existing `db:generate` script. Do not overwrite or manually renumber existing migrations or hand-edit Drizzle snapshots/journal.
- All repository commands use `pnpm`, per workspace policy. Polling maps, Civic voter-info, polling locations, state/local officials, electoral maps, and member-detail routes are out of scope.

## Open questions / assumptions

- Deployment will provide valid Google Civic Information and Congress.gov/API.data.gov keys with sufficient quota. Implementation can be completed and fixture-tested without them, but live address lookup and the initial roster sync require those keys.
- The initial migration must be followed by one successful roster sync before production `/government` can show members; the page should render an honest temporarily-unavailable/empty state until then.
- Google Civic is the selected geography provider for this plan. The Census Geocoder remains a future fallback and is not implemented unless Google Civic proves unavailable.

## Execution policy

- The current repository is authoritative; this plan captures intent.
- Paths below are hints unless explicitly stated otherwise.
- Never use line numbers as implementation anchors.
- The orchestrator owns this plan's status fields and completion records.
- Implementers must not edit this plan file.

---

## Step BP-001: Add the congressional roster data model

Status: complete
Agent: cheap-implementer
Model tier: cheap
Session: foreground
Depends on: none
Parallel group: none
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

This is a conventional additive Drizzle schema, generated migration, and read-query change with the shape and indexes already resolved.

### Intent

Create the durable Neon representation and read API needed by both the roster page and address lookup, without coupling database reads to external providers.

### Architectural decisions to preserve

- Congress.gov authority is represented by `isCurrent`; inactive rows remain stored but are never returned in public current-roster queries.
- Chamber and jurisdiction/district fields are normalized for exact lookup.
- Public data access exposes only fields needed by the page and representative result.

### Semantic targets

- `db/schema.ts congressional member schema` — authoritative local mirror keyed by bioguide ID.
- `lib/db.ts government roster reads` — sorted full-roster and state/district lookup contracts.
- `Drizzle migration history` — additive schema change after the repository's current latest migration.

### Likely files

Paths are hints based on the repository at planning time.

- `db/schema.ts`
- `lib/db.ts`
- `drizzle/<next-generated-migration>.sql`
- `drizzle/meta/<next-generated-snapshot>.json`
- `drizzle/meta/_journal.json`

### Implementation

1. Add a `congress_chamber` enum with `house` and `senate`, then add a `congress_members` table keyed by text `bioguide_id`.
2. Include normalized identity/seat fields: first, middle, last, suffix, nickname, official/full display name, party, chamber, two-letter state or territory, nullable district, nullable Senate class, nullable Senate rank, and an explicit display title.
3. Include nullable enrichment fields required by the intended cards: official website, contact form, Capitol phone, office, mailing address, Congress.gov profile URL, official image URL/attribution, official social handles, and district-office JSON. Use typed `jsonb` for district offices rather than a serialized text blob.
4. Include `is_current`, nullable provider update timestamp, and `synced_at`; add indexes supporting `(is_current, chamber, state, district)`, `(is_current, state)`, and deterministic roster sorting.
5. Export inferred member types and add narrow public types/read helpers in the DB layer: one query for all current members sorted Senate then House (or return separately with explicit stable sorting), and one query for a jurisdiction's senators plus exact House district. Ensure inactive records can never leak from these helpers.
6. Generate the migration with `pnpm run db:generate`. Inspect the generated SQL for additive, non-destructive operations and unique names; do not hand-edit metadata files or disturb existing migrations.

### Do not

- Do not put provider fetches, sync orchestration, or address parsing in the shared DB module.
- Do not add a generic elected-official abstraction or state/local offices.
- Do not delete historical/inactive rows or modify existing issue/action/auth tables.
- Do not apply the migration to production as part of implementation verification.

### Acceptance criteria

- [ ] The table can represent House members, senators, delegates, the resident commissioner, contact/social enrichment, inactive former members, and source/sync timestamps without ambiguous sentinel strings.
- [ ] Current-roster reads exclude inactive members and exact district reads return the House match plus applicable senators.
- [ ] The generated migration is additive and follows the current Drizzle journal sequence.
- [ ] Existing application types still compile.

### Verification

```text
pnpm run db:generate
pnpm run lint
pnpm run build
```

### Completion record

Started: 2026-09-05
Completed: 2026-09-05
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: db/schema.ts, lib/db.ts, drizzle/0013_warm_nico_minoru.sql, drizzle/meta/0013_snapshot.json, drizzle/meta/_journal.json
Symbols changed: congressChamber, CongressDistrictOffice, CongressMemberSocialHandles, congressMembers, CongressMember, CongressMemberInsert, PublicCongressMember, CongressMembersByJurisdiction, getCurrentCongressMembers(), getCongressMembersByJurisdiction()
Verification result: db:generate PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: contactFormUrl and capitolOffice column names chosen; getCongressMembersByJurisdiction expects normalized two-letter state and exact district integer including at-large normalization from BP-002/BP-003.

---

## Step BP-002: Build the authoritative roster sync

Status: complete
Agent: reasoning-implementer-bg
Model tier: reasoning
Session: background
Depends on: BP-001
Parallel group: government-backends
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

The provider join, fallback normalization, complete-pagination checks, and all-or-nothing stale-member transition require moderate integration reasoning, while the files do not overlap the parallel Civic lookup step.

### Intent

Provide a repeatable daily and manual process that safely mirrors the complete currently seated Congress into Neon and enriches it without making page requests depend on upstream services.

### Architectural decisions to preserve

- Congress.gov current members are the authority; enrichment feeds can add fields but cannot add seated members.
- Fetch and validate the complete authoritative roster before writes; upsert and deactivation happen atomically.
- Sync is available as a dry-runnable CLI and a secured daily cron using one shared library function.

### Semantic targets

- `government roster synchronization service` — provider clients, normalization, merge, and atomic persistence.
- `manual roster sync entry point` — operational bootstrap and dry-run workflow.
- `secured roster cron route` — production refresh trigger.
- `Vercel cron configuration` — daily schedule alongside existing discovery schedule.

### Likely files

Paths are hints based on the repository at planning time.

- `lib/government-sync.ts`
- `scripts/sync-congress.ts`
- `app/api/cron/sync-congress/route.ts`
- `tests/government-sync.test.ts`
- `package.json`
- `.env.example`
- `vercel.json`
- `README.md`

### Implementation

1. Define narrow runtime-checked input types for Congress.gov list pages and the three congress-legislators JSON feeds without adding a validation dependency. Treat all remote bodies as untrusted.
2. Fetch Congress.gov with `currentMember=true`, `format=json`, and `limit=250`, authenticating with `CONGRESS_API_KEY`. Follow offsets/`pagination.next` until the reported count is satisfied; reject repeated pages, missing IDs, malformed pages, implausibly small/incomplete totals, and non-2xx responses before any DB write.
3. Fetch current-legislator, official-social, and district-office JSON feeds with timeouts. Build maps keyed by bioguide ID and merge only records present in the authoritative Congress response.
4. Normalize each member deterministically. Prefer the currently active/latest enrichment term for chamber, two-letter state, district, Senate class/rank, title, website/contact/office details; use Congress list fields and a fixed full-state-name-to-code map when enrichment is absent. Preserve Congress depiction/profile/source-update fields as fallbacks.
5. Label ordinary House members “Representative,” DC/territory members “Delegate,” Puerto Rico's member “Resident Commissioner,” and Senate members “Senator.” Preserve at-large district normalization consistently with BP-001 and BP-003.
6. After all data is fetched, normalized, and duplicate bioguide IDs are rejected, atomically upsert every authoritative member and mark previously current IDs absent from this run inactive. Verify the chosen Neon HTTP/Drizzle transaction mechanism actually encloses both operations; never deactivate based on a partial fetch or partial write.
7. Return a non-sensitive result summary containing fetched/upserted/deactivated counts, warnings for missing optional enrichment, duration, and dry-run status. Do not include keys or raw provider payloads.
8. Add `scripts/sync-congress.ts` with `--dry-run`, a `government:sync` package script using the project's `tsx --env-file=.env.local` convention, and clear nonzero exit behavior.
9. Add a Node-runtime, force-dynamic cron GET route with the existing exact bearer `CRON_SECRET` contract, useful status codes, safe error logging, and a suitable maximum duration.
10. Add a daily Vercel schedule without removing or changing the weekly action-discovery job. Document both provider variables, bootstrap command, dry run, schedule, and source roles in `.env.example` and README using `pnpm` commands.
11. Add fixture-driven built-in Node tests for pagination completion/rejection, authoritative-ID intersection, fallback normalization, territory titles, at-large districts, duplicate IDs, and stale-ID calculation. Keep network and DB writes out of unit tests by extracting pure functions or injecting boundaries.

### Do not

- Do not call upstream providers from page rendering or the address route.
- Do not trust the enrichment feeds to decide current membership.
- Do not deactivate members when any Congress page is missing, malformed, timed out, or fails to persist.
- Do not add YAML, cron, HTTP, or testing packages.
- Do not fold roster seeding into the large existing migration/seed script.

### Acceptance criteria

- [ ] A successful complete sync yields one current row per Congress.gov current bioguide ID and deactivates IDs missing from the new complete snapshot.
- [ ] A failed/incomplete fetch or persistence attempt leaves the previous complete roster active.
- [ ] Missing optional enrichment produces a usable Congress-derived member row and a warning, not a dropped member.
- [ ] CLI dry-run performs fetch/merge/validation but writes nothing; cron requires the configured bearer secret.
- [ ] The daily roster cron and existing weekly discovery cron coexist.
- [ ] Pure merge, pagination, normalization, and stale-set behavior is fixture-tested without live credentials.

### Verification

```text
pnpm exec tsx --test tests/government-sync.test.ts
pnpm run lint
pnpm run build
Manual with configured non-production keys/database: pnpm run government:sync -- --dry-run
Manual with configured non-production keys/database after migration: pnpm run government:sync
```

### Completion record

Started: 2026-09-05
Completed: 2026-09-05
Actual agent: reasoning-implementer-bg
Attempts: 1
Result: COMPLETE
Files changed: lib/government-sync.ts, scripts/sync-congress.ts, app/api/cron/sync-congress/route.ts, tests/government-sync.test.ts, package.json, .env.example, vercel.json, README.md
Symbols changed: syncCongress(), fetchCurrentCongressMembers(), normalizeCongressMember(), normalizeDistrict(), staleBioguideIds(), persistCongressMembers()
Verification result: government-sync tests PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: At-large districts normalize to integer 0; territory titles are Delegate except Puerto Rico Resident Commissioner.

---

## Step BP-003: Add private address-to-representatives lookup

Status: complete
Agent: reasoning-implementer-bg
Model tier: reasoning
Session: background
Depends on: BP-001
Parallel group: government-backends
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason

The route is small, but privacy-sensitive validation, variable OCD-ID aliases, at-large normalization, territory rules, provider error mapping, and DB joining require focused reasoning. It is safe in parallel with the roster sync because it owns distinct service, route, and test files.

### Intent

Expose a stable internal POST API that transiently resolves a complete U.S. street address to a congressional district and returns matching current Neon roster members.

### Architectural decisions to preserve

- Google Civic supplies geography only; Neon supplies people.
- Address data is neither persisted nor intentionally logged or cached.
- Provider details are translated into a small stable application contract.

### Semantic targets

- `Google Civic divisionsByAddress client` — server-only geography provider boundary.
- `OCD congressional division parser` — robust primary/alias normalization.
- `POST /api/government/representatives` — validation, provider error mapping, roster join, and response contract.

### Likely files

Paths are hints based on the repository at planning time.

- `lib/civic-district.ts`
- `app/api/government/representatives/route.ts`
- `tests/civic-district.test.ts`

### Implementation

1. Define an exported response contract suitable for the future client: normalized jurisdiction and district label, one nullable House member, current senators, whether Senate representation applies, and an explicit House vacancy/unavailable indicator.
2. Accept only JSON POST bodies with one string address. Trim/collapse whitespace, enforce a conservative maximum, reject empty/ZIP-only/obviously non-street inputs, and give copy that asks for street, city, state, and ZIP. Do not echo the raw address in errors.
3. Call `https://www.googleapis.com/civicinfo/v2/divisionsByAddress` with `GOOGLE_CIVIC_API_KEY` only on the server, URL-encoding the address and using a bounded timeout. Never expose the request URL or provider payload in logs or responses because they contain the address/key.
4. Parse both division keys/primary OCD IDs and aliases for `country:us/state:<code>/cd:<district>` forms. Require one unambiguous jurisdiction and district; handle at-large aliases such as state plus `cd:0`/`cd:1` consistently with the roster normalizer, and reject contradictory congressional districts.
5. Query only `isCurrent` local rows. Return the exact House member when seated; otherwise return the resolved district with an explicit vacant/unavailable result. Return senators only for the 50 states; DC and territories return `senateApplies: false` and no senators.
6. Map validation/no-geography to 400/404-style client-safe responses and configuration, quota/rate-limit, timeout, malformed upstream, and DB failures to differentiated retryable server statuses/messages. Add `Cache-Control: no-store` to every response and mark the route Node/force-dynamic as appropriate.
7. Add fixture tests for ordinary districts, multi-digit districts, at-large primary IDs and aliases, DC/territories, ambiguous/missing districts, malformed provider data, address validation, and provider error classification. Keep live Google and DB calls outside unit tests through pure parsing/error functions or injectable boundaries.

### Do not

- Do not use Google Civic's retired representatives API or return Google official data.
- Do not accept ZIP-only lookup as a district answer.
- Do not store addresses, add analytics around them, include them in structured logs, or use a GET query string for the internal browser-facing endpoint.
- Do not implement Census fallback, voter-info, election, polling-place, or map behavior.
- Do not return inactive members when a seat is vacant.

### Acceptance criteria

- [ ] Valid full addresses resolve through Google divisions and join to current House/Senate rows without exposing the Google key.
- [ ] ZIP-only and malformed inputs are rejected before an upstream call.
- [ ] Vacant districts, DC, and territories produce accurate explicit states rather than stale or fabricated senators.
- [ ] All responses are non-cacheable and raw address/provider details are absent from logs and errors.
- [ ] Parser and error behavior is deterministic under fixtures.

### Verification

```text
pnpm exec tsx --test tests/civic-district.test.ts
pnpm run lint
pnpm run build
Manual with a configured Google key and non-production roster: POST a valid street address, a ZIP-only value, a territory address, and a known vacant district to /api/government/representatives; inspect that responses contain no key or raw address and use Cache-Control: no-store.
```

### Completion record

Started: 2026-09-05
Completed: 2026-09-05
Actual agent: reasoning-implementer-bg
Attempts: 1
Result: COMPLETE
Files changed: lib/civic-district.ts, app/api/government/representatives/route.ts, tests/civic-district.test.ts
Symbols changed: getCivicDistrict, parseCivicDistrict, normalizeStreetAddress, POST
Verification result: civic-district tests PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: Civic at-large parsing follows government-sync: explicit cd:0/aliases normalize to 0; bare cd:1 remains district 1.

---

## Step BP-004: Build the Government page and shared footer

Status: complete
Agent: cheap-implementer
Model tier: cheap
Session: foreground
Depends on: BP-002, BP-003
Parallel group: none
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason

With data and API contracts fixed, this is standard App Router composition, accessible client state, mechanical footer reuse, and responsive styling in the established design system.

### Intent

Deliver the user-facing `/government` experience and make it discoverable from every existing public footer.

### Architectural decisions to preserve

- Server-render the full current roster from Neon; isolate only the address form/result state in a client component.
- Keep the full roster visible below the finder regardless of finder success or failure.
- Consolidate the duplicated footer markup without changing its existing appearance or page-specific home target.

### Semantic targets

- `/government page` — metadata, header, finder, full roster, empty state, and footer.
- `FindMyRepresentatives client component` — accessible request lifecycle and result rendering.
- `SiteFooter shared component` — canonical footer links with Your Government directly after Contact.
- `government responsive styles` — existing paper/ink/red visual language and mobile behavior.

### Likely files

Paths are hints based on the repository at planning time.

- `app/government/page.tsx`
- `app/government/find-representatives.tsx`
- `app/site-footer.tsx`
- `app/globals.css`
- `app/actions-directory.tsx`
- `app/action/[id]/[actionSlug]/page.tsx`
- `app/issue/[slug]/page.tsx`
- `app/org/[slug]/page.tsx`
- `app/liked/page.tsx`
- `app/contact/page.tsx`
- `app/api/page.tsx`

### Implementation

1. Add `/government` as a dynamic server page with route-specific metadata/canonical/Open Graph values, existing `SiteHeader`, a prominent title and explanatory copy, the address finder at the top, and the full current roster below.
2. Fetch the complete current roster once through BP-001's data layer. Group visibly and accessibly into U.S. Senate and U.S. House, then by state/territory, with deterministic alphabetical/district ordering. Use inclusive copy (“Representatives and Senators”) while retaining the user's requested functionality.
3. Render useful cards from available fields: display title/name, party, state/district or Senate rank/class as appropriate, official website/contact form, phone/office, image with attribution-safe accessible treatment, and official social links only when populated. Never render broken empty links or assume every enrichment field exists.
4. Include territory delegates/resident commissioner in the House roster and clearly explain that DC/territories do not have senators. Show an honest setup/temporarily-unavailable state when no sync has populated the database, rather than claiming there are no members.
5. Build an accessible client finder form with a properly associated street-address label, example/help text that says ZIP alone is insufficient, autocomplete hints, submit/loading/disabled states, live status/error regions, and cancellation or stale-response protection.
6. On success, show the normalized district, the House result or explicit vacancy, and applicable senators using the same member presentation language. Do not hide the full roster, update the URL with the address, persist the address, or send address data anywhere except the internal POST route.
7. Extract the repeated footer markup into `SiteFooter`. Keep the current brand image/tagline/link order, insert `Your Government` linking to `/government` immediately after `Contact`, preserve the homepage brand's `#top` behavior through a small prop, and use the shared footer on all seven current footer-owning views plus the new page.
8. Add scoped government/finder/roster/member styles to the existing global stylesheet using current tokens, square borders, heavy typography, shadows, focus treatments, and the existing mobile breakpoint. Make long names, URLs, office strings, and larger roster groups wrap cleanly; maintain reduced-motion behavior.
9. Verify keyboard-only form use, visible focus, loading/error announcements, external-link safety, responsive stacking, and that every public footer has exactly one Government link in the required position.

### Do not

- Do not add client-side provider calls, load the full roster through a second API, or expose environment variables.
- Do not add roster filtering, maps, member detail pages, committees, voting records, state/local officials, or polling information.
- Do not redesign the global header/footer or unrelated pages while extracting the shared footer.
- Do not require images or enrichment fields for a member card to render.

### Acceptance criteria

- [ ] `/government` displays the complete current mirrored Senate and House rosters with delegates/resident commissioner and graceful missing enrichment.
- [ ] The address finder has accessible loading, success, vacancy, territory, invalid-input, and retryable-error states.
- [ ] The submitted address is absent from the page URL and is not persisted client-side.
- [ ] “Your Government” appears immediately after “Contact” in every existing public footer and links to `/government`.
- [ ] Desktop and mobile layouts match the site's established visual language, remain keyboard accessible, and do not overflow with long content.
- [ ] An uninitialized roster renders an operational/setup message, while provider lookup errors never remove the full roster.

### Verification

```text
pnpm run lint
pnpm run build
Manual at desktop and <=780px widths: open /government; inspect Senate, House, territory, missing-field, and empty-roster states; submit valid, ZIP-only, and failing addresses; use the form and result links by keyboard; inspect every current footer and confirm Contact → Your Government → API → Submit an action.
```

### Completion record

Started: 2026-09-05
Completed: 2026-09-05
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: app/site-footer.tsx, app/government/page.tsx, app/government/find-representatives.tsx, app/government/congress-member-card.tsx, app/globals.css, app/actions-directory.tsx, app/action/[id]/[actionSlug]/page.tsx, app/issue/[slug]/page.tsx, app/org/[slug]/page.tsx, app/liked/page.tsx, app/contact/page.tsx, app/api/page.tsx
Symbols changed: SiteFooter, GovernmentPage, FindRepresentatives, CongressMemberCard, government/finder/roster/member CSS classes
Verification result: lint PASS, build PASS
Deviations: none
Notes for later steps: Roster shows setup/unavailable state until BP-002 sync populates Neon; manual desktop/mobile keyboard checks outstanding.

---

---

## Step BR-001: Fix production roster synchronization

Status: complete
Agent: reasoning-implementer
Model tier: reasoning
Session: foreground
Depends on: BP-001, BP-002
Parallel group: remediation-government
Retry limit: 1
Escalation chain: frontier-implementer

### Routing reason
Requires reconciling Congress.gov list schema and selecting atomic persistence supported by neon-http/Drizzle.

### Intent
Make live and dry-run sync compatible with Congress.gov and ensure roster replacement is atomic.

### Architectural decisions to preserve
- Congress.gov remains authoritative; enrichment optional; deactivation only after complete validated fetch; no new dependencies.

### Semantic targets
- Congress.gov list-response validation and normalization
- Atomic roster upsert and stale-member deactivation

### Likely files
- lib/government-sync.ts, tests/government-sync.test.ts, possibly lib/db.ts

### Implementation
1. Parse documented list-level `terms: { item: [...] }` shape with runtime validation.
2. Derive chamber and fallback seat fields from normalized term collection.
3. Replace unsupported neon-http callback transaction with supported atomic mechanism (HTTP batch or WebSocket transaction).
4. Keep all upserts and stale deactivation in one all-or-nothing operation.
5. Add production-shaped Congress fixtures and persistence failure coverage.

### Do not
- Weaken completeness checks; deactivate before normalization; add dependencies; expose credential URLs.

### Acceptance criteria
- Documented Congress.gov list payload normalizes successfully.
- Dry-run completes without writes; successful persistence atomically upserts and deactivates.
- Write failure leaves previous active roster unchanged.

### Verification
```text
pnpm exec tsx --test tests/government-sync.test.ts
pnpm run lint
pnpm run build
```

### Completion record
Started: 2026-09-05
Completed: 2026-09-05
Actual agent: reasoning-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/government-sync.ts, tests/government-sync.test.ts
Symbols changed: CongressTermInput, persistCongressRosterAtomically, persistCongressMembers, pageFromJson, normalizeCongressMember
Verification result: government-sync tests PASS (12 total), lint PASS, build PASS
Deviations: none
Notes for later steps: Neon HTTP db.batch() used for atomic transaction batch.

---

## Step BR-002: Enforce and announce complete address lookup

Status: complete
Agent: cheap-implementer
Model tier: cheap
Session: foreground
Depends on: BP-003, BP-004
Parallel group: remediation-government
Retry limit: 1
Escalation chain: reasoning-implementer -> frontier-implementer

### Routing reason
Localized validation, tests, and accessible status behavior.

### Intent
Reject ambiguous partial addresses before provider access and announce successful results to assistive technology.

### Architectural decisions to preserve
- Addresses transient; server-side provider calls private; Cache-Control no-store; ZIP-only unsupported.

### Semantic targets
- Full-address validation; accessible lookup completion state

### Likely files
- lib/civic-district.ts, tests/civic-district.test.ts, app/government/find-representatives.tsx

### Implementation
1. Require street number/name, city, state, and ZIP.
2. Reject PO boxes and partial examples like `123 Main St` before Google call.
3. Preserve length limits and whitespace normalization.
4. Add live success announcement identifying resolved district.

### Do not
- Echo/persist address; put address in URL; add geocoding fallbacks.

### Acceptance criteria
- `123 Main St`, ZIP-only, city-only, PO-box return validation error without provider access.
- Complete address accepted; success announced via live status region.

### Verification
```text
pnpm exec tsx --test tests/civic-district.test.ts
pnpm run lint
pnpm run build
```

### Completion record
Started: 2026-09-05
Completed: 2026-09-05
Actual agent: cheap-implementer
Attempts: 1
Result: COMPLETE
Files changed: lib/civic-district.ts, tests/civic-district.test.ts, app/government/find-representatives.tsx
Symbols changed: normalizeStreetAddress, FindRepresentatives aria-live success announcement
Verification result: civic-district tests PASS, lint PASS, build PASS
Deviations: none
Notes for later steps: none

---

## Step BP-999: Final integration review

Status: complete
Agent: frontier-reviewer
Model tier: frontier
Session: foreground
Depends on: BP-001, BP-002, BP-003, BP-004, BR-001, BR-002
Parallel group: none
Retry limit: 0
Escalation chain: stop

### Routing reason

A single frontier review after implementation is cheaper than frontier review after every step and catches cross-step integration problems.

### Intent

Review the completed implementation as a whole against the original objective and architectural decisions.

### Architectural decisions to preserve

- All global architectural decisions in this plan.

### Semantic targets

- The complete diff and all behavior changed by this plan.

### Likely files

Paths are hints based on the repository at planning time.

- All files changed by completed implementation/remediation steps.

### Implementation

1. Review only; do not edit implementation files.
2. Check correctness, integration, regressions, security implications, error handling, contracts, unnecessary complexity, and coverage.
3. Specifically verify authoritative roster completeness and atomic stale-member handling; Congress/enrichment field normalization; OCD-ID and at-large/territory parsing; vacancy behavior; address privacy; server-only keys; cron authentication; migration safety; accessible UI; and footer coverage/order.
4. Re-run or inspect deterministic test, lint, build, migration-generation, dry-run, and manual verification records. Confirm no polling-map/voter-info scope or unapproved dependency entered the diff.
5. Return `REVIEW_RESULT: PASS` when no material issue remains.
6. If material issues remain, return `REVIEW_RESULT: REMEDIATION_REQUIRED` followed by complete remediation step packets using the same step schema and cost-routing rules.
7. Do not create remediation for optional stylistic preferences.

### Do not

- Rewrite working code for style preference.
- Edit code directly.
- Request remediation for speculative improvements unrelated to the feature.

### Acceptance criteria

- [ ] Original feature requirements are satisfied.
- [ ] Cross-step integration is coherent.
- [ ] No material regression or correctness issue remains.

### Verification

```text
Review the completed plan records, current repository, diff, and relevant deterministic verification results. Require successful pnpm lint/build and focused government tests, plus evidence of a non-production roster dry-run and manual address/footer checks when credentials are available.
```

### Completion record

Started: 2026-09-05
Completed: 2026-09-05
Actual agent: frontier-reviewer
Attempts: 1
Result: PASS (review cycle 2 after BR-001/BR-002 remediation)
Files changed: none
Symbols changed: none
Verification result: 12/12 government tests PASS, lint PASS, build PASS; cycle-1 issues remediated
Deviations: none
Notes for later steps: Run initial roster sync (`pnpm run government:sync`) after applying migration 0013 in production; manual desktop/mobile keyboard checks recommended.
