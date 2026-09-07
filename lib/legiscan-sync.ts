import {
  stateLegislationSyncScope,
  type LegislativeLifecycleStage,
} from './legislative-bills';
import {
  isStatePageCode,
  STATE_PAGE_CODES,
  stateCodeFromPageSlug,
  type StatePageCode,
} from './us-states';

type JsonRecord = Record<string, unknown>;

export const DEFAULT_LEGISCAN_DETAIL_BUDGET = 200;
export const LEGISCAN_RUN_SYNC_SCOPE = 'state:all';
export const LEGISCAN_API_ORIGIN = 'https://api.legiscan.com';

const FETCH_TIMEOUT_MS = 30_000;
const SOURCE = 'legiscan' as const;

const LEGISCAN_STATUS_MAP = {
  0: { stage: 'other', isActive: false, label: 'N/A' },
  1: { stage: 'introduced', isActive: true, label: 'Introduced' },
  2: { stage: 'cross_chamber', isActive: true, label: 'Engrossed' },
  3: { stage: 'enrolled', isActive: true, label: 'Enrolled' },
  4: { stage: 'law', isActive: false, label: 'Passed' },
  5: { stage: 'vetoed', isActive: false, label: 'Vetoed' },
  6: { stage: 'failed', isActive: false, label: 'Failed' },
} as const satisfies Record<number, { stage: LegislativeLifecycleStage; isActive: boolean; label: string }>;

const BODY_LABELS: Record<string, string> = {
  H: 'House',
  S: 'Senate',
  A: 'Assembly',
};

export type LegiScanStatusMapping = {
  statusCode: number;
  label: string;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  documented: boolean;
};

export type NormalizedLegiScanSession = {
  providerSessionId: string;
  jurisdiction: string;
  displayName: string;
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
  special: boolean;
};

export type NormalizedLegiScanMasterBill = {
  providerBillId: string;
  billNumber: string;
  billType: string | null;
  title: string;
  description: string;
  changeHash: string;
  statusCode: number;
  statusLabel: string;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  latestActionText: string | null;
  latestActionDate: Date | null;
  publicSourceUrl: string | null;
  providerStatus: string;
  providerStatusCode: string;
};

export type NormalizedLegiScanAction = {
  providerActionKey: string;
  actionDate: Date | null;
  body: string | null;
  description: string;
  providerActionCode: string | null;
  stage: LegislativeLifecycleStage | null;
  sortOrder: number;
};

export type NormalizedLegiScanBillDetail = {
  providerBillId: string;
  billNumber: string;
  billType: string | null;
  title: string;
  description: string;
  originChamber: string | null;
  latestActionBody: string | null;
  latestActionText: string | null;
  latestActionDate: Date | null;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  providerStatus: string;
  providerStatusCode: string;
  publicSourceUrl: string | null;
  actions: NormalizedLegiScanAction[];
};

export type LegiScanStoredSession = {
  id: number;
  providerSessionId: string;
  jurisdiction: string;
  displayName: string;
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
};

export type LegiScanStoredBill = {
  id: number;
  providerBillId: string;
  sessionId: number;
  jurisdiction: string;
  billNumber: string;
  billType: string | null;
  title: string;
  description: string;
  originChamber: string | null;
  latestActionBody: string | null;
  latestActionText: string | null;
  latestActionDate: Date | null;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  providerStatus: string | null;
  providerStatusCode: string | null;
  publicSourceUrl: string | null;
  masterChangeHash: string | null;
  detailChangeHash: string | null;
  detailsPending: boolean;
};

export type LegiScanStoredAction = NormalizedLegiScanAction & {
  billId: number;
};

export type LegiScanCheckpointMetadata = {
  requestCount?: number;
  pendingDetailCount?: number;
  lastCompletedJurisdiction?: string;
  billsAccepted?: number;
};

export type LegiScanStoredCheckpoint = {
  scope: string;
  watermark: string | null;
  lastSuccessAt: Date | null;
  metadata: LegiScanCheckpointMetadata | null;
};

export type LegiScanSessionDeltaPlan = {
  jurisdiction: string;
  session: Omit<LegiScanStoredSession, 'id'> & { id?: number };
  currentProviderSessionIds: string[];
  upserts: Array<Omit<LegiScanStoredBill, 'id' | 'sessionId'> & { id?: number }>;
  deactivateProviderBillIds: string[];
  now: Date;
};

export type LegiScanBillDetailPlan = {
  billId: number;
  masterChangeHash: string;
  detail: NormalizedLegiScanBillDetail;
  now: Date;
};

export type LegiScanStore = {
  listSessions(jurisdiction: string): Promise<LegiScanStoredSession[]>;
  listBills(filter?: {
    jurisdiction?: string;
    sessionId?: number;
    detailsPending?: boolean;
  }): Promise<LegiScanStoredBill[]>;
  listActions(billId: number): Promise<LegiScanStoredAction[]>;
  getCheckpoint(scope: string): Promise<LegiScanStoredCheckpoint | null>;
  applySessionDelta(plan: LegiScanSessionDeltaPlan): Promise<void>;
  applyBillDetail(plan: LegiScanBillDetailPlan): Promise<void>;
  applyCheckpoint(checkpoint: LegiScanStoredCheckpoint): Promise<void>;
};

export type LegiScanSessionDeltaResult = {
  created: number;
  changed: number;
  unchanged: number;
  deactivated: number;
  pendingDetails: number;
};

export type LegiScanSyncResult = {
  dryRun: boolean;
  requestCount: number;
  sessionRequests: number;
  masterRequests: number;
  detailRequests: number;
  changedSummaries: number;
  newSummaries: number;
  detailsRefreshed: number;
  deactivations: number;
  pendingBacklog: number;
  failedScopes: string[];
  durationMs: number;
};

export type SyncLegiScanOptions = {
  dryRun?: boolean;
  state?: string;
  detailBudget?: number;
  fetchImpl?: typeof fetch;
  store?: LegiScanStore;
  apiKey?: string;
  now?: Date | (() => Date);
};

export class LegiScanRequestError extends Error {
  readonly statusCode?: number;

  constructor(message: string, options?: { statusCode?: number; cause?: unknown }) {
    super(message);
    this.name = 'LegiScanRequestError';
    this.statusCode = options?.statusCode;
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export function redactLegiScanSecrets(text: string, apiKey?: string) {
  let redacted = text.replace(/([?&]key=)[^&]*/gi, '$1[redacted]');
  if (apiKey) redacted = redacted.split(apiKey).join('[redacted]');
  return redacted;
}

export function resolveLegiScanDetailBudget(
  value: unknown = process.env.LEGISCAN_DETAIL_BUDGET,
  fallback = DEFAULT_LEGISCAN_DETAIL_BUDGET,
) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('LEGISCAN_DETAIL_BUDGET must be a non-negative integer.');
  }
  return parsed;
}

export function mapLegiScanStatus(statusCode: number): LegiScanStatusMapping {
  const mapped = LEGISCAN_STATUS_MAP[statusCode as keyof typeof LEGISCAN_STATUS_MAP];
  if (mapped) {
    return { statusCode, ...mapped, documented: true };
  }
  return { statusCode, label: 'Unknown', stage: 'other', isActive: false, documented: false };
}

export function resolveLegiScanStateCodes(state?: string): StatePageCode[] {
  if (!state) return [...STATE_PAGE_CODES];
  const trimmed = state.trim();
  const upper = trimmed.toUpperCase();
  if (isStatePageCode(upper)) return [upper];
  const fromSlug = stateCodeFromPageSlug(trimmed.toLowerCase());
  if (fromSlug) return [fromSlug];
  throw new Error(`Unsupported state legislation scope: ${trimmed}`);
}

export async function fetchLegiScanSessionList(
  fetchImpl: typeof fetch,
  apiKey: string,
  stateCode: string,
): Promise<unknown[]> {
  const payload = await legiscanRequest(fetchImpl, apiKey, 'getSessionList', { state: stateCode });
  const root = asRecord(payload);
  const sessions = root && Array.isArray(root.sessions) ? root.sessions : null;
  if (!sessions || sessions.length === 0) {
    throw new LegiScanRequestError('LegiScan getSessionList returned a malformed or empty session list.');
  }

  const ids = new Set<string>();
  for (const session of sessions) {
    const row = asRecord(session);
    const sessionId = parseProviderId(row?.session_id);
    if (!row || sessionId === null) {
      throw new LegiScanRequestError('LegiScan getSessionList returned a session without a valid session_id.');
    }
    if (ids.has(sessionId)) {
      throw new LegiScanRequestError('LegiScan getSessionList returned duplicate session IDs.');
    }
    ids.add(sessionId);
  }

  return sessions;
}

export async function fetchLegiScanMasterList(
  fetchImpl: typeof fetch,
  apiKey: string,
  sessionId: string,
  jurisdiction: string,
): Promise<unknown[]> {
  const payload = await legiscanRequest(fetchImpl, apiKey, 'getMasterList', { id: sessionId });
  const root = asRecord(payload);
  const masterlist = root ? asRecord(root.masterlist) : null;
  if (!masterlist) {
    throw new LegiScanRequestError('LegiScan getMasterList returned a malformed payload.');
  }

  const bills: unknown[] = [];
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(masterlist)) {
    if (key === 'session') continue;
    const row = asRecord(value);
    const billId = parseProviderId(row?.bill_id);
    if (!row || billId === null) {
      throw new LegiScanRequestError('LegiScan getMasterList returned a malformed bill entry.');
    }
    if (ids.has(billId)) {
      throw new LegiScanRequestError('LegiScan getMasterList returned duplicate bill IDs.');
    }
    ids.add(billId);
    const url = optionalString(row.url);
    if (url) {
      const urlState = stateCodeFromLegiScanUrl(url);
      if (urlState && urlState !== jurisdiction) {
        throw new LegiScanRequestError(`LegiScan getMasterList bill ${billId} does not belong to ${jurisdiction}.`);
      }
    }
    bills.push(value);
  }

  if (bills.length === 0) {
    throw new LegiScanRequestError('LegiScan getMasterList returned an empty master list.');
  }

  return bills;
}

export async function fetchLegiScanBillDetail(
  fetchImpl: typeof fetch,
  apiKey: string,
  billId: string,
): Promise<unknown> {
  const payload = await legiscanRequest(fetchImpl, apiKey, 'getBill', { id: billId });
  const root = asRecord(payload);
  const bill = root ? asRecord(root.bill) : null;
  if (!bill) {
    throw new LegiScanRequestError('LegiScan getBill returned a malformed payload.');
  }
  return bill;
}

export function normalizeLegiScanSession(value: unknown, jurisdiction: string): NormalizedLegiScanSession {
  const row = asRecord(value);
  const providerSessionId = parseProviderId(row?.session_id);
  const displayName = optionalString(row?.session_title) ?? optionalString(row?.session_name);
  const prior = parseFlag(row?.prior);
  if (!row || providerSessionId === null || !displayName || prior === null) {
    throw new LegiScanRequestError('LegiScan session payload is malformed.');
  }

  return {
    providerSessionId,
    jurisdiction,
    displayName,
    yearStart: parseOptionalInteger(row.year_start),
    yearEnd: parseOptionalInteger(row.year_end),
    isCurrent: !prior,
    special: parseFlag(row.special) === true,
  };
}

export function normalizeLegiScanMasterBill(value: unknown, jurisdiction: string): NormalizedLegiScanMasterBill {
  const row = asRecord(value);
  const providerBillId = parseProviderId(row?.bill_id);
  const billNumber = optionalString(row?.number) ?? optionalString(row?.bill_number);
  const changeHash = optionalString(row?.change_hash);
  const title = optionalString(row?.title);
  const statusCode = parseStatusCode(row?.status);
  if (!row || providerBillId === null || !billNumber || !changeHash || !title || statusCode === null) {
    throw new LegiScanRequestError('LegiScan master bill payload is malformed.');
  }

  const url = optionalHttpsUrl(row.url);
  const urlState = url ? stateCodeFromLegiScanUrl(url) : null;
  if (urlState && urlState !== jurisdiction) {
    throw new LegiScanRequestError(`LegiScan master bill ${providerBillId} does not belong to ${jurisdiction}.`);
  }

  const status = mapLegiScanStatus(statusCode);
  return {
    providerBillId,
    billNumber,
    billType: billTypeFromNumber(billNumber),
    title,
    description: optionalString(row.description) ?? '',
    changeHash,
    statusCode,
    statusLabel: status.label,
    stage: status.stage,
    isActive: status.isActive,
    latestActionText: optionalString(row.last_action) ?? null,
    latestActionDate: parseLegiScanDate(row.last_action_date),
    publicSourceUrl: url,
    providerStatus: status.label,
    providerStatusCode: String(statusCode),
  };
}

export function normalizeLegiScanBillDetail(
  value: unknown,
  context: { jurisdiction: string; providerBillId: string },
): NormalizedLegiScanBillDetail {
  const row = asRecord(value);
  const providerBillId = parseProviderId(row?.bill_id);
  const billNumber = optionalString(row?.bill_number) ?? optionalString(row?.number);
  const title = optionalString(row?.title);
  const statusCode = parseStatusCode(row?.status);
  const state = optionalString(row?.state)?.toUpperCase();
  if (
    !row
    || providerBillId === null
    || providerBillId !== context.providerBillId
    || !billNumber
    || !title
    || statusCode === null
    || (state && state !== context.jurisdiction)
  ) {
    throw new LegiScanRequestError('LegiScan bill detail payload is malformed.');
  }

  if (row.history === undefined || !Array.isArray(row.history)) {
    throw new LegiScanRequestError(`LegiScan bill ${providerBillId} detail is missing a valid history array.`);
  }

  const status = mapLegiScanStatus(statusCode);
  const actions = row.history.map((item, index) => normalizeHistoryAction(item, index, providerBillId));
  const latestAction = actions.at(-1);
  const committee = asRecord(row.committee);
  const committeeName = optionalString(committee?.name) ?? optionalString(committee?.committee_name);
  const stage = refineDetailStage(status, row, committeeName);

  return {
    providerBillId,
    billNumber,
    billType: optionalString(row.bill_type) ?? billTypeFromNumber(billNumber),
    title,
    description: optionalString(row.description) ?? '',
    originChamber: bodyLabel(row.body),
    latestActionBody: latestAction?.body ?? (committeeName && stage === 'committee' ? committeeName : bodyLabel(row.current_body)),
    latestActionText: latestAction?.description ?? optionalString(row.last_action) ?? null,
    latestActionDate: latestAction?.actionDate ?? parseLegiScanDate(row.status_date),
    stage,
    isActive: status.isActive,
    providerStatus: status.label,
    providerStatusCode: String(statusCode),
    publicSourceUrl: optionalHttpsUrl(row.url),
    actions,
  };
}

export async function persistLegiScanSessionDelta(
  input: {
    jurisdiction: string;
    session: NormalizedLegiScanSession;
    bills: NormalizedLegiScanMasterBill[];
    currentProviderSessionIds: string[];
    authoritative: boolean;
    now: Date;
    dryRun?: boolean;
  },
  store: LegiScanStore,
): Promise<LegiScanSessionDeltaResult> {
  const existingSessions = await store.listSessions(input.jurisdiction);
  const existingSession = existingSessions.find((session) => session.providerSessionId === input.session.providerSessionId);
  const jurisdictionBills = await store.listBills({ jurisdiction: input.jurisdiction });
  const existingSessionBills = existingSession
    ? jurisdictionBills.filter((bill) => bill.sessionId === existingSession.id)
    : [];
  const existingByProviderId = new Map(jurisdictionBills.map((bill) => [bill.providerBillId, bill]));
  const masterIds = new Set(input.bills.map((bill) => bill.providerBillId));

  const upserts: LegiScanSessionDeltaPlan['upserts'] = [];
  let created = 0;
  let changed = 0;
  let unchanged = 0;

  for (const bill of input.bills) {
    const existing = existingByProviderId.get(bill.providerBillId);
    if (existing && existing.masterChangeHash === bill.changeHash) {
      unchanged += 1;
      continue;
    }

    if (existing) changed += 1;
    else created += 1;

    upserts.push({
      id: existing?.id,
      providerBillId: bill.providerBillId,
      jurisdiction: input.jurisdiction,
      billNumber: bill.billNumber,
      billType: bill.billType,
      title: bill.title,
      description: bill.description,
      originChamber: existing?.originChamber ?? null,
      latestActionBody: existing?.latestActionBody ?? null,
      latestActionText: bill.latestActionText,
      latestActionDate: bill.latestActionDate,
      stage: bill.stage,
      isActive: bill.isActive,
      providerStatus: bill.providerStatus,
      providerStatusCode: bill.providerStatusCode,
      publicSourceUrl: bill.publicSourceUrl,
      masterChangeHash: bill.changeHash,
      detailChangeHash: existing?.detailChangeHash ?? null,
      detailsPending: true,
    });
  }

  const deactivateProviderBillIds = input.authoritative
    ? existingSessionBills
      .filter((bill) => bill.isActive && !masterIds.has(bill.providerBillId))
      .map((bill) => bill.providerBillId)
    : [];

  if (!input.dryRun) {
    await store.applySessionDelta({
      jurisdiction: input.jurisdiction,
      session: {
        id: existingSession?.id,
        providerSessionId: input.session.providerSessionId,
        jurisdiction: input.jurisdiction,
        displayName: input.session.displayName,
        yearStart: input.session.yearStart,
        yearEnd: input.session.yearEnd,
        isCurrent: input.session.isCurrent,
      },
      currentProviderSessionIds: input.currentProviderSessionIds,
      upserts,
      deactivateProviderBillIds,
      now: input.now,
    });
  }

  const pendingFromUpserts = upserts.length;
  const pendingUnchanged = existingSessionBills.filter((bill) => (
    bill.detailsPending
    && masterIds.has(bill.providerBillId)
    && !upserts.some((row) => row.providerBillId === bill.providerBillId)
  )).length;

  return {
    created,
    changed,
    unchanged,
    deactivated: deactivateProviderBillIds.length,
    pendingDetails: pendingFromUpserts + pendingUnchanged,
  };
}

export function createMemoryLegiScanStore(seed?: {
  sessions?: LegiScanStoredSession[];
  bills?: LegiScanStoredBill[];
  actions?: LegiScanStoredAction[];
  checkpoints?: LegiScanStoredCheckpoint[];
}): LegiScanStore & {
  sessions: LegiScanStoredSession[];
  bills: LegiScanStoredBill[];
  actions: LegiScanStoredAction[];
  checkpoints: Map<string, LegiScanStoredCheckpoint>;
} {
  let nextId = 1;
  const sessions = seed?.sessions ? seed.sessions.map((session) => ({ ...session })) : [];
  const bills = seed?.bills ? seed.bills.map((bill) => ({ ...bill })) : [];
  const actions = seed?.actions ? seed.actions.map((action) => ({ ...action })) : [];
  const checkpoints = new Map((seed?.checkpoints ?? []).map((checkpoint) => [checkpoint.scope, { ...checkpoint }]));
  nextId = Math.max(0, ...sessions.map((session) => session.id), ...bills.map((bill) => bill.id)) + 1;

  return {
    sessions,
    bills,
    actions,
    checkpoints,
    async listSessions(jurisdiction) {
      return sessions.filter((session) => session.jurisdiction === jurisdiction).map((session) => ({ ...session }));
    },
    async listBills(filter = {}) {
      return bills.filter((bill) => (
        (filter.jurisdiction === undefined || bill.jurisdiction === filter.jurisdiction)
        && (filter.sessionId === undefined || bill.sessionId === filter.sessionId)
        && (filter.detailsPending === undefined || bill.detailsPending === filter.detailsPending)
      )).map((bill) => ({ ...bill }));
    },
    async listActions(billId) {
      return actions
        .filter((action) => action.billId === billId)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((action) => ({ ...action }));
    },
    async getCheckpoint(scope) {
      const checkpoint = checkpoints.get(scope);
      return checkpoint ? { ...checkpoint, metadata: checkpoint.metadata ? { ...checkpoint.metadata } : null } : null;
    },
    async applySessionDelta(plan) {
      let session = sessions.find((row) => row.providerSessionId === plan.session.providerSessionId);
      if (!session) {
        session = { ...plan.session, id: plan.session.id ?? nextId++ };
        sessions.push(session);
      } else {
        Object.assign(session, {
          displayName: plan.session.displayName,
          yearStart: plan.session.yearStart,
          yearEnd: plan.session.yearEnd,
          isCurrent: plan.session.isCurrent,
          jurisdiction: plan.jurisdiction,
        });
      }

      const currentIds = new Set(plan.currentProviderSessionIds);
      for (const row of sessions) {
        if (row.jurisdiction === plan.jurisdiction) {
          row.isCurrent = currentIds.has(row.providerSessionId);
        }
      }

      for (const upsert of plan.upserts) {
        const existing = bills.find((bill) => bill.providerBillId === upsert.providerBillId);
        if (!existing) {
          bills.push({ ...upsert, id: upsert.id ?? nextId++, sessionId: session.id });
          continue;
        }
        Object.assign(existing, {
          ...upsert,
          id: existing.id,
          sessionId: session.id,
        });
      }

      const deactivate = new Set(plan.deactivateProviderBillIds);
      for (const bill of bills) {
        if (bill.sessionId === session.id && deactivate.has(bill.providerBillId)) {
          bill.isActive = false;
        }
      }
    },
    async applyBillDetail(plan) {
      const bill = bills.find((row) => row.id === plan.billId);
      if (!bill) throw new Error(`Cannot persist detail for unknown bill ${plan.billId}.`);
      Object.assign(bill, {
        billNumber: plan.detail.billNumber,
        billType: plan.detail.billType,
        title: plan.detail.title,
        description: plan.detail.description,
        originChamber: plan.detail.originChamber,
        latestActionBody: plan.detail.latestActionBody,
        latestActionText: plan.detail.latestActionText,
        latestActionDate: plan.detail.latestActionDate,
        stage: plan.detail.stage,
        isActive: plan.detail.isActive,
        providerStatus: plan.detail.providerStatus,
        providerStatusCode: plan.detail.providerStatusCode,
        publicSourceUrl: plan.detail.publicSourceUrl,
        detailChangeHash: plan.masterChangeHash,
        detailsPending: false,
      });
      for (let index = actions.length - 1; index >= 0; index -= 1) {
        if (actions[index].billId === plan.billId) actions.splice(index, 1);
      }
      actions.push(...plan.detail.actions.map((action) => ({ ...action, billId: plan.billId })));
    },
    async applyCheckpoint(checkpoint) {
      checkpoints.set(checkpoint.scope, {
        ...checkpoint,
        metadata: checkpoint.metadata ? { ...checkpoint.metadata } : null,
      });
    },
  };
}

export async function createDbLegiScanStore(): Promise<LegiScanStore> {
  const [{ db }, schema, operators] = await Promise.all([
    import('./db'),
    import('../db/schema'),
    import('drizzle-orm'),
  ]);
  const { legislativeSessions, legislativeBills, legislativeBillActions, legislativeSyncCheckpoints } = schema;
  const { and, eq, inArray, not } = operators;

  return {
    async listSessions(jurisdiction) {
      return db
        .select({
          id: legislativeSessions.id,
          providerSessionId: legislativeSessions.providerSessionId,
          jurisdiction: legislativeSessions.jurisdiction,
          displayName: legislativeSessions.displayName,
          yearStart: legislativeSessions.yearStart,
          yearEnd: legislativeSessions.yearEnd,
          isCurrent: legislativeSessions.isCurrent,
        })
        .from(legislativeSessions)
        .where(and(
          eq(legislativeSessions.source, SOURCE),
          eq(legislativeSessions.jurisdiction, jurisdiction),
        ));
    },
    async listBills(filter = {}) {
      const conditions = [eq(legislativeBills.source, SOURCE)];
      if (filter.jurisdiction) conditions.push(eq(legislativeBills.jurisdiction, filter.jurisdiction));
      if (filter.sessionId !== undefined) conditions.push(eq(legislativeBills.sessionId, filter.sessionId));
      if (filter.detailsPending !== undefined) conditions.push(eq(legislativeBills.detailsPending, filter.detailsPending));
      return db
        .select({
          id: legislativeBills.id,
          providerBillId: legislativeBills.providerBillId,
          sessionId: legislativeBills.sessionId,
          jurisdiction: legislativeBills.jurisdiction,
          billNumber: legislativeBills.billNumber,
          billType: legislativeBills.billType,
          title: legislativeBills.title,
          description: legislativeBills.description,
          originChamber: legislativeBills.originChamber,
          latestActionBody: legislativeBills.latestActionBody,
          latestActionText: legislativeBills.latestActionText,
          latestActionDate: legislativeBills.latestActionDate,
          stage: legislativeBills.stage,
          isActive: legislativeBills.isActive,
          providerStatus: legislativeBills.providerStatus,
          providerStatusCode: legislativeBills.providerStatusCode,
          publicSourceUrl: legislativeBills.publicSourceUrl,
          masterChangeHash: legislativeBills.masterChangeHash,
          detailChangeHash: legislativeBills.detailChangeHash,
          detailsPending: legislativeBills.detailsPending,
        })
        .from(legislativeBills)
        .where(and(...conditions));
    },
    async listActions(billId) {
      const rows = await db
        .select({
          billId: legislativeBillActions.billId,
          providerActionKey: legislativeBillActions.providerActionKey,
          actionDate: legislativeBillActions.actionDate,
          body: legislativeBillActions.body,
          description: legislativeBillActions.description,
          providerActionCode: legislativeBillActions.providerActionCode,
          stage: legislativeBillActions.stage,
          sortOrder: legislativeBillActions.sortOrder,
        })
        .from(legislativeBillActions)
        .where(eq(legislativeBillActions.billId, billId));
      return rows.sort((left, right) => left.sortOrder - right.sortOrder);
    },
    async getCheckpoint(scope) {
      const [checkpoint] = await db
        .select({
          scope: legislativeSyncCheckpoints.scope,
          watermark: legislativeSyncCheckpoints.watermark,
          lastSuccessAt: legislativeSyncCheckpoints.lastSuccessAt,
          metadata: legislativeSyncCheckpoints.metadata,
        })
        .from(legislativeSyncCheckpoints)
        .where(and(
          eq(legislativeSyncCheckpoints.source, SOURCE),
          eq(legislativeSyncCheckpoints.scope, scope),
        ))
        .limit(1);
      return checkpoint ?? null;
    },
    async applySessionDelta(plan) {
      const [session] = await db.insert(legislativeSessions).values({
        source: SOURCE,
        providerSessionId: plan.session.providerSessionId,
        jurisdiction: plan.jurisdiction,
        displayName: plan.session.displayName,
        yearStart: plan.session.yearStart,
        yearEnd: plan.session.yearEnd,
        isCurrent: plan.session.isCurrent,
        syncedAt: plan.now,
        updatedAt: plan.now,
      }).onConflictDoUpdate({
        target: [legislativeSessions.source, legislativeSessions.providerSessionId],
        set: {
          jurisdiction: plan.jurisdiction,
          displayName: plan.session.displayName,
          yearStart: plan.session.yearStart,
          yearEnd: plan.session.yearEnd,
          isCurrent: plan.session.isCurrent,
          syncedAt: plan.now,
          updatedAt: plan.now,
        },
      }).returning({ id: legislativeSessions.id });

      if (!session) throw new Error('LegiScan session persistence returned no row.');

      const statements = [];
      if (plan.currentProviderSessionIds.length > 0) {
        statements.push(db.update(legislativeSessions).set({
          isCurrent: false,
          updatedAt: plan.now,
        }).where(and(
          eq(legislativeSessions.source, SOURCE),
          eq(legislativeSessions.jurisdiction, plan.jurisdiction),
          eq(legislativeSessions.isCurrent, true),
          not(inArray(legislativeSessions.providerSessionId, plan.currentProviderSessionIds)),
        )));
      }

      for (const upsert of plan.upserts) {
        statements.push(db.insert(legislativeBills).values({
          source: SOURCE,
          providerBillId: upsert.providerBillId,
          sessionId: session.id,
          jurisdiction: upsert.jurisdiction,
          billNumber: upsert.billNumber,
          billType: upsert.billType,
          title: upsert.title,
          description: upsert.description,
          originChamber: upsert.originChamber,
          latestActionBody: upsert.latestActionBody,
          latestActionText: upsert.latestActionText,
          latestActionDate: upsert.latestActionDate,
          stage: upsert.stage,
          isActive: upsert.isActive,
          providerStatus: upsert.providerStatus,
          providerStatusCode: upsert.providerStatusCode,
          publicSourceUrl: upsert.publicSourceUrl,
          masterChangeHash: upsert.masterChangeHash,
          detailChangeHash: upsert.detailChangeHash,
          detailsPending: upsert.detailsPending,
          syncedAt: plan.now,
          updatedAt: plan.now,
        }).onConflictDoUpdate({
          target: [legislativeBills.source, legislativeBills.providerBillId],
          set: {
            sessionId: session.id,
            jurisdiction: upsert.jurisdiction,
            billNumber: upsert.billNumber,
            billType: upsert.billType,
            title: upsert.title,
            description: upsert.description,
            originChamber: upsert.originChamber,
            latestActionBody: upsert.latestActionBody,
            latestActionText: upsert.latestActionText,
            latestActionDate: upsert.latestActionDate,
            stage: upsert.stage,
            isActive: upsert.isActive,
            providerStatus: upsert.providerStatus,
            providerStatusCode: upsert.providerStatusCode,
            publicSourceUrl: upsert.publicSourceUrl,
            masterChangeHash: upsert.masterChangeHash,
            detailChangeHash: upsert.detailChangeHash,
            detailsPending: upsert.detailsPending,
            syncedAt: plan.now,
            updatedAt: plan.now,
          },
        }));
      }

      if (plan.deactivateProviderBillIds.length > 0) {
        statements.push(db.update(legislativeBills).set({
          isActive: false,
          syncedAt: plan.now,
          updatedAt: plan.now,
        }).where(and(
          eq(legislativeBills.source, SOURCE),
          eq(legislativeBills.sessionId, session.id),
          eq(legislativeBills.isActive, true),
          inArray(legislativeBills.providerBillId, plan.deactivateProviderBillIds),
        )));
      }

      if (statements.length > 0) {
        await db.batch(statements as [typeof statements[0], ...typeof statements[0][]]);
      }
    },
    async applyBillDetail(plan) {
      const statements = [
        db.delete(legislativeBillActions).where(eq(legislativeBillActions.billId, plan.billId)),
        ...plan.detail.actions.map((action) => db.insert(legislativeBillActions).values({
          billId: plan.billId,
          providerActionKey: action.providerActionKey,
          actionDate: action.actionDate,
          body: action.body,
          description: action.description,
          providerActionCode: action.providerActionCode,
          stage: action.stage,
          sortOrder: action.sortOrder,
          updatedAt: plan.now,
        })),
        db.update(legislativeBills).set({
          billNumber: plan.detail.billNumber,
          billType: plan.detail.billType,
          title: plan.detail.title,
          description: plan.detail.description,
          originChamber: plan.detail.originChamber,
          latestActionBody: plan.detail.latestActionBody,
          latestActionText: plan.detail.latestActionText,
          latestActionDate: plan.detail.latestActionDate,
          stage: plan.detail.stage,
          isActive: plan.detail.isActive,
          providerStatus: plan.detail.providerStatus,
          providerStatusCode: plan.detail.providerStatusCode,
          publicSourceUrl: plan.detail.publicSourceUrl,
          detailChangeHash: plan.masterChangeHash,
          detailsPending: false,
          syncedAt: plan.now,
          updatedAt: plan.now,
        }).where(eq(legislativeBills.id, plan.billId)),
      ];
      await db.batch(statements as [typeof statements[0], ...typeof statements[0][]]);
    },
    async applyCheckpoint(checkpoint) {
      await db.insert(legislativeSyncCheckpoints).values({
        source: SOURCE,
        scope: checkpoint.scope,
        watermark: checkpoint.watermark,
        lastSuccessAt: checkpoint.lastSuccessAt,
        metadata: checkpoint.metadata,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [legislativeSyncCheckpoints.source, legislativeSyncCheckpoints.scope],
        set: {
          watermark: checkpoint.watermark,
          lastSuccessAt: checkpoint.lastSuccessAt,
          metadata: checkpoint.metadata,
          updatedAt: new Date(),
        },
      });
    },
  };
}

export async function syncLegiScanStateBills(options: SyncLegiScanOptions = {}): Promise<LegiScanSyncResult> {
  const startedAt = Date.now();
  const dryRun = Boolean(options.dryRun);
  const now = resolveNow(options.now);
  const apiKey = options.apiKey ?? process.env.LEGISCAN_API_KEY;
  if (!apiKey) throw new Error('LEGISCAN_API_KEY is not configured.');

  const fetchImpl = options.fetchImpl ?? fetch;
  const store = options.store ?? (dryRun ? createMemoryLegiScanStore() : await createDbLegiScanStore());
  const states = rotateStates(
    resolveLegiScanStateCodes(options.state),
    options.state ? null : (await store.getCheckpoint(LEGISCAN_RUN_SYNC_SCOPE))?.metadata?.lastCompletedJurisdiction ?? null,
  );
  const detailBudget = resolveLegiScanDetailBudget(options.detailBudget);
  const scoped = Boolean(options.state);
  const runScope = scoped ? stateLegislationSyncScope(states[0]) : LEGISCAN_RUN_SYNC_SCOPE;

  const stats: LegiScanSyncResult = {
    dryRun,
    requestCount: 0,
    sessionRequests: 0,
    masterRequests: 0,
    detailRequests: 0,
    changedSummaries: 0,
    newSummaries: 0,
    detailsRefreshed: 0,
    deactivations: 0,
    pendingBacklog: 0,
    failedScopes: [],
    durationMs: 0,
  };

  let lastCompletedJurisdiction: string | undefined;
  for (const stateCode of states) {
    try {
      const delta = await syncStateMasters({
        fetchImpl,
        apiKey,
        store,
        stateCode,
        now,
        dryRun,
        stats,
      });
      lastCompletedJurisdiction = stateCode;
      stats.changedSummaries += delta.changed;
      stats.newSummaries += delta.created;
      stats.deactivations += delta.deactivated;
      if (dryRun) stats.pendingBacklog += delta.pendingDetails;
      if (!dryRun) {
        await store.applyCheckpoint({
          scope: stateLegislationSyncScope(stateCode),
          watermark: (await store.getCheckpoint(stateLegislationSyncScope(stateCode)))?.watermark ?? null,
          lastSuccessAt: now,
          metadata: {
            requestCount: stats.requestCount,
            billsAccepted: delta.created + delta.changed,
          },
        });
      }
    } catch {
      stats.failedScopes.push(stateCode);
    }
  }

  if (!dryRun) {
    const pending = await selectPendingDetailBills(store, scoped ? states[0] : undefined);
    const cursor = (await store.getCheckpoint(runScope))?.watermark ?? null;
    const skip = new Set<string>();
    const work = takePendingWork(pending, cursor, detailBudget, skip);
    let lastCursor = cursor;

    for (const bill of work) {
      const billKey = detailCursor(bill);
      stats.detailRequests += 1;
      stats.requestCount += 1;
      try {
        const raw = await fetchLegiScanBillDetail(fetchImpl, apiKey, bill.providerBillId);
        const detail = normalizeLegiScanBillDetail(raw, {
          jurisdiction: bill.jurisdiction,
          providerBillId: bill.providerBillId,
        });
        if (!bill.masterChangeHash) {
          throw new LegiScanRequestError(`LegiScan bill ${bill.providerBillId} is missing a master change hash.`);
        }
        await store.applyBillDetail({
          billId: bill.id,
          masterChangeHash: bill.masterChangeHash,
          detail,
          now,
        });
        stats.detailsRefreshed += 1;
      } catch {
        skip.add(billKey);
      }
      lastCursor = billKey;
    }

    const remaining = await store.listBills({
      jurisdiction: scoped ? states[0] : undefined,
      detailsPending: true,
    });
    stats.pendingBacklog = remaining.length;
    await store.applyCheckpoint({
      scope: runScope,
      watermark: lastCursor,
      lastSuccessAt: scoped && stats.failedScopes.includes(states[0])
        ? (await store.getCheckpoint(runScope))?.lastSuccessAt ?? null
        : now,
      metadata: {
        requestCount: stats.requestCount,
        pendingDetailCount: remaining.length,
        lastCompletedJurisdiction,
        billsAccepted: stats.detailsRefreshed,
      },
    });
  }

  stats.durationMs = Date.now() - startedAt;
  return stats;
}

async function syncStateMasters(input: {
  fetchImpl: typeof fetch;
  apiKey: string;
  store: LegiScanStore;
  stateCode: StatePageCode;
  now: Date;
  dryRun: boolean;
  stats: LegiScanSyncResult;
}) {
  input.stats.sessionRequests += 1;
  input.stats.requestCount += 1;
  const rawSessions = await fetchLegiScanSessionList(input.fetchImpl, input.apiKey, input.stateCode);
  const sessions = rawSessions.map((session) => normalizeLegiScanSession(session, input.stateCode));
  const currentSessions = sessions.filter((session) => session.isCurrent);
  if (currentSessions.length === 0) {
    throw new LegiScanRequestError(`LegiScan returned no current sessions for ${input.stateCode}.`);
  }

  const masters: Array<{ session: NormalizedLegiScanSession; bills: NormalizedLegiScanMasterBill[] }> = [];
  for (const session of currentSessions) {
    input.stats.masterRequests += 1;
    input.stats.requestCount += 1;
    const rawBills = await fetchLegiScanMasterList(
      input.fetchImpl,
      input.apiKey,
      session.providerSessionId,
      input.stateCode,
    );
    masters.push({
      session,
      bills: rawBills.map((bill) => normalizeLegiScanMasterBill(bill, input.stateCode)),
    });
  }

  const currentProviderSessionIds = currentSessions.map((session) => session.providerSessionId);
  const totals = { created: 0, changed: 0, unchanged: 0, deactivated: 0, pendingDetails: 0 };
  for (const master of masters) {
    const result = await persistLegiScanSessionDelta({
      jurisdiction: input.stateCode,
      session: master.session,
      bills: master.bills,
      currentProviderSessionIds,
      authoritative: true,
      now: input.now,
      dryRun: input.dryRun,
    }, input.store);
    totals.created += result.created;
    totals.changed += result.changed;
    totals.unchanged += result.unchanged;
    totals.deactivated += result.deactivated;
    totals.pendingDetails += result.pendingDetails;
  }
  return totals;
}

async function selectPendingDetailBills(store: LegiScanStore, jurisdiction?: string) {
  const bills = await store.listBills({ jurisdiction, detailsPending: true });
  return bills.sort((left, right) => (
    left.jurisdiction.localeCompare(right.jurisdiction)
    || compareProviderIds(left.providerBillId, right.providerBillId)
    || left.id - right.id
  ));
}

function takePendingWork(
  pending: LegiScanStoredBill[],
  cursor: string | null,
  limit: number,
  skip: Set<string>,
) {
  if (limit <= 0) return [];
  const start = cursor
    ? pending.findIndex((bill) => detailCursor(bill) > cursor)
    : 0;
  const rotated = start > 0
    ? [...pending.slice(start), ...pending.slice(0, start)]
    : start === -1
      ? pending
      : pending;
  return rotated.filter((bill) => !skip.has(detailCursor(bill))).slice(0, limit);
}

function detailCursor(bill: Pick<LegiScanStoredBill, 'jurisdiction' | 'providerBillId'>) {
  return `${bill.jurisdiction}:${bill.providerBillId}`;
}

function rotateStates(states: StatePageCode[], lastCompletedJurisdiction: string | null) {
  if (!lastCompletedJurisdiction) return states;
  const index = states.indexOf(lastCompletedJurisdiction as StatePageCode);
  if (index < 0) return states;
  return [...states.slice(index + 1), ...states.slice(0, index + 1)];
}

function resolveNow(now?: Date | (() => Date)) {
  if (!now) return new Date();
  return typeof now === 'function' ? now() : now;
}

async function legiscanRequest(
  fetchImpl: typeof fetch,
  apiKey: string,
  op: 'getSessionList' | 'getMasterList' | 'getBill',
  params: Record<string, string>,
): Promise<unknown> {
  const url = new URL(LEGISCAN_API_ORIGIN);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('op', op);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    throw new LegiScanRequestError(
      redactLegiScanSecrets(error instanceof Error ? error.message : `LegiScan ${op} request failed.`, apiKey),
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new LegiScanRequestError(`LegiScan ${op} request failed (${response.status}).`, { statusCode: response.status });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LegiScanRequestError(`LegiScan ${op} returned invalid JSON.`);
  }

  const root = asRecord(payload);
  if (!root) throw new LegiScanRequestError(`LegiScan ${op} returned a malformed payload.`);
  if (root.status === 'ERROR') {
    const alert = asRecord(root.alert);
    const message = optionalString(alert?.message) ?? `LegiScan ${op} returned an error.`;
    throw new LegiScanRequestError(redactLegiScanSecrets(message, apiKey));
  }
  if (root.status !== 'OK') {
    throw new LegiScanRequestError(`LegiScan ${op} returned a malformed payload.`);
  }
  return payload;
}

function normalizeHistoryAction(value: unknown, index: number, providerBillId: string): NormalizedLegiScanAction {
  const row = asRecord(value);
  const description = optionalString(row?.action);
  if (!row || !description) {
    throw new LegiScanRequestError(`LegiScan bill ${providerBillId} history step ${index} is malformed.`);
  }
  return {
    providerActionKey: `history:${index}`,
    actionDate: parseLegiScanDate(row.date),
    body: bodyLabel(row.chamber),
    description,
    providerActionCode: optionalString(row.importance) ?? (typeof row.importance === 'number' ? String(row.importance) : null),
    stage: null,
    sortOrder: index,
  };
}

function refineDetailStage(
  status: LegiScanStatusMapping,
  row: JsonRecord,
  committeeName: string | undefined,
): LegislativeLifecycleStage {
  if (!status.isActive) return status.stage;
  if (status.statusCode === 2) return 'cross_chamber';
  if (status.statusCode === 3) {
    return historyLooksExecutive(row) ? 'executive' : 'enrolled';
  }
  if (status.statusCode !== 1) return status.stage;
  if (committeeName || progressIncludes(row, 9)) return 'committee';
  if (historyLooksFloor(row)) return 'floor';
  return 'introduced';
}

function historyLooksExecutive(row: JsonRecord) {
  const history = Array.isArray(row.history) ? row.history : [];
  return history.some((item) => {
    const action = optionalString(asRecord(item)?.action)?.toLowerCase() ?? '';
    return action.includes('governor') || action.includes('executive');
  });
}

function historyLooksFloor(row: JsonRecord) {
  const history = Array.isArray(row.history) ? row.history : [];
  return history.some((item) => {
    const action = optionalString(asRecord(item)?.action)?.toLowerCase() ?? '';
    return action.includes('third reading')
      || action.includes('second reading')
      || action.includes('floor');
  });
}

function progressIncludes(row: JsonRecord, event: number) {
  return Array.isArray(row.progress) && row.progress.some((item) => {
    const record = asRecord(item);
    return record ? parseOptionalInteger(record.event) === event : false;
  });
}

function bodyLabel(value: unknown) {
  const raw = optionalString(value);
  if (!raw) return null;
  return BODY_LABELS[raw.toUpperCase()] ?? raw;
}

function billTypeFromNumber(billNumber: string) {
  const match = billNumber.match(/^[A-Z]+/i);
  return match ? match[0].toUpperCase() : null;
}

function stateCodeFromLegiScanUrl(url: string) {
  try {
    const parsed = new URL(url);
    const [, code] = parsed.pathname.split('/');
    return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

function optionalHttpsUrl(value: unknown) {
  const url = optionalString(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function parseLegiScanDate(value: unknown) {
  const raw = optionalString(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function parseStatusCode(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
  return null;
}

function parseProviderId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim()) && Number.parseInt(value.trim(), 10) > 0) {
    return String(Number.parseInt(value.trim(), 10));
  }
  return null;
}

function parseOptionalInteger(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number.parseInt(value.trim(), 10);
  return null;
}

function parseFlag(value: unknown) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return null;
}

function compareProviderIds(left: string, right: string) {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
