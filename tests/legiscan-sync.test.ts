import assert from 'node:assert/strict';
import test from 'node:test';
import { stateLegislationSyncScope } from '../lib/legislative-bills';
import {
  createMemoryLegiScanStore,
  DEFAULT_LEGISCAN_DETAIL_BUDGET,
  fetchLegiScanMasterList,
  fetchLegiScanSessionList,
  mapLegiScanStatus,
  normalizeLegiScanBillDetail,
  persistLegiScanSessionDelta,
  redactLegiScanSecrets,
  resolveLegiScanDetailBudget,
  resolveLegiScanStateCodes,
  syncLegiScanStateBills,
  type LegiScanStoredAction,
  type LegiScanStoredBill,
  type LegiScanStoredSession,
  type NormalizedLegiScanMasterBill,
  type NormalizedLegiScanSession,
} from '../lib/legiscan-sync';

const SECRET_KEY = 'super-secret-legiscan-key';
const NOW = new Date('2026-09-07T16:00:00.000Z');

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function urlOf(input: Parameters<typeof fetch>[0]) {
  return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 2100,
    state_id: 11,
    year_start: 2025,
    year_end: 2026,
    prefile: 0,
    sine_die: 0,
    prior: 0,
    special: 0,
    session_title: '2025-2026 Regular Session',
    session_name: '2025-2026 Session',
    ...overrides,
  };
}

function masterBill(overrides: Record<string, unknown> = {}) {
  return {
    bill_id: 5001,
    number: 'HB1',
    change_hash: 'hash-hb1',
    url: 'https://legiscan.com/HI/bill/HB1/2025',
    status_date: '2025-01-15',
    status: '1',
    last_action_date: '2025-01-16',
    last_action: 'Referred to Judiciary.',
    title: 'Relating to public records.',
    description: 'Requires agencies to publish records.',
    ...overrides,
  };
}

function billDetail(overrides: Record<string, unknown> = {}) {
  return {
    bill_id: 5001,
    change_hash: 'hash-hb1',
    session_id: 2100,
    url: 'https://legiscan.com/HI/bill/HB1/2025',
    status: 1,
    status_date: '2025-01-15',
    state: 'HI',
    bill_number: 'HB1',
    bill_type: 'B',
    body: 'H',
    current_body: 'H',
    title: 'Relating to public records.',
    description: 'Requires agencies to publish records.',
    committee: { committee_id: 9, chamber: 'H', name: 'Judiciary' },
    progress: [{ date: '2025-01-16', event: 9 }],
    history: [
      {
        date: '2025-01-15',
        action: 'Introduced.',
        chamber: 'H',
        importance: 1,
      },
      {
        date: '2025-01-16',
        action: 'Referred to Judiciary.',
        chamber: 'H',
        importance: 1,
      },
    ],
    ...overrides,
  };
}

function sessionListPayload(sessions: unknown[]) {
  return { status: 'OK', sessions };
}

function masterListPayload(bills: unknown[], session = sessionRow()) {
  const masterlist: Record<string, unknown> = { session };
  for (const [index, bill] of bills.entries()) {
    masterlist[String(index)] = bill;
  }
  return { status: 'OK', masterlist };
}

function billPayload(bill: unknown) {
  return { status: 'OK', bill };
}

function createRouter(handlers: Array<(url: URL) => Response | undefined>): typeof fetch {
  return async (input) => {
    const url = urlOf(input);
    for (const handler of handlers) {
      const response = handler(url);
      if (response) return response;
    }
    throw new Error(`Unexpected LegiScan request: ${url.searchParams.get('op')} ${url.search}`);
  };
}

function hiFixture(input: {
  sessions?: unknown[];
  bills?: unknown[];
  details?: Record<string, unknown>;
  extra?: Array<(url: URL) => Response | undefined>;
} = {}) {
  const sessions = input.sessions ?? [sessionRow()];
  const bills = input.bills ?? [masterBill()];
  const details = input.details ?? { '5001': billDetail() };
  return createRouter([
    ...(input.extra ?? []),
    (url) => {
      if (url.searchParams.get('op') !== 'getSessionList') return undefined;
      assert.equal(url.searchParams.get('state'), 'HI');
      return jsonResponse(sessionListPayload(sessions));
    },
    (url) => {
      if (url.searchParams.get('op') !== 'getMasterList') return undefined;
      return jsonResponse(masterListPayload(bills));
    },
    (url) => {
      if (url.searchParams.get('op') !== 'getBill') return undefined;
      const id = url.searchParams.get('id');
      const detail = id ? details[id] : undefined;
      return detail ? jsonResponse(billPayload(detail)) : jsonResponse({ status: 'ERROR', alert: { message: 'missing bill' } });
    },
  ]);
}

function requestOps(fetchImpl: typeof fetch) {
  const ops: string[] = [];
  const wrapped: typeof fetch = async (input, init) => {
    ops.push(urlOf(input).searchParams.get('op') ?? '');
    return fetchImpl(input, init);
  };
  return { ops, fetchImpl: wrapped };
}

function storedSession(overrides: Partial<LegiScanStoredSession> = {}): LegiScanStoredSession {
  return {
    id: 1,
    providerSessionId: '2100',
    jurisdiction: 'HI',
    displayName: '2025-2026 Regular Session',
    yearStart: 2025,
    yearEnd: 2026,
    isCurrent: true,
    ...overrides,
  };
}

function storedBill(overrides: Partial<LegiScanStoredBill> = {}): LegiScanStoredBill {
  return {
    id: 11,
    providerBillId: '5001',
    sessionId: 1,
    jurisdiction: 'HI',
    billNumber: 'HB1',
    billType: 'HB',
    title: 'Relating to public records.',
    description: 'Requires agencies to publish records.',
    originChamber: 'House',
    latestActionBody: 'Judiciary',
    latestActionText: 'Referred to Judiciary.',
    latestActionDate: new Date('2025-01-16T00:00:00.000Z'),
    stage: 'committee',
    isActive: true,
    providerStatus: 'Introduced',
    providerStatusCode: '1',
    publicSourceUrl: 'https://legiscan.com/HI/bill/HB1/2025',
    masterChangeHash: 'hash-hb1',
    detailChangeHash: 'hash-hb1',
    detailsPending: false,
    ...overrides,
  };
}

function storedAction(overrides: Partial<LegiScanStoredAction> = {}): LegiScanStoredAction {
  return {
    billId: 11,
    providerActionKey: 'history:0',
    actionDate: new Date('2025-01-15T00:00:00.000Z'),
    body: 'House',
    description: 'Introduced.',
    providerActionCode: '1',
    stage: null,
    sortOrder: 0,
    ...overrides,
  };
}

function normalizedSession(overrides: Partial<NormalizedLegiScanSession> = {}): NormalizedLegiScanSession {
  return {
    providerSessionId: '2100',
    jurisdiction: 'HI',
    displayName: '2025-2026 Regular Session',
    yearStart: 2025,
    yearEnd: 2026,
    isCurrent: true,
    special: false,
    ...overrides,
  };
}

function normalizedMaster(overrides: Partial<NormalizedLegiScanMasterBill> = {}): NormalizedLegiScanMasterBill {
  return {
    providerBillId: '5001',
    billNumber: 'HB1',
    billType: 'HB',
    title: 'Relating to public records.',
    description: 'Requires agencies to publish records.',
    changeHash: 'hash-hb1',
    statusCode: 1,
    statusLabel: 'Introduced',
    stage: 'introduced',
    isActive: true,
    latestActionText: 'Referred to Judiciary.',
    latestActionDate: new Date('2025-01-16T00:00:00.000Z'),
    publicSourceUrl: 'https://legiscan.com/HI/bill/HB1/2025',
    providerStatus: 'Introduced',
    providerStatusCode: '1',
    ...overrides,
  };
}

async function syncHi(input: {
  store?: ReturnType<typeof createMemoryLegiScanStore>;
  fetchImpl: typeof fetch;
  detailBudget?: number;
  dryRun?: boolean;
}) {
  const store = input.store ?? createMemoryLegiScanStore();
  const result = await syncLegiScanStateBills({
    state: 'HI',
    apiKey: SECRET_KEY,
    store,
    fetchImpl: input.fetchImpl,
    detailBudget: input.detailBudget ?? DEFAULT_LEGISCAN_DETAIL_BUDGET,
    dryRun: input.dryRun,
    now: NOW,
  });
  return { store, result };
}

test('maps every documented LegiScan status and fails closed for unknown codes', () => {
  const cases = [
    { statusCode: 0, label: 'N/A', stage: 'other', isActive: false, documented: true },
    { statusCode: 1, label: 'Introduced', stage: 'introduced', isActive: true, documented: true },
    { statusCode: 2, label: 'Engrossed', stage: 'cross_chamber', isActive: true, documented: true },
    { statusCode: 3, label: 'Enrolled', stage: 'enrolled', isActive: true, documented: true },
    { statusCode: 4, label: 'Passed', stage: 'law', isActive: false, documented: true },
    { statusCode: 5, label: 'Vetoed', stage: 'vetoed', isActive: false, documented: true },
    { statusCode: 6, label: 'Failed', stage: 'failed', isActive: false, documented: true },
    { statusCode: 7, label: 'Unknown', stage: 'other', isActive: false, documented: false },
    { statusCode: 99, label: 'Unknown', stage: 'other', isActive: false, documented: false },
  ] as const;

  for (const row of cases) {
    const mapped = mapLegiScanStatus(row.statusCode);
    assert.equal(mapped.label, row.label, String(row.statusCode));
    assert.equal(mapped.stage, row.stage, String(row.statusCode));
    assert.equal(mapped.isActive, row.isActive, String(row.statusCode));
    assert.equal(mapped.documented, row.documented, String(row.statusCode));
  }
});

test('resolves state codes, slugs, and the default detail budget', () => {
  assert.deepEqual(resolveLegiScanStateCodes('HI'), ['HI']);
  assert.deepEqual(resolveLegiScanStateCodes('hawaii'), ['HI']);
  assert.equal(resolveLegiScanStateCodes().length, 50);
  assert.equal(resolveLegiScanDetailBudget(undefined, DEFAULT_LEGISCAN_DETAIL_BUDGET), 200);
  assert.equal(resolveLegiScanDetailBudget('25'), 25);
  assert.throws(() => resolveLegiScanStateCodes('dc'), /Unsupported state legislation scope/);
  assert.throws(() => resolveLegiScanDetailBudget(-1), /non-negative integer/);
});

test('does not call getBill when a master change_hash is unchanged and details are fresh', async () => {
  const store = createMemoryLegiScanStore({
    sessions: [storedSession()],
    bills: [storedBill()],
    actions: [storedAction()],
  });
  const { ops, fetchImpl } = requestOps(hiFixture());
  const { result } = await syncHi({ store, fetchImpl, detailBudget: 200 });

  assert.equal(result.detailRequests, 0);
  assert.equal(result.changedSummaries, 0);
  assert.equal(result.newSummaries, 0);
  assert.equal(result.pendingBacklog, 0);
  assert.equal(ops.includes('getBill'), false);
  assert.equal(store.bills[0]?.detailsPending, false);
  assert.equal(store.bills[0]?.detailChangeHash, 'hash-hb1');
  assert.equal(store.actions.length, 1);
});

test('upserts changed and new summaries as detail-pending and only clears pending after validated getBill', async () => {
  const store = createMemoryLegiScanStore();
  const first = await syncHi({
    store,
    fetchImpl: hiFixture({
      bills: [masterBill(), masterBill({ bill_id: 5002, number: 'SB2', change_hash: 'hash-sb2', url: 'https://legiscan.com/HI/bill/SB2/2025', title: 'Relating to water.' })],
    }),
    detailBudget: 0,
  });

  assert.equal(first.result.newSummaries, 2);
  assert.equal(first.result.detailRequests, 0);
  assert.equal(first.result.pendingBacklog, 2);
  assert.deepEqual(store.bills.map((bill) => bill.detailsPending), [true, true]);
  assert.deepEqual(store.bills.map((bill) => bill.detailChangeHash), [null, null]);
  assert.equal(store.bills.find((bill) => bill.providerBillId === '5001')?.isActive, true);

  const second = await syncHi({
    store,
    fetchImpl: hiFixture({
      bills: [masterBill(), masterBill({ bill_id: 5002, number: 'SB2', change_hash: 'hash-sb2', url: 'https://legiscan.com/HI/bill/SB2/2025', title: 'Relating to water.' })],
      details: {
        '5001': billDetail(),
        '5002': billDetail({
          bill_id: 5002,
          bill_number: 'SB2',
          body: 'S',
          title: 'Relating to water.',
          history: [{ date: '2025-01-15', action: 'Introduced.', chamber: 'S', importance: 1 }],
          committee: null,
          progress: [],
        }),
      },
    }),
    detailBudget: 2,
  });

  assert.equal(second.result.newSummaries, 0);
  assert.equal(second.result.changedSummaries, 0);
  assert.equal(second.result.detailRequests, 2);
  assert.equal(second.result.detailsRefreshed, 2);
  assert.equal(second.result.pendingBacklog, 0);
  for (const bill of store.bills) {
    assert.equal(bill.detailsPending, false);
    assert.equal(bill.detailChangeHash, bill.masterChangeHash);
  }
  assert.equal(store.bills.find((bill) => bill.providerBillId === '5001')?.originChamber, 'House');
  assert.equal(store.bills.find((bill) => bill.providerBillId === '5001')?.stage, 'committee');
  assert.equal(store.bills.find((bill) => bill.providerBillId === '5002')?.originChamber, 'Senate');
  assert.ok(store.actions.some((action) => action.billId === store.bills[0]?.id && action.description === 'Referred to Judiciary.'));
});

test('carries a budget-limited detail backlog and progresses it fairly on the next run', async () => {
  const store = createMemoryLegiScanStore();
  const bills = [
    masterBill({ bill_id: 5001, number: 'HB1', change_hash: 'h1' }),
    masterBill({ bill_id: 5002, number: 'HB2', change_hash: 'h2', url: 'https://legiscan.com/HI/bill/HB2/2025', title: 'Second bill' }),
    masterBill({ bill_id: 5003, number: 'HB3', change_hash: 'h3', url: 'https://legiscan.com/HI/bill/HB3/2025', title: 'Third bill' }),
  ];
  const details = {
    '5001': billDetail({ bill_id: 5001, change_hash: 'h1' }),
    '5002': billDetail({ bill_id: 5002, bill_number: 'HB2', title: 'Second bill', change_hash: 'h2' }),
    '5003': billDetail({ bill_id: 5003, bill_number: 'HB3', title: 'Third bill', change_hash: 'h3' }),
  };

  const first = await syncHi({ store, fetchImpl: hiFixture({ bills, details }), detailBudget: 1 });
  assert.equal(first.result.detailsRefreshed, 1);
  assert.equal(first.result.pendingBacklog, 2);
  const firstRefreshed = store.bills.filter((bill) => !bill.detailsPending).map((bill) => bill.providerBillId);
  assert.deepEqual(firstRefreshed, ['5001']);
  assert.equal(store.checkpoints.get(stateLegislationSyncScope('HI'))?.watermark, 'HI:5001');

  const second = await syncHi({ store, fetchImpl: hiFixture({ bills, details }), detailBudget: 1 });
  assert.equal(second.result.detailsRefreshed, 1);
  assert.equal(second.result.pendingBacklog, 1);
  const secondRefreshed = store.bills.filter((bill) => !bill.detailsPending).map((bill) => bill.providerBillId);
  assert.deepEqual(secondRefreshed, ['5001', '5002']);
  assert.equal(store.checkpoints.get(stateLegislationSyncScope('HI'))?.watermark, 'HI:5002');
});

test('malformed or partial master lists cannot deactivate mirrored bills', async () => {
  const existing = storedBill({ isActive: true, title: 'Keep me' });
  const failures: Array<{ name: string; fetchImpl: typeof fetch }> = [
    {
      name: 'error object',
      fetchImpl: createRouter([
        (url) => url.searchParams.get('op') === 'getSessionList' ? jsonResponse(sessionListPayload([sessionRow()])) : undefined,
        (url) => url.searchParams.get('op') === 'getMasterList'
          ? jsonResponse({ status: 'ERROR', alert: { message: `quota for ${SECRET_KEY}` } })
          : undefined,
      ]),
    },
    {
      name: 'empty master',
      fetchImpl: hiFixture({ bills: [] }),
    },
    {
      name: 'duplicate bill IDs',
      fetchImpl: hiFixture({ bills: [masterBill(), masterBill()] }),
    },
    {
      name: 'missing bill_id',
      fetchImpl: hiFixture({ bills: [masterBill({ bill_id: null })] }),
    },
    {
      name: 'wrong state ownership',
      fetchImpl: hiFixture({ bills: [masterBill({ url: 'https://legiscan.com/CA/bill/AB1/2025' })] }),
    },
  ];

  for (const failure of failures) {
    const store = createMemoryLegiScanStore({
      sessions: [storedSession()],
      bills: [existing],
    });
    let writes = 0;
    const guarded = {
      ...store,
      async applySessionDelta(...args: Parameters<typeof store.applySessionDelta>) {
        writes += 1;
        return store.applySessionDelta(...args);
      },
    };
    const { result } = await syncHi({ store: guarded, fetchImpl: failure.fetchImpl, detailBudget: 0 });
    assert.deepEqual(result.failedScopes, ['HI'], failure.name);
    assert.equal(result.deactivations, 0, failure.name);
    assert.equal(writes, 0, failure.name);
    assert.equal(store.bills[0]?.isActive, true, failure.name);
    assert.equal(store.bills[0]?.title, 'Keep me', failure.name);
  }
});

test('a complete master list deactivates omitted bills without deleting history', async () => {
  const store = createMemoryLegiScanStore({
    sessions: [storedSession()],
    bills: [
      storedBill(),
      storedBill({
        id: 12,
        providerBillId: '5099',
        billNumber: 'HB99',
        title: 'Omitted bill',
        masterChangeHash: 'old-omitted',
        detailChangeHash: 'old-omitted',
      }),
    ],
    actions: [
      storedAction(),
      storedAction({ billId: 12, description: 'Introduced omitted bill.' }),
    ],
  });

  const { result } = await syncHi({
    store,
    fetchImpl: hiFixture(),
    detailBudget: 0,
  });

  const omitted = store.bills.find((bill) => bill.providerBillId === '5099');
  assert.equal(result.deactivations, 1);
  assert.equal(omitted?.isActive, false);
  assert.equal(omitted?.title, 'Omitted bill');
  assert.ok(store.actions.some((action) => action.billId === 12));
  assert.equal(store.bills.length, 2);
});

test('non-authoritative persistence never deactivates omitted bills', async () => {
  const store = createMemoryLegiScanStore({
    sessions: [storedSession()],
    bills: [storedBill({ providerBillId: '5099', isActive: true })],
  });

  const result = await persistLegiScanSessionDelta({
    jurisdiction: 'HI',
    session: normalizedSession(),
    bills: [normalizedMaster()],
    currentProviderSessionIds: ['2100'],
    authoritative: false,
    now: NOW,
  }, store);

  assert.equal(result.deactivated, 0);
  assert.equal(store.bills.find((bill) => bill.providerBillId === '5099')?.isActive, true);
});

test('a failed getBill keeps the master summary and prior detail/actions', async () => {
  const store = createMemoryLegiScanStore({
    sessions: [storedSession()],
    bills: [storedBill({
      masterChangeHash: 'hash-old',
      detailChangeHash: 'hash-old',
      detailsPending: false,
      title: 'Prior title',
      originChamber: 'House',
      latestActionBody: 'Judiciary',
    })],
    actions: [storedAction({ description: 'Prior valid action.' })],
  });

  const { result } = await syncHi({
    store,
    fetchImpl: hiFixture({
      bills: [masterBill({ change_hash: 'hash-new', title: 'Updated title' })],
      details: {
        '5001': billDetail({ history: 'not-an-array' }),
      },
    }),
    detailBudget: 1,
  });

  const bill = store.bills[0];
  assert.equal(result.detailsRefreshed, 0);
  assert.equal(result.pendingBacklog, 1);
  assert.equal(bill?.title, 'Updated title');
  assert.equal(bill?.detailsPending, true);
  assert.equal(bill?.detailChangeHash, 'hash-old');
  assert.equal(bill?.originChamber, 'House');
  assert.equal(bill?.latestActionBody, 'Judiciary');
  assert.deepEqual(store.actions.map((action) => action.description), ['Prior valid action.']);
});

test('rejects duplicate session and master IDs at the fetch boundary', async () => {
  await assert.rejects(
    fetchLegiScanSessionList(
      async () => jsonResponse(sessionListPayload([sessionRow(), sessionRow()])),
      SECRET_KEY,
      'HI',
    ),
    /duplicate session IDs/,
  );
  await assert.rejects(
    fetchLegiScanMasterList(
      async () => jsonResponse(masterListPayload([masterBill(), masterBill()])),
      SECRET_KEY,
      '2100',
      'HI',
    ),
    /duplicate bill IDs/,
  );
});

test('redacts API keys from thrown errors and sync results', async () => {
  assert.equal(
    redactLegiScanSecrets(`https://api.legiscan.com/?key=${SECRET_KEY}&op=getBill`, SECRET_KEY).includes(SECRET_KEY),
    false,
  );

  const thrown = await fetchLegiScanSessionList(async (input) => {
    throw new Error(`network failed for ${String(input)}`);
  }, SECRET_KEY, 'HI').then(() => {
    throw new Error('expected fetch failure');
  }, (error: unknown) => error);

  assert.ok(thrown instanceof Error);
  assert.equal(thrown.message.includes(SECRET_KEY), false);
  assert.match(thrown.message, /\[redacted\]/);

  const errored = await fetchLegiScanMasterList(async () => jsonResponse({
    status: 'ERROR',
    alert: { message: `invalid key ${SECRET_KEY}` },
  }), SECRET_KEY, '2100', 'HI').then(() => {
    throw new Error('expected provider error');
  }, (error: unknown) => error);

  assert.ok(errored instanceof Error);
  assert.equal(errored.message.includes(SECRET_KEY), false);
  assert.match(errored.message, /\[redacted\]/);

  const { result } = await syncHi({
    fetchImpl: hiFixture(),
    detailBudget: 1,
  });
  assert.equal(JSON.stringify(result).includes(SECRET_KEY), false);
});

test('session rollover marks old sessions non-current and retains historical rows', async () => {
  const store = createMemoryLegiScanStore({
    sessions: [storedSession({ providerSessionId: '1000', displayName: '2023-2024 Regular Session', yearStart: 2023, yearEnd: 2024 })],
    bills: [storedBill({
      providerBillId: '4000',
      billNumber: 'HB400',
      title: 'Old session bill',
      masterChangeHash: 'old-hash',
      detailChangeHash: 'old-hash',
    })],
    actions: [storedAction({ description: 'Old history.' })],
  });

  const { result } = await syncHi({
    store,
    fetchImpl: hiFixture({
      sessions: [
        sessionRow({ session_id: 2100, prior: 0 }),
        sessionRow({ session_id: 1000, prior: 1, year_start: 2023, year_end: 2024, session_title: '2023-2024 Regular Session' }),
      ],
      bills: [masterBill()],
    }),
    detailBudget: 0,
  });

  const oldSession = store.sessions.find((session) => session.providerSessionId === '1000');
  const newSession = store.sessions.find((session) => session.providerSessionId === '2100');
  const oldBill = store.bills.find((bill) => bill.providerBillId === '4000');
  const newBill = store.bills.find((bill) => bill.providerBillId === '5001');

  assert.equal(oldSession?.isCurrent, false);
  assert.equal(newSession?.isCurrent, true);
  assert.equal(oldBill?.title, 'Old session bill');
  assert.equal(oldBill?.isActive, true);
  assert.equal(newBill?.detailsPending, true);
  assert.equal(result.newSummaries, 1);
  assert.ok(store.actions.some((action) => action.description === 'Old history.'));
});

test('replays the same master list idempotently', async () => {
  const store = createMemoryLegiScanStore();
  const fetchImpl = hiFixture();
  const first = await syncHi({ store, fetchImpl, detailBudget: 1 });
  const snapshot = structuredClone(store.bills);
  const second = await syncHi({ store, fetchImpl, detailBudget: 1 });

  assert.equal(first.result.newSummaries, 1);
  assert.equal(first.result.detailsRefreshed, 1);
  assert.equal(second.result.newSummaries, 0);
  assert.equal(second.result.changedSummaries, 0);
  assert.equal(second.result.detailsRefreshed, 0);
  assert.equal(second.result.detailRequests, 0);
  assert.deepEqual(store.bills.map((bill) => ({
    providerBillId: bill.providerBillId,
    masterChangeHash: bill.masterChangeHash,
    detailChangeHash: bill.detailChangeHash,
    detailsPending: bill.detailsPending,
    title: bill.title,
  })), snapshot.map((bill) => ({
    providerBillId: bill.providerBillId,
    masterChangeHash: bill.masterChangeHash,
    detailChangeHash: bill.detailChangeHash,
    detailsPending: bill.detailsPending,
    title: bill.title,
  })));
});

test('dry-run reports intended changes without writing sessions, bills, or checkpoints', async () => {
  const store = createMemoryLegiScanStore();
  const { result } = await syncHi({
    store,
    fetchImpl: hiFixture(),
    detailBudget: 1,
    dryRun: true,
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.newSummaries, 1);
  assert.equal(result.sessionRequests, 1);
  assert.equal(result.masterRequests, 1);
  assert.equal(result.detailRequests, 0);
  assert.equal(store.sessions.length, 0);
  assert.equal(store.bills.length, 0);
  assert.equal(store.checkpoints.size, 0);
});

test('counts session and master requests in the run total and uses state:HI checkpoints', async () => {
  const { store, result } = await syncHi({
    fetchImpl: hiFixture(),
    detailBudget: 1,
  });

  assert.equal(result.requestCount, result.sessionRequests + result.masterRequests + result.detailRequests);
  assert.equal(result.sessionRequests, 1);
  assert.equal(result.masterRequests, 1);
  assert.equal(result.detailRequests, 1);
  assert.ok(store.checkpoints.has(stateLegislationSyncScope('HI')));
  assert.equal(stateLegislationSyncScope('HI'), 'state:HI');
});

test('unknown master statuses stay inactive and committee/floor/executive details refine stage', () => {
  const unknown = normalizeLegiScanBillDetail(billDetail({
    status: 42,
    history: [{ date: '2025-01-15', action: 'Something odd.', chamber: 'H', importance: 0 }],
    committee: null,
    progress: [],
  }), { jurisdiction: 'HI', providerBillId: '5001' });
  assert.equal(unknown.stage, 'other');
  assert.equal(unknown.isActive, false);

  const floor = normalizeLegiScanBillDetail(billDetail({
    committee: null,
    progress: [],
    history: [
      { date: '2025-01-15', action: 'Introduced.', chamber: 'H', importance: 1 },
      { date: '2025-02-01', action: 'Third reading.', chamber: 'H', importance: 1 },
    ],
  }), { jurisdiction: 'HI', providerBillId: '5001' });
  assert.equal(floor.stage, 'floor');
  assert.equal(floor.isActive, true);
  assert.equal(floor.originChamber, 'House');
  assert.equal(floor.latestActionBody, 'House');

  const executive = normalizeLegiScanBillDetail(billDetail({
    status: 3,
    committee: null,
    progress: [],
    history: [
      { date: '2025-03-01', action: 'Enrolled.', chamber: 'H', importance: 1 },
      { date: '2025-03-02', action: 'Transmitted to Governor.', chamber: 'H', importance: 1 },
    ],
  }), { jurisdiction: 'HI', providerBillId: '5001' });
  assert.equal(executive.stage, 'executive');
  assert.equal(executive.isActive, true);
});
