import {
  currentCongressForDate,
  FEDERAL_LEGISLATION_SYNC_SCOPE,
  FIRST_CONGRESS_YEAR,
  isLegislativeLifecycleStage,
  type FederalOriginChamber,
  type LegislativeLifecycleStage,
} from './legislative-bills';

type JsonRecord = Record<string, unknown>;

const CONGRESS_API_ORIGIN = 'https://api.congress.gov';
const CONGRESS_BILLS_PATH_PREFIX = '/v3/bill';
const FETCH_TIMEOUT_MS = 30_000;
const BILL_PAGE_LIMIT = 250;
const ACTION_PAGE_LIMIT = 250;
export const CONGRESS_BILL_WATERMARK_OVERLAP_MS = 24 * 60 * 60 * 1000;

const HOUSE_BILL_TYPES = new Set(['HR', 'HRES', 'HJRES', 'HCONRES']);
const SENATE_BILL_TYPES = new Set(['S', 'SRES', 'SJRES', 'SCONRES']);

const BILL_TYPE_CITATION: Record<string, string> = {
  HR: 'H.R.',
  S: 'S.',
  HRES: 'H.Res.',
  SRES: 'S.Res.',
  HJRES: 'H.J.Res.',
  SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.',
  SCONRES: 'S.Con.Res.',
};

const BILL_TYPE_PUBLIC_SLUG: Record<string, string> = {
  HR: 'house-bill',
  S: 'senate-bill',
  HRES: 'house-resolution',
  SRES: 'senate-resolution',
  HJRES: 'house-joint-resolution',
  SJRES: 'senate-joint-resolution',
  HCONRES: 'house-concurrent-resolution',
  SCONRES: 'senate-concurrent-resolution',
};

export type CongressBillListItem = {
  congress: number;
  billType: string;
  billNumber: string;
  title: string | null;
  updateDate: string | null;
  apiUrl: string | null;
};

export type CongressBillActionInput = {
  actionDate?: string;
  actionTime?: string;
  text?: string;
  type?: string;
  actionCode?: string;
  sourceSystemName?: string;
};

export type CongressBillDetailInput = {
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  introducedDate?: string;
  updateDate?: string;
  latestAction?: { actionDate?: string; actionTime?: string; text?: string };
  laws?: Array<{ type?: string; number?: string }>;
};

export type CongressLifecycleMapping = {
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  latestActionBody: string | null;
};

export type NormalizedCongressBillAction = {
  providerActionKey: string;
  actionDate: Date | null;
  body: string | null;
  description: string;
  providerActionCode: string | null;
  stage: LegislativeLifecycleStage;
  sortOrder: number;
};

export type NormalizedCongressBill = {
  source: 'congress';
  providerBillId: string;
  congress: number;
  jurisdiction: 'US';
  billNumber: string;
  billType: string;
  title: string;
  description: string;
  originChamber: FederalOriginChamber;
  latestActionBody: string | null;
  latestActionText: string | null;
  latestActionDate: Date | null;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  providerStatus: string | null;
  providerStatusCode: string | null;
  publicSourceUrl: string;
  providerUpdatedAt: Date | null;
  detailsPending: false;
  fingerprint: string;
};

export type NormalizedCongressSession = {
  source: 'congress';
  providerSessionId: string;
  jurisdiction: 'US';
  displayName: string;
  yearStart: number;
  yearEnd: number;
  startsAt: Date;
  endsAt: Date;
  isCurrent: true;
};

export const DEFAULT_CONGRESS_DETAIL_BUDGET = 200;

export type CongressBillSyncOutcome = 'complete' | 'successful-with-backlog';

export type CongressBillCheckpointMetadata = {
  requestCount?: number;
  windowFrom?: string;
  windowTo?: string;
  billsAccepted?: number;
  resumeAfter?: string;
};

export type CongressBillCheckpoint = {
  watermark: string | null;
  lastSuccessAt: Date | null;
  metadata?: CongressBillCheckpointMetadata;
};

export type CongressBillStore = {
  upsertSession(session: NormalizedCongressSession): Promise<{ id: number }>;
  upsertBill(
    bill: NormalizedCongressBill,
    actions: NormalizedCongressBillAction[],
    sessionId: number,
  ): Promise<void>;
  loadCheckpoint(): Promise<CongressBillCheckpoint | null>;
  saveCheckpoint(checkpoint: CongressBillCheckpoint): Promise<void>;
};

export type CongressBillSyncOptions = {
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  persist?: CongressBillStore;
  detailBudget?: number;
};

export type CongressBillSyncResult = {
  dryRun: boolean;
  congress: number;
  mode: 'bootstrap' | 'incremental';
  outcome: CongressBillSyncOutcome;
  fetched: number;
  accepted: number;
  rejected: number;
  warnings: string[];
  durationMs: number;
  watermarkAdvanced: boolean;
  windowFrom: string | null;
  windowTo: string | null;
};

export class UnrecognizedCongressBillTypeError extends Error {
  readonly billType: string;

  constructor(billType: string) {
    super(`Unrecognized Congress.gov bill type: ${billType}`);
    this.name = 'UnrecognizedCongressBillTypeError';
    this.billType = billType;
  }
}

export class CongressRequestError extends Error {
  readonly statusCode?: number;
  readonly timedOut: boolean;

  constructor(message: string, options?: { statusCode?: number; timedOut?: boolean; cause?: unknown }) {
    super(message);
    this.name = 'CongressRequestError';
    this.statusCode = options?.statusCode;
    this.timedOut = options?.timedOut === true;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export function resolveCongressDetailBudget(
  value: unknown = process.env.CONGRESS_DETAIL_BUDGET,
  fallback = DEFAULT_CONGRESS_DETAIL_BUDGET,
) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('CONGRESS_DETAIL_BUDGET must be a non-negative integer.');
  }
  return parsed;
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function billNumberValue(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  const text = string(value);
  return text && /^\d+$/.test(text) ? String(Number.parseInt(text, 10)) : undefined;
}

export function normalizeCongressBillType(value: string) {
  return value.trim().toUpperCase().replace(/[.\s]/g, '');
}

export function originChamberFromBillType(value: string): FederalOriginChamber | null {
  const billType = normalizeCongressBillType(value);
  if (HOUSE_BILL_TYPES.has(billType)) return 'house';
  if (SENATE_BILL_TYPES.has(billType)) return 'senate';
  return null;
}

export function congressBillProviderId(congress: number, billType: string, billNumber: string) {
  return `${congress}-${normalizeCongressBillType(billType).toLowerCase()}-${billNumber}`;
}

export function congressOrdinal(congress: number) {
  const mod100 = congress % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${congress}th`;
  switch (congress % 10) {
    case 1: return `${congress}st`;
    case 2: return `${congress}nd`;
    case 3: return `${congress}rd`;
    default: return `${congress}th`;
  }
}

export function congressSessionFromNumber(congress: number): NormalizedCongressSession {
  const yearStart = FIRST_CONGRESS_YEAR + (congress - 1) * 2;
  const yearEnd = yearStart + 2;
  return {
    source: 'congress',
    providerSessionId: String(congress),
    jurisdiction: 'US',
    displayName: `${congressOrdinal(congress)} Congress`,
    yearStart,
    yearEnd,
    startsAt: new Date(Date.UTC(yearStart, 0, 3)),
    endsAt: new Date(Date.UTC(yearEnd, 0, 3)),
    isCurrent: true,
  };
}

export function congressBillPublicUrl(congress: number, billType: string, billNumber: string) {
  const slug = BILL_TYPE_PUBLIC_SLUG[normalizeCongressBillType(billType)];
  if (!slug) {
    throw new UnrecognizedCongressBillTypeError(billType);
  }
  return `https://www.congress.gov/bill/${congressOrdinal(congress).toLowerCase()}-congress/${slug}/${billNumber}`;
}

export function formatCongressBillNumber(billType: string, billNumber: string) {
  const citation = BILL_TYPE_CITATION[normalizeCongressBillType(billType)];
  if (!citation) {
    throw new UnrecognizedCongressBillTypeError(billType);
  }
  return `${citation} ${billNumber}`;
}

export function formatCongressDateTime(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00Z`;
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfNextUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

export function redactCongressApiKey(value: string, apiKey?: string) {
  let redacted = value.replace(/([?&]api_key=)[^&]*/gi, '$1[redacted]');
  if (apiKey) redacted = redacted.split(apiKey).join('[redacted]');
  return redacted;
}

function parseCongressDate(date?: string, time?: string): Date | null {
  if (!date) return null;
  if (time && !date.includes('T')) {
    const parsed = new Date(`${date}T${time.endsWith('Z') ? time : `${time}Z`}`);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T00:00:00Z`);
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function itemsFrom(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  const wrapped = record(value);
  if (wrapped && Array.isArray(wrapped.item)) return wrapped.item;
  return null;
}

function inferActionBody(sourceSystemName?: string, text?: string): string | null {
  const source = sourceSystemName?.toLowerCase() ?? '';
  if (source.includes('senate')) return 'Senate';
  if (source.includes('house')) return 'House';

  const value = text ?? '';
  if (/\bpresident\b/i.test(value) || /\bwhite house\b/i.test(value)) return 'President';
  if (/\bin the senate\b/i.test(value) || /\breceived in (the )?senate\b/i.test(value) || /\bpassed senate\b/i.test(value)) {
    return 'Senate';
  }
  if (/\bin the house\b/i.test(value) || /\breceived in (the )?house\b/i.test(value) || /\bpassed house\b/i.test(value)) {
    return 'House';
  }
  return null;
}

function otherChamberName(originChamber: FederalOriginChamber) {
  return originChamber === 'house' ? 'Senate' : 'House';
}

export function mapCongressLifecycle(input: {
  originChamber: FederalOriginChamber;
  actionType?: string;
  actionText?: string;
  actionCode?: string;
  sourceSystemName?: string;
  hasLawRecord?: boolean;
}): CongressLifecycleMapping {
  const text = input.actionText ?? '';
  const type = input.actionType?.trim() ?? '';
  const latestActionBody = inferActionBody(input.sourceSystemName, text);
  void input.actionCode;

  if (input.hasLawRecord || type === 'BecameLaw' || /\bbecame (public|private) law\b/i.test(text) || /^\s*signed by president\b/i.test(text)) {
    return { stage: 'law', isActive: false, latestActionBody: latestActionBody ?? 'President' };
  }

  if (type === 'Veto' || /\bpocket vetoed\b/i.test(text) || /\bvetoed by president\b/i.test(text) || /\bveto sustained\b/i.test(text)) {
    return { stage: 'vetoed', isActive: false, latestActionBody: latestActionBody ?? 'President' };
  }

  if (
    /\bfailed of passage\b/i.test(text)
    || /\bfailed by (the )?(yeas and nays|yea-?nay|recorded vote|voice vote)\b/i.test(text)
    || /\bmotion to discharge failed\b/i.test(text)
    || /\bwithdrawn from further consideration\b/i.test(text)
    || /^\s*withdrawn\b/i.test(text)
  ) {
    return { stage: 'failed', isActive: false, latestActionBody };
  }

  if (/\bpresented to president\b/i.test(text) || /\benrolled\b/i.test(text)) {
    return { stage: 'enrolled', isActive: true, latestActionBody: latestActionBody ?? 'President' };
  }

  if (type === 'President') {
    return { stage: 'executive', isActive: true, latestActionBody: latestActionBody ?? 'President' };
  }

  let stage: LegislativeLifecycleStage = 'other';
  if (type === 'ResolvingDifferences' || /\bconference\b/i.test(text) || /\bresolving differences\b/i.test(text)) {
    stage = 'cross_chamber';
  } else if (type === 'Committee' || /\breferred to (the )?(house |senate )?committee\b/i.test(text)) {
    stage = 'committee';
  } else if (type === 'Calendars' || type === 'Floor' || /\bpassed (the )?(house|senate)\b/i.test(text) || /\bplaced on the .+ calendar\b/i.test(text)) {
    stage = 'floor';
  } else if (type === 'IntroReferral' || /^\s*introduced\b/i.test(text)) {
    stage = /\breferred\b/i.test(text) ? 'committee' : 'introduced';
  } else if (type === 'Discharge') {
    stage = 'committee';
  }

  if (
    latestActionBody === otherChamberName(input.originChamber)
    && (stage === 'floor' || stage === 'committee' || stage === 'introduced' || stage === 'other')
  ) {
    stage = 'cross_chamber';
  }

  if (/\breceived in (the )?(house|senate)\b/i.test(text)) {
    stage = 'cross_chamber';
  }

  return { stage, isActive: true, latestActionBody };
}

function requireStage(value: string): LegislativeLifecycleStage {
  if (!isLegislativeLifecycleStage(value)) return 'other';
  return value;
}

export function normalizeCongressBillActions(
  actions: CongressBillActionInput[],
  originChamber: FederalOriginChamber,
): NormalizedCongressBillAction[] {
  const usedKeys = new Set<string>();
  const dated = actions.map((action, index) => ({
    action,
    index,
    date: parseCongressDate(action.actionDate, action.actionTime),
  }));
  dated.sort((left, right) => {
    const leftTime = left.date?.valueOf() ?? Number.NEGATIVE_INFINITY;
    const rightTime = right.date?.valueOf() ?? Number.NEGATIVE_INFINITY;
    return leftTime - rightTime || left.index - right.index;
  });

  return dated.map((row, sortOrder) => {
    const mapping = mapCongressLifecycle({
      originChamber,
      actionType: row.action.type,
      actionText: row.action.text,
      actionCode: row.action.actionCode,
      sourceSystemName: row.action.sourceSystemName,
    });
    const description = row.action.text?.trim() || 'Action recorded';
    const baseKey = [
      row.action.actionDate ?? '',
      row.action.actionTime ?? '',
      row.action.actionCode ?? '',
      row.action.type ?? '',
      description,
    ].join('|');
    let providerActionKey = baseKey || `seq:${row.index}`;
    if (usedKeys.has(providerActionKey)) providerActionKey = `${providerActionKey}#${row.index}`;
    usedKeys.add(providerActionKey);

    return {
      providerActionKey,
      actionDate: row.date,
      body: mapping.latestActionBody,
      description,
      providerActionCode: row.action.actionCode ?? null,
      stage: requireStage(mapping.stage),
      sortOrder,
    };
  });
}

export function normalizeCongressBill(
  detail: CongressBillDetailInput,
  actions: CongressBillActionInput[] = [],
): NormalizedCongressBill {
  const originChamber = originChamberFromBillType(detail.billType);
  if (!originChamber) throw new UnrecognizedCongressBillTypeError(detail.billType);

  const title = detail.title.trim();
  if (!title) throw new Error('Congress.gov bill is missing a title.');

  const mergedActions = [...actions];
  if (detail.latestAction?.text) {
    const alreadyPresent = mergedActions.some((action) => (
      action.text === detail.latestAction?.text
      && action.actionDate === detail.latestAction?.actionDate
    ));
    if (!alreadyPresent) {
      mergedActions.push({
        actionDate: detail.latestAction.actionDate,
        actionTime: detail.latestAction.actionTime,
        text: detail.latestAction.text,
      });
    }
  }

  const normalizedActions = normalizeCongressBillActions(mergedActions, originChamber);
  const latestAction = normalizedActions.at(-1);
  const latestInput: CongressBillActionInput | undefined = mergedActions.length
    ? [...mergedActions].sort((left, right) => {
      const leftTime = parseCongressDate(left.actionDate, left.actionTime)?.valueOf() ?? Number.NEGATIVE_INFINITY;
      const rightTime = parseCongressDate(right.actionDate, right.actionTime)?.valueOf() ?? Number.NEGATIVE_INFINITY;
      return leftTime - rightTime;
    }).at(-1)
    : detail.latestAction;
  const lifecycle = mapCongressLifecycle({
    originChamber,
    actionType: latestInput?.type,
    actionText: latestInput?.text ?? detail.latestAction?.text,
    actionCode: latestInput?.actionCode,
    sourceSystemName: latestInput?.sourceSystemName,
    hasLawRecord: Boolean(detail.laws?.length),
  });
  const updateDate = parseCongressDate(detail.updateDate) ?? parseCongressDate(detail.introducedDate);
  const billType = normalizeCongressBillType(detail.billType);

  return {
    source: 'congress',
    providerBillId: congressBillProviderId(detail.congress, billType, detail.billNumber),
    congress: detail.congress,
    jurisdiction: 'US',
    billNumber: formatCongressBillNumber(billType, detail.billNumber),
    billType,
    title,
    description: '',
    originChamber,
    latestActionBody: lifecycle.latestActionBody,
    latestActionText: latestAction?.description ?? detail.latestAction?.text ?? null,
    latestActionDate: latestAction?.actionDate ?? parseCongressDate(detail.latestAction?.actionDate, detail.latestAction?.actionTime),
    stage: lifecycle.stage,
    isActive: lifecycle.isActive,
    providerStatus: latestInput?.type ?? null,
    providerStatusCode: latestInput?.actionCode ?? null,
    publicSourceUrl: congressBillPublicUrl(detail.congress, billType, detail.billNumber),
    providerUpdatedAt: updateDate,
    detailsPending: false,
    fingerprint: detail.updateDate ?? detail.introducedDate ?? `${detail.congress}-${billType}-${detail.billNumber}`,
  };
}

function assertAllowedCongressUrl(rawUrl: string, apiKey: string, kind: 'list' | 'detail' | 'actions', congress?: number) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Congress.gov returned an invalid pagination URL: ${redactCongressApiKey(rawUrl, apiKey)}`);
  }

  if (parsed.protocol !== 'https:' || parsed.origin !== CONGRESS_API_ORIGIN) {
    throw new Error(`Congress.gov returned an invalid pagination URL: ${redactCongressApiKey(parsed.toString(), apiKey)}`);
  }

  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  const congressSegment = congress === undefined ? '\\d+' : String(congress);
  const typeSegment = 'hr|s|hres|sres|hjres|sjres|hconres|sconres';
  const patterns = {
    list: new RegExp(`^${CONGRESS_BILLS_PATH_PREFIX}/${congressSegment}$`, 'i'),
    detail: new RegExp(`^${CONGRESS_BILLS_PATH_PREFIX}/${congressSegment}/(?:${typeSegment})/\\d+$`, 'i'),
    actions: new RegExp(`^${CONGRESS_BILLS_PATH_PREFIX}/${congressSegment}/(?:${typeSegment})/\\d+/actions$`, 'i'),
  };

  if (!patterns[kind].test(path)) {
    throw new Error(`Congress.gov returned an invalid pagination URL: ${redactCongressApiKey(parsed.toString(), apiKey)}`);
  }

  return parsed;
}

function pageIdentity(url: URL) {
  const copy = new URL(url);
  copy.searchParams.delete('api_key');
  return copy.toString();
}

function isAbortTimeout(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'TimeoutError' || name === 'AbortError';
}

function isCongressQuotaStop(error: unknown) {
  return error instanceof CongressRequestError && (error.statusCode === 429 || error.timedOut);
}

async function fetchCongressJson(fetchImpl: typeof fetch, url: string, apiKey: string, label: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (isAbortTimeout(error)) {
      throw new CongressRequestError(`${label} request timed out.`, { timedOut: true, cause: error });
    }
    throw error;
  }
  if (!response.ok) {
    throw new CongressRequestError(`${label} request failed (${response.status}).`, { statusCode: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function billsFromPage(value: unknown): { bills: CongressBillListItem[]; count: number; next: string | null } {
  const root = record(value);
  const billsValue = root && itemsFrom(root.bills);
  const pagination = root && record(root.pagination);
  const count = pagination ? number(pagination.count) : undefined;
  if (!root || !billsValue || !pagination || count === undefined || !Number.isInteger(count) || count < 0) {
    throw new Error('Congress.gov returned an incomplete or malformed bill list.');
  }

  const bills = billsValue.map((item) => {
    const row = record(item);
    const congress = row ? number(row.congress) : undefined;
    const billType = row ? string(row.type) : undefined;
    const billNumber = row ? billNumberValue(row.number) : undefined;
    if (!row || congress === undefined || !billType || !billNumber) {
      throw new Error('Congress.gov returned a bill without a complete identity.');
    }
    return {
      congress,
      billType: normalizeCongressBillType(billType),
      billNumber,
      title: string(row.title) ?? null,
      updateDate: string(row.updateDateIncludingText) ?? string(row.updateDate) ?? null,
      apiUrl: string(row.url) ?? null,
    };
  });

  return {
    bills,
    count,
    next: string(pagination.next) ?? null,
  };
}

function withApiKey(url: URL, apiKey: string) {
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  return url.toString();
}

export async function fetchUpdatedCongressBills(
  fetchImpl: typeof fetch,
  apiKey: string,
  congress: number,
  window?: { fromDateTime: string; toDateTime: string },
): Promise<CongressBillListItem[]> {
  const url = new URL(`${CONGRESS_API_ORIGIN}${CONGRESS_BILLS_PATH_PREFIX}/${congress}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(BILL_PAGE_LIMIT));
  url.searchParams.set('sort', 'updateDate+asc');
  if (window) {
    url.searchParams.set('fromDateTime', window.fromDateTime);
    url.searchParams.set('toDateTime', window.toDateTime);
  }

  const bills: CongressBillListItem[] = [];
  const seenPages = new Set<string>();
  let next: string | null = withApiKey(url, apiKey);
  let expectedCount: number | undefined;

  while (next) {
    const current = assertAllowedCongressUrl(next, apiKey, 'list', congress);
    const identity = pageIdentity(current);
    if (seenPages.has(identity)) throw new Error('Congress.gov pagination repeated a page.');
    seenPages.add(identity);

    const page = billsFromPage(await fetchCongressJson(fetchImpl, withApiKey(current, apiKey), apiKey, 'Congress.gov'));
    if (expectedCount !== undefined && page.count !== expectedCount) {
      throw new Error('Congress.gov changed its reported bill count during pagination.');
    }
    expectedCount = page.count;
    bills.push(...page.bills);
    if (bills.length > expectedCount) {
      throw new Error('Congress.gov pagination returned more bills than reported.');
    }

    if (!page.next) {
      next = null;
    } else {
      const nextUrl = assertAllowedCongressUrl(page.next, apiKey, 'list', congress);
      next = withApiKey(nextUrl, apiKey);
    }
  }

  if (expectedCount === undefined || bills.length !== expectedCount) {
    throw new Error('Congress.gov pagination ended before the complete bill list was fetched.');
  }

  const ids = new Set(bills.map((bill) => congressBillProviderId(bill.congress, bill.billType, bill.billNumber)));
  if (ids.size !== bills.length) {
    throw new Error('Congress.gov returned duplicate bill IDs.');
  }

  return bills;
}

function detailFromJson(value: unknown, congress: number, billType: string, billNumber: string): CongressBillDetailInput {
  const root = record(value);
  const bill = root && record(root.bill);
  const type = bill ? string(bill.type) : undefined;
  const numberValue = bill ? billNumberValue(bill.number) : undefined;
  const title = bill ? string(bill.title) : undefined;
  const congressValue = bill ? number(bill.congress) : undefined;
  if (!bill || !type || !numberValue || !title || congressValue !== congress) {
    throw new Error('Congress.gov returned an incomplete or malformed bill detail.');
  }
  if (normalizeCongressBillType(type) !== normalizeCongressBillType(billType) || numberValue !== billNumber) {
    throw new Error('Congress.gov returned a bill detail that did not match the requested bill.');
  }

  const latestAction = record(bill.latestAction);
  const lawsValue = itemsFrom(bill.laws) ?? [];
  const laws = lawsValue.flatMap((item) => {
    const row = record(item);
    return row ? [{ type: string(row.type), number: string(row.number) }] : [];
  });

  return {
    congress,
    billType: normalizeCongressBillType(type),
    billNumber: numberValue,
    title,
    introducedDate: string(bill.introducedDate),
    updateDate: string(bill.updateDateIncludingText) ?? string(bill.updateDate),
    latestAction: latestAction ? {
      actionDate: string(latestAction.actionDate),
      actionTime: string(latestAction.actionTime),
      text: string(latestAction.text),
    } : undefined,
    laws,
  };
}

function actionsFromPage(value: unknown): { actions: CongressBillActionInput[]; count: number; next: string | null } {
  const root = record(value);
  const actionsValue = root && itemsFrom(root.actions);
  const pagination = root && record(root.pagination);
  const count = pagination ? number(pagination.count) : (actionsValue ? actionsValue.length : undefined);
  if (!root || !actionsValue || count === undefined || !Number.isInteger(count) || count < 0) {
    throw new Error('Congress.gov returned an incomplete or malformed action list.');
  }

  const actions = actionsValue.map((item) => {
    const row = record(item);
    if (!row) throw new Error('Congress.gov returned a malformed bill action.');
    const sourceSystem = record(row.sourceSystem);
    return {
      actionDate: string(row.actionDate),
      actionTime: string(row.actionTime),
      text: string(row.text),
      type: string(row.type),
      actionCode: string(row.actionCode),
      sourceSystemName: sourceSystem ? string(sourceSystem.name) : undefined,
    };
  });

  return {
    actions,
    count,
    next: pagination ? string(pagination.next) ?? null : null,
  };
}

export async function fetchCongressBillDetail(
  fetchImpl: typeof fetch,
  apiKey: string,
  bill: Pick<CongressBillListItem, 'congress' | 'billType' | 'billNumber'>,
): Promise<CongressBillDetailInput> {
  const type = normalizeCongressBillType(bill.billType).toLowerCase();
  const url = new URL(`${CONGRESS_API_ORIGIN}${CONGRESS_BILLS_PATH_PREFIX}/${bill.congress}/${type}/${bill.billNumber}`);
  const raw = await fetchCongressJson(fetchImpl, withApiKey(url, apiKey), apiKey, 'Congress.gov');
  return detailFromJson(raw, bill.congress, bill.billType, bill.billNumber);
}

export async function fetchCongressBillActions(
  fetchImpl: typeof fetch,
  apiKey: string,
  bill: Pick<CongressBillListItem, 'congress' | 'billType' | 'billNumber'>,
): Promise<CongressBillActionInput[]> {
  const type = normalizeCongressBillType(bill.billType).toLowerCase();
  const url = new URL(`${CONGRESS_API_ORIGIN}${CONGRESS_BILLS_PATH_PREFIX}/${bill.congress}/${type}/${bill.billNumber}/actions`);
  url.searchParams.set('limit', String(ACTION_PAGE_LIMIT));

  const actions: CongressBillActionInput[] = [];
  const seenPages = new Set<string>();
  let next: string | null = withApiKey(url, apiKey);
  let expectedCount: number | undefined;

  while (next) {
    const current = assertAllowedCongressUrl(next, apiKey, 'actions', bill.congress);
    const identity = pageIdentity(current);
    if (seenPages.has(identity)) throw new Error('Congress.gov pagination repeated a page.');
    seenPages.add(identity);

    const page = actionsFromPage(await fetchCongressJson(fetchImpl, withApiKey(current, apiKey), apiKey, 'Congress.gov'));
    if (expectedCount !== undefined && page.count !== expectedCount) {
      throw new Error('Congress.gov changed its reported action count during pagination.');
    }
    expectedCount = page.count;
    actions.push(...page.actions);
    if (actions.length > expectedCount) {
      throw new Error('Congress.gov pagination returned more actions than reported.');
    }

    if (!page.next) {
      next = null;
    } else {
      next = withApiKey(assertAllowedCongressUrl(page.next, apiKey, 'actions', bill.congress), apiKey);
    }
  }

  if (expectedCount === undefined || actions.length !== expectedCount) {
    throw new Error('Congress.gov pagination ended before the complete action list was fetched.');
  }

  return actions;
}

function incrementalWindow(watermark: string, now: Date) {
  const watermarkDate = new Date(watermark);
  if (Number.isNaN(watermarkDate.valueOf())) return null;
  const from = startOfUtcDay(new Date(watermarkDate.valueOf() - CONGRESS_BILL_WATERMARK_OVERLAP_MS));
  const to = startOfNextUtcDay(now);
  if (from.valueOf() >= to.valueOf()) {
    return {
      fromDateTime: formatCongressDateTime(new Date(to.valueOf() - CONGRESS_BILL_WATERMARK_OVERLAP_MS)),
      toDateTime: formatCongressDateTime(to),
    };
  }
  return {
    fromDateTime: formatCongressDateTime(from),
    toDateTime: formatCongressDateTime(to),
  };
}

async function defaultCongressBillStore(): Promise<CongressBillStore> {
  const [{ db }, schema, operators] = await Promise.all([
    import('@/lib/db'),
    import('@/db/schema'),
    import('drizzle-orm'),
  ]);
  const { legislativeSessions, legislativeBills, legislativeBillActions, legislativeSyncCheckpoints } = schema;
  const { and, eq, ne } = operators;

  return {
    async upsertSession(session) {
      const now = new Date();
      const [row] = await db.insert(legislativeSessions).values({
        ...session,
        syncedAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [legislativeSessions.source, legislativeSessions.providerSessionId],
        set: {
          displayName: session.displayName,
          jurisdiction: session.jurisdiction,
          yearStart: session.yearStart,
          yearEnd: session.yearEnd,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          isCurrent: true,
          syncedAt: now,
          updatedAt: now,
        },
      }).returning({ id: legislativeSessions.id });
      if (!row) throw new Error('Congress bill session persistence returned no row.');

      await db.update(legislativeSessions).set({ isCurrent: false, updatedAt: now }).where(and(
        eq(legislativeSessions.source, 'congress'),
        eq(legislativeSessions.jurisdiction, 'US'),
        ne(legislativeSessions.providerSessionId, session.providerSessionId),
        eq(legislativeSessions.isCurrent, true),
      ));

      return row;
    },

    async upsertBill(bill, actions, sessionId) {
      const now = new Date();
      const values = {
        source: bill.source,
        providerBillId: bill.providerBillId,
        sessionId,
        jurisdiction: bill.jurisdiction,
        billNumber: bill.billNumber,
        billType: bill.billType,
        title: bill.title,
        description: bill.description,
        originChamber: bill.originChamber,
        latestActionBody: bill.latestActionBody,
        latestActionText: bill.latestActionText,
        latestActionDate: bill.latestActionDate,
        stage: bill.stage,
        isActive: bill.isActive,
        providerStatus: bill.providerStatus,
        providerStatusCode: bill.providerStatusCode,
        publicSourceUrl: bill.publicSourceUrl,
        detailChangeHash: bill.fingerprint,
        providerUpdatedAt: bill.providerUpdatedAt,
        detailsPending: bill.detailsPending,
        syncedAt: now,
        updatedAt: now,
      };
      const [row] = await db.insert(legislativeBills).values(values).onConflictDoUpdate({
        target: [legislativeBills.source, legislativeBills.providerBillId],
        set: {
          sessionId,
          jurisdiction: values.jurisdiction,
          billNumber: values.billNumber,
          billType: values.billType,
          title: values.title,
          description: values.description,
          originChamber: values.originChamber,
          latestActionBody: values.latestActionBody,
          latestActionText: values.latestActionText,
          latestActionDate: values.latestActionDate,
          stage: values.stage,
          isActive: values.isActive,
          providerStatus: values.providerStatus,
          providerStatusCode: values.providerStatusCode,
          publicSourceUrl: values.publicSourceUrl,
          detailChangeHash: values.detailChangeHash,
          providerUpdatedAt: values.providerUpdatedAt,
          detailsPending: values.detailsPending,
          syncedAt: now,
          updatedAt: now,
        },
      }).returning({ id: legislativeBills.id });
      if (!row) throw new Error('Congress bill persistence returned no row.');

      const deleteActions = db.delete(legislativeBillActions).where(eq(legislativeBillActions.billId, row.id));
      if (actions.length === 0) {
        await deleteActions;
        return;
      }

      await db.batch([
        deleteActions,
        db.insert(legislativeBillActions).values(actions.map((action) => ({
          billId: row.id,
          providerActionKey: action.providerActionKey,
          actionDate: action.actionDate,
          body: action.body,
          description: action.description,
          providerActionCode: action.providerActionCode,
          stage: action.stage,
          sortOrder: action.sortOrder,
          updatedAt: now,
        }))),
      ]);
    },

    async loadCheckpoint() {
      const [row] = await db
        .select({
          watermark: legislativeSyncCheckpoints.watermark,
          lastSuccessAt: legislativeSyncCheckpoints.lastSuccessAt,
          metadata: legislativeSyncCheckpoints.metadata,
        })
        .from(legislativeSyncCheckpoints)
        .where(and(
          eq(legislativeSyncCheckpoints.source, 'congress'),
          eq(legislativeSyncCheckpoints.scope, FEDERAL_LEGISLATION_SYNC_SCOPE),
        ))
        .limit(1);
      if (!row) return null;
      return {
        watermark: row.watermark,
        lastSuccessAt: row.lastSuccessAt,
        metadata: row.metadata ?? undefined,
      };
    },

    async saveCheckpoint(checkpoint) {
      const now = new Date();
      await db.insert(legislativeSyncCheckpoints).values({
        source: 'congress',
        scope: FEDERAL_LEGISLATION_SYNC_SCOPE,
        watermark: checkpoint.watermark,
        lastSuccessAt: checkpoint.lastSuccessAt,
        metadata: checkpoint.metadata,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [legislativeSyncCheckpoints.source, legislativeSyncCheckpoints.scope],
        set: {
          watermark: checkpoint.watermark,
          lastSuccessAt: checkpoint.lastSuccessAt,
          metadata: checkpoint.metadata,
          updatedAt: now,
        },
      });
    },
  };
}

function listedBillId(bill: Pick<CongressBillListItem, 'congress' | 'billType' | 'billNumber'>) {
  return congressBillProviderId(bill.congress, bill.billType, bill.billNumber);
}

export function congressResumeStartIndex(listed: CongressBillListItem[], resumeAfter?: string | null) {
  if (!resumeAfter) return 0;
  const index = listed.findIndex((bill) => listedBillId(bill) === resumeAfter);
  return index === -1 ? 0 : index + 1;
}

function syncWarning(message: string, apiKey: string) {
  return redactCongressApiKey(message, apiKey);
}

export async function syncCongressBills(options: CongressBillSyncOptions = {}): Promise<CongressBillSyncResult> {
  const startedAt = Date.now();
  const rawFetch = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey ?? process.env.CONGRESS_API_KEY;
  if (!apiKey) throw new Error('CONGRESS_API_KEY is not configured.');

  const now = options.now ?? new Date();
  const congress = currentCongressForDate(now);
  const persist = options.persist ?? await defaultCongressBillStore();
  const existing = await persist.loadCheckpoint();
  const window = existing?.watermark ? incrementalWindow(existing.watermark, now) : null;
  const mode = window ? 'incremental' as const : 'bootstrap' as const;
  const windowTo = formatCongressDateTime(startOfNextUtcDay(now));
  const windowFrom = window?.fromDateTime ?? null;
  const checkpointTo = window?.toDateTime ?? windowTo;
  const detailBudget = options.detailBudget ?? resolveCongressDetailBudget();
  let requestCount = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestCount += 1;
    return rawFetch(input, init);
  };

  const listed = await fetchUpdatedCongressBills(
    fetchImpl,
    apiKey,
    congress,
    window ?? undefined,
  );
  const startIndex = congressResumeStartIndex(listed, existing?.metadata?.resumeAfter);

  const warnings: string[] = [];
  let accepted = 0;
  let rejected = 0;
  let sessionId: number | undefined;
  let lastProcessedId: string | null = existing?.metadata?.resumeAfter ?? null;
  let stopReason: 'rate_limit' | 'timeout' | 'budget' | null = null;
  let detailWork = 0;

  for (let index = startIndex; index < listed.length; index += 1) {
    const listedBill = listed[index];
    if (!listedBill) break;
    const providerId = listedBillId(listedBill);

    if (!originChamberFromBillType(listedBill.billType)) {
      rejected += 1;
      warnings.push(`Quarantined unrecognized Congress.gov bill type ${listedBill.billType} for ${listedBill.billNumber}.`);
      lastProcessedId = providerId;
      continue;
    }

    if (detailWork >= detailBudget) {
      stopReason = 'budget';
      warnings.push('Congress.gov detail budget reached before the update window was finished.');
      break;
    }
    detailWork += 1;

    let bill: NormalizedCongressBill;
    let actions: NormalizedCongressBillAction[];
    try {
      const [detail, actionInputs] = await Promise.all([
        fetchCongressBillDetail(fetchImpl, apiKey, listedBill),
        fetchCongressBillActions(fetchImpl, apiKey, listedBill),
      ]);
      bill = normalizeCongressBill(detail, actionInputs);
      actions = normalizeCongressBillActions(actionInputs, bill.originChamber);
    } catch (error) {
      if (isCongressQuotaStop(error)) {
        stopReason = error instanceof CongressRequestError && error.timedOut ? 'timeout' : 'rate_limit';
        warnings.push(syncWarning(
          stopReason === 'timeout'
            ? 'Congress.gov request timed out. Date watermark is unchanged; remaining bills will resume later.'
            : 'Congress.gov returned 429. Date watermark is unchanged; remaining bills will resume later.',
          apiKey,
        ));
        break;
      }

      rejected += 1;
      const detail = error instanceof Error ? error.message : 'unknown error';
      warnings.push(syncWarning(
        `Quarantined Congress.gov bill ${listedBill.billType} ${listedBill.billNumber}: ${detail}`,
        apiKey,
      ));
      lastProcessedId = providerId;
      continue;
    }

    if (!options.dryRun) {
      if (sessionId === undefined) {
        const session = await persist.upsertSession(congressSessionFromNumber(congress));
        sessionId = session.id;
      }
      await persist.upsertBill(bill, actions, sessionId);
    }
    accepted += 1;
    lastProcessedId = providerId;
  }

  const windowComplete = stopReason === null;
  const outcome: CongressBillSyncOutcome = windowComplete ? 'complete' : 'successful-with-backlog';
  const watermarkAdvanced = !options.dryRun && windowComplete;

  if (!options.dryRun) {
    if (windowComplete && sessionId === undefined) {
      await persist.upsertSession(congressSessionFromNumber(congress));
    }

    const metadata: CongressBillCheckpointMetadata = {
      requestCount,
      windowFrom: windowFrom ?? undefined,
      windowTo: checkpointTo,
      billsAccepted: accepted,
    };
    if (!windowComplete && lastProcessedId) metadata.resumeAfter = lastProcessedId;

    await persist.saveCheckpoint({
      watermark: watermarkAdvanced ? checkpointTo : existing?.watermark ?? null,
      lastSuccessAt: now,
      metadata,
    });
  }

  return {
    dryRun: Boolean(options.dryRun),
    congress,
    mode,
    outcome,
    fetched: listed.length,
    accepted,
    rejected,
    warnings,
    durationMs: Date.now() - startedAt,
    watermarkAdvanced,
    windowFrom,
    windowTo: checkpointTo,
  };
}
