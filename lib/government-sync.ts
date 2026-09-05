import { stripHtmlToText } from './plain-text';

type JsonRecord = Record<string, unknown>;

const CONGRESS_MEMBERS_URL = 'https://api.congress.gov/v3/member';
const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const SOCIAL_URL = 'https://unitedstates.github.io/congress-legislators/legislators-social-media.json';
const OFFICES_URL = 'https://unitedstates.github.io/congress-legislators/legislators-district-offices.json';
const FETCH_TIMEOUT_MS = 30_000;
const MINIMUM_CURRENT_MEMBERS = 500;

export type CongressMemberInput = {
  bioguideId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  directOrderName?: string;
  partyName?: string;
  party?: string;
  state?: string;
  district?: number | string | null;
  updateDate?: string;
  url?: string;
  depiction?: { imageUrl?: string; attribution?: string };
  terms: CongressTermInput[];
};

export type CongressTermInput = {
  chamber?: string;
  memberType?: string;
  stateCode?: string;
  district?: number | string;
  startYear?: number;
  endYear?: number;
};

export type CongressPage = {
  members: CongressMemberInput[];
  pagination: { count: number; next?: string | null };
};

type LegislatorTerm = {
  type?: string;
  state?: string;
  district?: number | string;
  class?: number;
  state_rank?: number;
  party?: string;
  url?: string;
  contact?: string;
  phone?: string;
  office?: string;
  address?: string;
  start?: string;
  end?: string;
};

type OfficesFeed = Array<{ id?: { bioguide?: string }; offices?: Array<{ address?: string; building?: string; city?: string; state?: string; zip?: string; phone?: string; fax?: string; hours?: string }> }>;

export type NormalizedCongressMember = {
  bioguideId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  nickname: string | null;
  officialFullName: string;
  party: string;
  chamber: 'house' | 'senate';
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
  officialSocialHandles: Record<string, string> | null;
  districtOffices: NonNullable<OfficesFeed[number]['offices']> | null;
  providerUpdatedAt: Date | null;
  syncedAt: Date;
  isCurrent: true;
};

export type SyncResult = {
  dryRun: boolean;
  fetched: number;
  upserted: number;
  deactivated: number;
  warnings: string[];
  durationMs: number;
};

export type SyncOptions = {
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  persist?: (members: NormalizedCongressMember[]) => Promise<number>;
};

const STATE_CODES: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE',
  FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA', KANSAS: 'KS', KENTUCKY: 'KY',
  LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO',
  MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH', OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY', 'DISTRICT OF COLUMBIA': 'DC', 'PUERTO RICO': 'PR', GUAM: 'GU',
  'AMERICAN SAMOA': 'AS', 'NORTHERN MARIANA ISLANDS': 'MP', 'U.S. VIRGIN ISLANDS': 'VI', 'UNITED STATES VIRGIN ISLANDS': 'VI',
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeDistrict(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'at-large' || normalized === 'at large' || normalized === '0' || normalized === '00') return 0;
    if (/^\d+$/.test(normalized)) return Number(normalized);
  }
  return null;
}

function normalizeState(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : STATE_CODES[upper] ?? null;
}

function termsFromJson(value: unknown, bioguideId: string): CongressTermInput[] {
  const termsValue = Array.isArray(value) ? value : record(value)?.item;
  if (!Array.isArray(termsValue) || termsValue.length === 0) {
    throw new Error(`Congress.gov member ${bioguideId} has malformed terms.`);
  }

  return termsValue.map((term) => {
    const row = record(term);
    if (!row) throw new Error(`Congress.gov member ${bioguideId} has malformed terms.`);
    const district = row.district;
    const startYear = row.startYear;
    const endYear = row.endYear;
    if (
      (district !== undefined && typeof district !== 'string' && typeof district !== 'number')
      || (startYear !== undefined && number(startYear) === undefined)
      || (endYear !== undefined && number(endYear) === undefined)
    ) {
      throw new Error(`Congress.gov member ${bioguideId} has malformed terms.`);
    }
    return {
      chamber: string(row.chamber),
      memberType: string(row.memberType),
      stateCode: string(row.stateCode),
      district: district as number | string | undefined,
      startYear: number(startYear),
      endYear: number(endYear),
    };
  });
}

function pageFromJson(value: unknown): CongressPage {
  const root = record(value);
  const members = root && Array.isArray(root.members) ? root.members : null;
  const pagination = root && record(root.pagination);
  const count = pagination ? number(pagination.count) : undefined;
  if (!members || !pagination || count === undefined || count < MINIMUM_CURRENT_MEMBERS) {
    throw new Error('Congress.gov returned an incomplete or malformed current-member roster.');
  }
  const parsed = members.map((member) => {
    const row = record(member);
    const bioguideId = row && string(row.bioguideId);
    if (!row || !bioguideId) throw new Error('Congress.gov returned a member without a bioguide ID.');
    return {
      bioguideId,
      firstName: string(row.firstName),
      middleName: string(row.middleName),
      lastName: string(row.lastName),
      name: string(row.name),
      directOrderName: string(row.directOrderName),
      partyName: string(row.partyName),
      party: string(row.party),
      state: string(row.state),
      district: (typeof row.district === 'number' || typeof row.district === 'string' || row.district === null) ? row.district : undefined,
      updateDate: string(row.updateDate),
      url: string(row.url),
      depiction: record(row.depiction) ? {
        imageUrl: string(record(row.depiction)?.imageUrl),
        attribution: string(record(row.depiction)?.attribution),
      } : undefined,
      terms: termsFromJson(row.terms, bioguideId),
    };
  });
  const next = string(pagination.next) ?? null;
  return { members: parsed, pagination: { count, next } };
}

async function fetchJson(fetchImpl: typeof fetch, url: string, label: string): Promise<unknown> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${label} request failed (${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

export async function fetchCurrentCongressMembers(fetchImpl: typeof fetch, apiKey: string): Promise<CongressMemberInput[]> {
  const url = new URL(CONGRESS_MEMBERS_URL);
  url.searchParams.set('currentMember', 'true');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '250');
  url.searchParams.set('api_key', apiKey);

  const members: CongressMemberInput[] = [];
  const seenPages = new Set<string>();
  let next: string | null = url.toString();
  let expectedCount: number | undefined;
  while (next) {
    if (seenPages.has(next)) throw new Error('Congress.gov pagination repeated a page.');
    seenPages.add(next);
    const page = pageFromJson(await fetchJson(fetchImpl, next, 'Congress.gov'));
    if (expectedCount !== undefined && page.pagination.count !== expectedCount) throw new Error('Congress.gov changed its reported roster count during pagination.');
    expectedCount = page.pagination.count;
    members.push(...page.members);
    if (members.length > expectedCount) throw new Error('Congress.gov pagination returned more members than reported.');
    if (!page.pagination.next) {
      next = null;
    } else {
      const nextUrl = new URL(page.pagination.next);
      if (nextUrl.origin !== 'https://api.congress.gov' || nextUrl.pathname !== '/v3/member') {
        throw new Error('Congress.gov returned an invalid pagination URL.');
      }
      nextUrl.searchParams.set('api_key', apiKey);
      next = nextUrl.toString();
    }
  }
  if (!expectedCount || members.length !== expectedCount) throw new Error('Congress.gov pagination ended before the complete roster was fetched.');
  const ids = new Set(members.map((member) => member.bioguideId));
  if (ids.size !== members.length) throw new Error('Congress.gov returned duplicate bioguide IDs.');
  return members;
}

function feedArray(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value) || value.some((item) => !record(item))) throw new Error(`${label} returned malformed JSON.`);
  return value as JsonRecord[];
}

function mapByBioguide<T extends JsonRecord>(rows: T[]): Map<string, T> {
  const mapped = new Map<string, T>();
  for (const row of rows) {
    const id = record(row.id);
    const bioguide = id && string(id.bioguide);
    if (bioguide) mapped.set(bioguide, row);
  }
  return mapped;
}

function latestTerm(row: JsonRecord | undefined, chamber: 'house' | 'senate'): LegislatorTerm | undefined {
  const terms = row && Array.isArray(row.terms) ? row.terms.map(record).filter((term): term is JsonRecord => term !== null) : [];
  const type = chamber === 'house' ? 'rep' : 'sen';
  const relevant = terms.filter((term) => string(term.type)?.toLowerCase() === type);
  relevant.sort((left, right) => (string(right.end) ?? '').localeCompare(string(left.end) ?? '') || (string(right.start) ?? '').localeCompare(string(left.start) ?? ''));
  return relevant[0] as LegislatorTerm | undefined;
}

function currentCongressTerm(member: CongressMemberInput): CongressTermInput {
  return [...member.terms].sort((left, right) =>
    (right.endYear ?? Number.MAX_SAFE_INTEGER) - (left.endYear ?? Number.MAX_SAFE_INTEGER)
    || (right.startYear ?? 0) - (left.startYear ?? 0),
  )[0];
}

function authoritativeChamber(member: CongressMemberInput, term: CongressTermInput): 'house' | 'senate' {
  const value = term?.chamber?.toLowerCase() ?? term?.memberType?.toLowerCase();
  if (value?.includes('house') || value?.includes('rep')) return 'house';
  if (value?.includes('sen')) return 'senate';
  throw new Error(`Congress.gov member ${member.bioguideId} has no recognizable chamber.`);
}

function nameParts(member: CongressMemberInput, enrichment?: JsonRecord) {
  const name = enrichment && record(enrichment.name);
  const full = string(name?.official_full) ?? member.directOrderName ?? member.name;
  const firstName = string(name?.first) ?? member.firstName ?? full?.split(/\s+/)[0];
  const lastName = string(name?.last) ?? member.lastName ?? full?.split(/\s+/).at(-1);
  if (!firstName || !lastName || !full) throw new Error(`Congress.gov member ${member.bioguideId} has an unusable name.`);
  return { firstName, lastName, officialFullName: full, middleName: string(name?.middle) ?? member.middleName ?? null, suffix: string(name?.suffix) ?? null, nickname: string(name?.nickname) ?? null };
}

export function normalizeCongressMember(member: CongressMemberInput, enrichment?: JsonRecord, social?: JsonRecord, offices?: JsonRecord, syncedAt = new Date()): NormalizedCongressMember {
  const congressTerm = currentCongressTerm(member);
  const chamber = authoritativeChamber(member, congressTerm);
  const enrichmentTerm = latestTerm(enrichment, chamber);
  const state = normalizeState(congressTerm.stateCode ?? enrichmentTerm?.state ?? member.state);
  if (!state) throw new Error(`Congress.gov member ${member.bioguideId} has an unrecognized state.`);
  const district = chamber === 'house' ? normalizeDistrict(congressTerm.district ?? enrichmentTerm?.district ?? member.district) : null;
  if (chamber === 'house' && district === null) throw new Error(`House member ${member.bioguideId} has no valid district.`);
  const socialValues = social && record(social.social);
  const officeValues = offices && Array.isArray(offices.offices) ? offices.offices.filter((office): office is NonNullable<OfficesFeed[number]['offices']>[number] => record(office) !== null) : [];
  const socialHandles: Record<string, string> = {};
  for (const [key, value] of Object.entries(socialValues ?? {})) {
    if (typeof value === 'string' && value.trim()) socialHandles[key] = value.trim();
  }
  const names = nameParts(member, enrichment);
  const title = chamber === 'senate' ? 'Senator' : state === 'PR' ? 'Resident Commissioner' : ['DC', 'AS', 'GU', 'MP', 'VI'].includes(state) ? 'Delegate' : 'Representative';
  const updated = member.updateDate ? new Date(member.updateDate) : null;
  return {
    bioguideId: member.bioguideId, ...names, party: enrichmentTerm?.party ?? member.partyName ?? member.party ?? 'Unknown', chamber, state, district,
    senateClass: chamber === 'senate' && typeof enrichmentTerm?.class === 'number' ? enrichmentTerm.class : null,
    senateRank: chamber === 'senate' && typeof enrichmentTerm?.state_rank === 'number' ? enrichmentTerm.state_rank : null,
    displayTitle: title, officialWebsite: enrichmentTerm?.url ?? null, contactFormUrl: enrichmentTerm?.contact ?? null, capitolPhone: enrichmentTerm?.phone ?? null,
    capitolOffice: enrichmentTerm?.office ?? null, mailingAddress: enrichmentTerm?.address ?? null, congressGovProfileUrl: member.url ?? null,
    officialImageUrl: member.depiction?.imageUrl ?? null, officialImageAttribution: stripHtmlToText(member.depiction?.attribution ?? null),
    officialSocialHandles: Object.keys(socialHandles).length ? socialHandles : null,
    districtOffices: officeValues.length ? officeValues : null, providerUpdatedAt: updated && !Number.isNaN(updated.valueOf()) ? updated : null, syncedAt, isCurrent: true,
  };
}

export function staleBioguideIds(currentIds: Iterable<string>, authoritativeIds: Iterable<string>): string[] {
  const authoritative = new Set(authoritativeIds);
  return [...currentIds].filter((id) => !authoritative.has(id));
}

export type CongressRosterBatchExecutor<TUpsert, TDeactivate, TResult> = {
  upsert: (member: NormalizedCongressMember) => TUpsert;
  deactivateNotIn: (bioguideIds: string[]) => TDeactivate;
  batch: (statements: readonly [TUpsert | TDeactivate, ...(TUpsert | TDeactivate)[]]) => Promise<ReadonlyArray<TResult>>;
};

export async function persistCongressRosterAtomically<TUpsert, TDeactivate, TResult>(
  members: NormalizedCongressMember[],
  executor: CongressRosterBatchExecutor<TUpsert, TDeactivate, TResult>,
): Promise<TResult> {
  const statements: [TUpsert | TDeactivate, ...(TUpsert | TDeactivate)[]] = [
    executor.deactivateNotIn(members.map((member) => member.bioguideId)),
  ];
  statements.unshift(...members.map(executor.upsert));
  const results = await executor.batch(statements);
  const deactivation = results.at(-1);
  if (deactivation === undefined) throw new Error('Congress roster persistence returned no deactivation result.');
  return deactivation;
}

export async function persistCongressMembers(members: NormalizedCongressMember[]): Promise<number> {
  const [{ db }, { congressMembers }, operators] = await Promise.all([
    import('@/lib/db'), import('@/db/schema'), import('drizzle-orm'),
  ]);
  const now = new Date();
  const deactivated = await persistCongressRosterAtomically(members, {
    upsert(member) {
      const { bioguideId: _bioguideId, ...updates } = member;
      void _bioguideId;
      return db.insert(congressMembers).values(member).onConflictDoUpdate({
        target: congressMembers.bioguideId,
        set: updates,
      });
    },
    deactivateNotIn(bioguideIds) {
      return db.update(congressMembers)
        .set({ isCurrent: false, syncedAt: now })
        .where(operators.and(operators.eq(congressMembers.isCurrent, true), operators.not(operators.inArray(congressMembers.bioguideId, bioguideIds))))
        .returning({ bioguideId: congressMembers.bioguideId });
    },
    batch(statements) {
      return db.batch(statements);
    },
  });
  if (!Array.isArray(deactivated)) {
    throw new Error('Congress roster deactivation returned an unexpected result.');
  }
  return deactivated.length;
}

export async function syncCongress(options: SyncOptions = {}): Promise<SyncResult> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = process.env.CONGRESS_API_KEY;
  if (!apiKey) throw new Error('CONGRESS_API_KEY is not configured.');
  const authoritative = await fetchCurrentCongressMembers(fetchImpl, apiKey);
  const enrichmentResults = await Promise.allSettled([
    fetchJson(fetchImpl, LEGISLATORS_URL, 'Legislator enrichment'),
    fetchJson(fetchImpl, SOCIAL_URL, 'Social-media enrichment'),
    fetchJson(fetchImpl, OFFICES_URL, 'District-office enrichment'),
  ]);
  const warnings: string[] = [];
  function enrichmentMap(index: number, label: string) {
    const result = enrichmentResults[index];
    if (result.status === 'rejected') {
      warnings.push(`${label} was unavailable: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`);
      return new Map<string, JsonRecord>();
    }
    try {
      return mapByBioguide(feedArray(result.value, label));
    } catch (error) {
      warnings.push(`${label} was unusable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return new Map<string, JsonRecord>();
    }
  }
  const legislators = enrichmentMap(0, 'Legislator enrichment');
  const social = enrichmentMap(1, 'Social-media enrichment');
  const offices = enrichmentMap(2, 'District-office enrichment');
  const syncedAt = new Date();
  const normalized = authoritative.map((member) => {
    if (legislators.size > 0 && !legislators.has(member.bioguideId)) warnings.push(`Missing legislator enrichment for ${member.bioguideId}.`);
    return normalizeCongressMember(member, legislators.get(member.bioguideId), social.get(member.bioguideId), offices.get(member.bioguideId), syncedAt);
  });
  const ids = new Set(normalized.map((member) => member.bioguideId));
  if (ids.size !== normalized.length) throw new Error('Normalized roster contains duplicate bioguide IDs.');
  const deactivated = options.dryRun ? 0 : await (options.persist ?? persistCongressMembers)(normalized);
  return { dryRun: Boolean(options.dryRun), fetched: authoritative.length, upserted: normalized.length, deactivated, warnings, durationMs: Date.now() - startedAt };
}
