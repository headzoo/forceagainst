import assert from 'node:assert/strict';
import test from 'node:test';
import { currentCongressForDate } from '../lib/legislative-bills';
import {
  congressBillProviderId,
  congressResumeStartIndex,
  congressSessionFromNumber,
  DEFAULT_CONGRESS_DETAIL_BUDGET,
  fetchUpdatedCongressBills,
  mapCongressLifecycle,
  normalizeCongressBill,
  normalizeCongressBillActions,
  originChamberFromBillType,
  redactCongressApiKey,
  resolveCongressDetailBudget,
  syncCongressBills,
  type CongressBillActionInput,
  type CongressBillCheckpoint,
  type CongressBillStore,
  type NormalizedCongressBill,
  type NormalizedCongressBillAction,
  type NormalizedCongressSession,
} from '../lib/congress-bill-sync';

const SECRET_KEY = 'super-secret-congress-key';

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function listBill(congress: number, type: string, number: string, extras: Record<string, unknown> = {}) {
  return {
    congress,
    type,
    number,
    originChamber: type.startsWith('S') ? 'Senate' : 'House',
    title: `${type} ${number} title`,
    updateDate: '2025-01-04',
    url: `https://api.congress.gov/v3/bill/${congress}/${type.toLowerCase()}/${number}?format=json`,
    ...extras,
  };
}

function detailPayload(
  congress: number,
  type: string,
  number: string,
  extras: Record<string, unknown> = {},
) {
  return {
    bill: {
      congress,
      type,
      number,
      title: `${type} ${number} title`,
      introducedDate: '2025-01-03',
      updateDate: '2025-01-04T12:00:00Z',
      latestAction: { actionDate: '2025-01-04', text: 'Introduced in House' },
      laws: [],
      ...extras,
    },
  };
}

function actionsPayload(actions: unknown[], next: string | null = null) {
  return {
    actions,
    pagination: { count: actions.length, next },
  };
}

function urlOf(input: Parameters<typeof fetch>[0]) {
  return new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
}

function createRouter(handlers: Array<(url: URL) => Response | undefined>): typeof fetch {
  return async (input) => {
    const url = urlOf(input);
    for (const handler of handlers) {
      const response = handler(url);
      if (response) return response;
    }
    throw new Error(`Unexpected Congress.gov request: ${url.pathname}`);
  };
}

type StoredCongressSession = Omit<NormalizedCongressSession, 'isCurrent'> & {
  id: number;
  isCurrent: boolean;
};

function createMemoryStore(initial?: {
  sessions?: StoredCongressSession[];
  bills?: Array<NormalizedCongressBill & { sessionId: number }>;
  checkpoint?: CongressBillCheckpoint | null;
}): CongressBillStore & {
  sessions: Map<string, StoredCongressSession>;
  bills: Map<string, NormalizedCongressBill & { sessionId: number }>;
  actions: Map<string, NormalizedCongressBillAction[]>;
  checkpoint: CongressBillCheckpoint | null;
} {
  const sessions = new Map((initial?.sessions ?? []).map((session) => [session.providerSessionId, session]));
  const bills = new Map((initial?.bills ?? []).map((bill) => [bill.providerBillId, bill]));
  const actions = new Map<string, NormalizedCongressBillAction[]>();
  const store = {
    sessions,
    bills,
    actions,
    checkpoint: initial?.checkpoint ?? null,
    async upsertSession(session: NormalizedCongressSession) {
      for (const row of sessions.values()) {
        if (row.providerSessionId !== session.providerSessionId) row.isCurrent = false;
      }
      const existing = sessions.get(session.providerSessionId);
      const id = existing?.id ?? sessions.size + 1;
      sessions.set(session.providerSessionId, { ...session, id, isCurrent: true });
      return { id };
    },
    async upsertBill(bill: NormalizedCongressBill, billActions: NormalizedCongressBillAction[], sessionId: number) {
      bills.set(bill.providerBillId, { ...bill, sessionId });
      actions.set(bill.providerBillId, billActions);
    },
    async loadCheckpoint() {
      return store.checkpoint;
    },
    async saveCheckpoint(checkpoint: CongressBillCheckpoint) {
      store.checkpoint = checkpoint;
    },
  };
  return store;
}

function currentCongressFixture(congress: number, bills: Array<ReturnType<typeof listBill>>) {
  const details = new Map(bills.map((bill) => [
    `/${bill.congress}/${String(bill.type).toLowerCase()}/${bill.number}`,
    detailPayload(bill.congress, String(bill.type), String(bill.number), {
      latestAction: bill.type === 'S'
        ? { actionDate: '2025-01-04', text: 'Introduced in Senate' }
        : { actionDate: '2025-01-04', text: 'Introduced in House' },
    }),
  ]));
  const actionLists = new Map(bills.map((bill) => [
    `/${bill.congress}/${String(bill.type).toLowerCase()}/${bill.number}`,
    [
      {
        actionDate: '2025-01-03',
        text: bill.type === 'S' ? 'Introduced in Senate' : 'Introduced in House',
        type: 'IntroReferral',
        sourceSystem: { name: bill.type === 'S' ? 'Senate' : 'House floor actions' },
      },
    ],
  ]));

  return createRouter([
    (url) => {
      if (url.pathname === `/v3/bill/${congress}` && !url.searchParams.get('offset')) {
        return jsonResponse({
          bills,
          pagination: { count: bills.length, next: null },
        });
      }
      return undefined;
    },
    (url) => {
      const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
      if (!detail) return undefined;
      const payload = details.get(`/${detail[1]}/${detail[2]}/${detail[3]}`);
      return payload ? jsonResponse(payload) : undefined;
    },
    (url) => {
      const actionPath = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)\/actions$/.exec(url.pathname);
      if (!actionPath) return undefined;
      const rows = actionLists.get(`/${actionPath[1]}/${actionPath[2]}/${actionPath[3]}`) ?? [];
      return jsonResponse(actionsPayload(rows));
    },
  ]);
}

test('derives origin chamber only from recognized bill types', () => {
  assert.equal(originChamberFromBillType('HR'), 'house');
  assert.equal(originChamberFromBillType('h.r.'), 'house');
  assert.equal(originChamberFromBillType('HRES'), 'house');
  assert.equal(originChamberFromBillType('HJRES'), 'house');
  assert.equal(originChamberFromBillType('HCONRES'), 'house');
  assert.equal(originChamberFromBillType('S'), 'senate');
  assert.equal(originChamberFromBillType('SRES'), 'senate');
  assert.equal(originChamberFromBillType('SJRES'), 'senate');
  assert.equal(originChamberFromBillType('SCONRES'), 'senate');
  assert.equal(originChamberFromBillType('AMDT'), null);
  assert.equal(originChamberFromBillType('X'), null);
});

test('keeps House and Senate origin separate from latest action body', () => {
  const houseInSenate = normalizeCongressBill({
    congress: 119,
    billType: 'HR',
    billNumber: '1',
    title: 'Example House bill',
    latestAction: { actionDate: '2025-02-01', text: 'Received in the Senate.' },
  }, [
    { actionDate: '2025-01-03', text: 'Introduced in House', type: 'IntroReferral', sourceSystemName: 'House floor actions' },
    { actionDate: '2025-02-01', text: 'Received in the Senate.', type: 'Floor', sourceSystemName: 'Senate' },
  ]);
  const senateInHouse = normalizeCongressBill({
    congress: 119,
    billType: 'S',
    billNumber: '2',
    title: 'Example Senate bill',
    latestAction: { actionDate: '2025-02-02', text: 'Received in the House.' },
  }, [
    { actionDate: '2025-01-03', text: 'Introduced in Senate', type: 'IntroReferral', sourceSystemName: 'Senate' },
    { actionDate: '2025-02-02', text: 'Received in the House.', type: 'Floor', sourceSystemName: 'House floor actions' },
  ]);

  assert.equal(houseInSenate.originChamber, 'house');
  assert.equal(houseInSenate.latestActionBody, 'Senate');
  assert.equal(houseInSenate.stage, 'cross_chamber');
  assert.equal(houseInSenate.isActive, true);
  assert.equal('currentChamber' in houseInSenate, false);
  assert.equal(senateInHouse.originChamber, 'senate');
  assert.equal(senateInHouse.latestActionBody, 'House');
  assert.equal(senateInHouse.stage, 'cross_chamber');
  assert.equal('currentChamber' in senateInHouse, false);
});

test('maps terminal and in-progress Congress.gov actions conservatively', () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof mapCongressLifecycle>[0];
    stage: string;
    isActive: boolean;
  }> = [
    { name: 'introduced', input: { originChamber: 'house', actionType: 'IntroReferral', actionText: 'Introduced in House' }, stage: 'introduced', isActive: true },
    { name: 'referred', input: { originChamber: 'house', actionType: 'IntroReferral', actionText: 'Referred to the House Committee on the Judiciary.' }, stage: 'committee', isActive: true },
    { name: 'committee', input: { originChamber: 'senate', actionType: 'Committee', actionText: 'Committee on Finance. Hearings held.' }, stage: 'committee', isActive: true },
    { name: 'calendar', input: { originChamber: 'house', actionType: 'Calendars', actionText: 'Placed on the Union Calendar, Calendar No. 12.' }, stage: 'floor', isActive: true },
    { name: 'passed origin chamber', input: { originChamber: 'house', actionType: 'Floor', actionText: 'Passed House', sourceSystemName: 'House floor actions' }, stage: 'floor', isActive: true },
    { name: 'received other chamber', input: { originChamber: 'house', actionType: 'Floor', actionText: 'Received in the Senate.', sourceSystemName: 'Senate' }, stage: 'cross_chamber', isActive: true },
    { name: 'conference', input: { originChamber: 'senate', actionType: 'ResolvingDifferences', actionText: 'Conference held.' }, stage: 'cross_chamber', isActive: true },
    { name: 'presented', input: { originChamber: 'house', actionType: 'President', actionText: 'Presented to President.' }, stage: 'enrolled', isActive: true },
    { name: 'president', input: { originChamber: 'house', actionType: 'President', actionText: 'To President.' }, stage: 'executive', isActive: true },
    { name: 'became law', input: { originChamber: 'house', actionType: 'BecameLaw', actionText: 'Became Public Law No: 119-1.' }, stage: 'law', isActive: false },
    { name: 'signed', input: { originChamber: 'senate', actionText: 'Signed by President.' }, stage: 'law', isActive: false },
    { name: 'law record', input: { originChamber: 'house', actionText: 'Message received.', hasLawRecord: true }, stage: 'law', isActive: false },
    { name: 'vetoed', input: { originChamber: 'house', actionType: 'Veto', actionText: 'Vetoed by President.' }, stage: 'vetoed', isActive: false },
    { name: 'failed', input: { originChamber: 'senate', actionText: 'Failed of passage in Senate.' }, stage: 'failed', isActive: false },
    { name: 'withdrawn', input: { originChamber: 'house', actionText: 'Withdrawn from further consideration.' }, stage: 'failed', isActive: false },
    { name: 'ambiguous', input: { originChamber: 'house', actionText: 'Motion to reconsider laid on the table Agreed to without objection.' }, stage: 'other', isActive: true },
  ];

  for (const row of cases) {
    const mapped = mapCongressLifecycle(row.input);
    assert.equal(mapped.stage, row.stage, row.name);
    assert.equal(mapped.isActive, row.isActive, row.name);
    assert.equal('currentChamber' in mapped, false, row.name);
  }
});

test('orders bill actions deterministically and replaces identity with a stable key', () => {
  const actions: CongressBillActionInput[] = [
    { actionDate: '2025-01-05', text: 'Received in the Senate.', type: 'Floor', sourceSystemName: 'Senate' },
    { actionDate: '2025-01-03', text: 'Introduced in House', type: 'IntroReferral', sourceSystemName: 'House floor actions' },
  ];
  const normalized = normalizeCongressBillActions(actions, 'house');
  assert.equal(normalized[0]?.description, 'Introduced in House');
  assert.equal(normalized[0]?.sortOrder, 0);
  assert.equal(normalized[1]?.description, 'Received in the Senate.');
  assert.equal(normalized[1]?.body, 'Senate');
  assert.notEqual(normalized[0]?.providerActionKey, normalized[1]?.providerActionKey);
});

test('fetches every Congress.gov bill page before accepting an update window', async () => {
  const first = Array.from({ length: 250 }, (_, index) => listBill(119, 'HR', String(index + 1)));
  const second = Array.from({ length: 2 }, (_, index) => listBill(119, 'S', String(index + 1)));
  const fetchImpl = createRouter([
    (url) => {
      if (url.pathname === '/v3/bill/119' && !url.searchParams.get('offset')) {
        return jsonResponse({
          bills: first,
          pagination: {
            count: 252,
            next: 'https://api.congress.gov/v3/bill/119?format=json&limit=250&offset=250&sort=updateDate%2Basc',
          },
        });
      }
      return undefined;
    },
    (url) => {
      if (url.pathname === '/v3/bill/119' && url.searchParams.get('offset') === '250') {
        return jsonResponse({ bills: second, pagination: { count: 252, next: null } });
      }
      return undefined;
    },
  ]);

  const bills = await fetchUpdatedCongressBills(fetchImpl, 'test', 119);
  assert.equal(bills.length, 252);
  assert.equal(bills[0]?.billType, 'HR');
  assert.equal(bills.at(-1)?.billType, 'S');
  assert.equal('originChamber' in (bills.at(-1) ?? {}), false);
});

test('rejects incomplete pages, duplicate IDs, and unsafe pagination URLs without leaking the API key', async () => {
  await assert.rejects(
    fetchUpdatedCongressBills(async () => jsonResponse({
      bills: [listBill(119, 'HR', '1')],
      pagination: { count: 2, next: null },
    }), SECRET_KEY, 119),
    /ended before the complete bill list/,
  );

  await assert.rejects(
    fetchUpdatedCongressBills(async () => jsonResponse({
      bills: [listBill(119, 'HR', '1'), listBill(119, 'HR', '1')],
      pagination: { count: 2, next: null },
    }), SECRET_KEY, 119),
    /duplicate bill IDs/,
  );

  await assert.rejects(
    fetchUpdatedCongressBills(async () => new Response('not-json', { status: 200 }), SECRET_KEY, 119),
    /invalid JSON/,
  );

  await assert.rejects(
    fetchUpdatedCongressBills(async () => new Response('nope', { status: 503 }), SECRET_KEY, 119),
    /request failed \(503\)/,
  );

  const leaked = await fetchUpdatedCongressBills(async () => jsonResponse({
    bills: [listBill(119, 'HR', '1')],
    pagination: { count: 2, next: `https://evil.example/steal?api_key=${SECRET_KEY}` },
  }), SECRET_KEY, 119).then(() => {
    throw new Error('expected pagination URL rejection');
  }, (error: unknown) => error);

  assert.ok(leaked instanceof Error);
  assert.match(leaked.message, /invalid pagination URL/);
  assert.equal(leaked.message.includes(SECRET_KEY), false);
  assert.match(leaked.message, /\[redacted\]/);
  assert.equal(redactCongressApiKey(`https://api.congress.gov/v3/bill/119?api_key=${SECRET_KEY}`, SECRET_KEY).includes(SECRET_KEY), false);
});

test('syncs current-Congress bills by origin chamber and quarantines unknown types', async () => {
  const congress = currentCongressForDate(new Date('2025-06-15T12:00:00.000Z'));
  const store = createMemoryStore();
  const result = await syncCongressBills({
    now: new Date('2025-06-15T12:00:00.000Z'),
    apiKey: SECRET_KEY,
    persist: store,
    fetchImpl: currentCongressFixture(congress, [
      listBill(congress, 'HR', '10'),
      listBill(congress, 'S', '11'),
      listBill(congress, 'AMDT', '3', { title: 'Not a bill' }),
    ]),
  });

  assert.equal(result.congress, congress);
  assert.equal(result.mode, 'bootstrap');
  assert.equal(result.outcome, 'complete');
  assert.equal(result.fetched, 3);
  assert.equal(result.accepted, 2);
  assert.equal(result.rejected, 1);
  assert.equal(result.watermarkAdvanced, true);
  assert.equal(result.dryRun, false);
  assert.equal(store.checkpoint?.metadata?.resumeAfter, undefined);
  assert.equal(store.bills.size, 2);
  assert.equal(store.bills.get(congressBillProviderId(congress, 'HR', '10'))?.originChamber, 'house');
  assert.equal(store.bills.get(congressBillProviderId(congress, 'S', '11'))?.originChamber, 'senate');
  assert.equal(store.bills.has(congressBillProviderId(congress, 'AMDT', '3')), false);
  assert.equal(store.sessions.get(String(congress))?.isCurrent, true);
  assert.ok(store.checkpoint?.watermark);
  assert.deepEqual([...store.bills.values()].map((bill) => 'currentChamber' in bill), [false, false]);
});

test('replays an overlapping incremental window idempotently', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const store = createMemoryStore();
  const bills = [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11')];
  const first = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    fetchImpl: currentCongressFixture(congress, bills),
  });

  const later = new Date('2025-06-16T12:00:00.000Z');
  let sawIncrementalFilter = false;
  const incremental = createRouter([
    (url) => {
      if (url.pathname === `/v3/bill/${congress}`) {
        assert.equal(url.searchParams.get('fromDateTime'), '2025-06-15T00:00:00Z');
        assert.equal(url.searchParams.get('toDateTime'), '2025-06-17T00:00:00Z');
        assert.equal(url.searchParams.get('sort'), 'updateDate+asc');
        sawIncrementalFilter = true;
        return jsonResponse({ bills, pagination: { count: bills.length, next: null } });
      }
      return undefined;
    },
    (url) => {
      const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
      if (detail) return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
      return undefined;
    },
    (url) => {
      if (url.pathname.endsWith('/actions')) return jsonResponse(actionsPayload([{
        actionDate: '2025-01-03',
        text: 'Introduced in House',
        type: 'IntroReferral',
        sourceSystem: { name: 'House floor actions' },
      }]));
      return undefined;
    },
  ]);

  const second = await syncCongressBills({
    now: later,
    apiKey: SECRET_KEY,
    persist: store,
    fetchImpl: incremental,
  });

  assert.equal(sawIncrementalFilter, true);
  assert.equal(second.mode, 'incremental');
  assert.equal(second.outcome, 'complete');
  assert.equal(second.accepted, 2);
  assert.equal(store.bills.size, 2);
  assert.equal(second.watermarkAdvanced, true);
  assert.equal(store.checkpoint?.metadata?.resumeAfter, undefined);
  assert.notEqual(store.checkpoint?.watermark, first.windowTo);
});

test('does not advance the watermark when a persisted write fails', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const store = createMemoryStore();
  let writes = 0;
  const persist: CongressBillStore = {
    ...store,
    async upsertBill(bill, actions, sessionId) {
      writes += 1;
      if (writes === 2) throw new Error('simulated persistence failure');
      return store.upsertBill(bill, actions, sessionId);
    },
  };

  await assert.rejects(
    syncCongressBills({
      now,
      apiKey: SECRET_KEY,
      persist,
      fetchImpl: currentCongressFixture(congress, [
        listBill(congress, 'HR', '10'),
        listBill(congress, 'S', '11'),
      ]),
    }),
    /simulated persistence failure/,
  );

  assert.equal(store.bills.size, 1);
  assert.equal(store.checkpoint, null);
});

test('creates a new current-Congress session on the January 3 rollover without deleting old bills', async () => {
  const oldCongress = currentCongressForDate(new Date('2025-01-02T23:59:59.999Z'));
  const newCongress = currentCongressForDate(new Date('2025-01-03T00:00:00.000Z'));
  assert.equal(oldCongress, 118);
  assert.equal(newCongress, 119);

  const store = createMemoryStore({
    sessions: [{ ...congressSessionFromNumber(oldCongress), id: 1, isCurrent: true }],
    bills: [{
      source: 'congress',
      providerBillId: congressBillProviderId(oldCongress, 'HR', '9'),
      congress: oldCongress,
      jurisdiction: 'US',
      billNumber: 'H.R. 9',
      billType: 'HR',
      title: 'Old Congress bill',
      description: '',
      originChamber: 'house',
      latestActionBody: 'House',
      latestActionText: 'Introduced in House',
      latestActionDate: new Date('2024-02-01T00:00:00Z'),
      stage: 'introduced',
      isActive: true,
      providerStatus: 'IntroReferral',
      providerStatusCode: null,
      publicSourceUrl: 'https://www.congress.gov/bill/118th-congress/house-bill/9',
      providerUpdatedAt: new Date('2024-02-01T00:00:00Z'),
      detailsPending: false,
      fingerprint: 'old',
      sessionId: 1,
    }],
    checkpoint: { watermark: '2025-01-03T00:00:00Z', lastSuccessAt: new Date('2025-01-02T00:00:00Z') },
  });

  const result = await syncCongressBills({
    now: new Date('2025-01-03T00:00:00.000Z'),
    apiKey: SECRET_KEY,
    persist: store,
    fetchImpl: currentCongressFixture(newCongress, [listBill(newCongress, 'HR', '1')]),
  });

  assert.equal(result.congress, 119);
  assert.equal(store.bills.has(congressBillProviderId(oldCongress, 'HR', '9')), true);
  assert.equal(store.bills.get(congressBillProviderId(oldCongress, 'HR', '9'))?.isActive, true);
  assert.equal(store.bills.get(congressBillProviderId(newCongress, 'HR', '1'))?.originChamber, 'house');
  assert.equal(store.sessions.get('118')?.isCurrent, false);
  assert.equal(store.sessions.get('119')?.isCurrent, true);
  assert.equal(store.sessions.get('119')?.displayName, '119th Congress');
});

test('dry run fetches and normalizes without writing bills or advancing the watermark', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const checkpoint: CongressBillCheckpoint = {
    watermark: '2025-06-14T00:00:00Z',
    lastSuccessAt: new Date('2025-06-14T00:00:00Z'),
    metadata: { resumeAfter: congressBillProviderId(congress, 'HR', '1') },
  };
  const store = createMemoryStore({ checkpoint });
  const result = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    dryRun: true,
    fetchImpl: currentCongressFixture(congress, [listBill(congress, 'HR', '10')]),
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.accepted, 1);
  assert.equal(result.outcome, 'complete');
  assert.equal(result.watermarkAdvanced, false);
  assert.equal(store.bills.size, 0);
  assert.equal(store.sessions.size, 0);
  assert.deepEqual(store.checkpoint, checkpoint);
});

test('redacts provider keys from sync warnings and stays separate from the roster result shape', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const result = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: createMemoryStore(),
    fetchImpl: currentCongressFixture(congress, [
      listBill(congress, 'HR', '10'),
      listBill(congress, 'ZZ', '99'),
    ]),
  });

  assert.equal('upserted' in result, false);
  assert.equal('deactivated' in result, false);
  assert.ok(result.warnings.some((warning) => warning.includes('ZZ')));
  assert.equal(JSON.stringify(result).includes(SECRET_KEY), false);
});

test('uses a positive default Congress detail budget and accepts a non-negative override', () => {
  assert.equal(DEFAULT_CONGRESS_DETAIL_BUDGET > 0, true);
  assert.equal(resolveCongressDetailBudget(undefined, DEFAULT_CONGRESS_DETAIL_BUDGET), 200);
  assert.equal(resolveCongressDetailBudget('25'), 25);
  assert.equal(resolveCongressDetailBudget(0), 0);
  assert.throws(() => resolveCongressDetailBudget(-1), /non-negative integer/);
  assert.equal(congressResumeStartIndex([
    { congress: 119, billType: 'HR', billNumber: '1', title: null, updateDate: null, apiUrl: null },
    { congress: 119, billType: 'S', billNumber: '2', title: null, updateDate: null, apiUrl: null },
  ], congressBillProviderId(119, 'HR', '1')), 1);
});

test('persists each accepted bill before fetching the next bill', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const bills = [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11'), listBill(congress, 'HR', '12')];
  const events: string[] = [];
  const store = createMemoryStore();
  const persist: CongressBillStore = {
    ...store,
    async upsertBill(bill, actions, sessionId) {
      events.push(`persist:${bill.providerBillId}`);
      return store.upsertBill(bill, actions, sessionId);
    },
  };

  const result = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist,
    fetchImpl: createRouter([
      (url) => {
        if (url.pathname === `/v3/bill/${congress}` && !url.searchParams.get('offset')) {
          return jsonResponse({ bills, pagination: { count: bills.length, next: null } });
        }
        return undefined;
      },
      (url) => {
        const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
        if (!detail) return undefined;
        events.push(`detail:${detail[2]}-${detail[3]}`);
        const persistCount = events.filter((event) => event.startsWith('persist:')).length;
        const detailCount = events.filter((event) => event.startsWith('detail:')).length;
        assert.equal(persistCount, detailCount - 1, 'fetched a later bill before persisting the previous one');
        return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
      },
      (url) => {
        if (url.pathname.endsWith('/actions')) {
          return jsonResponse(actionsPayload([{
            actionDate: '2025-01-03',
            text: 'Introduced in House',
            type: 'IntroReferral',
            sourceSystem: { name: 'House floor actions' },
          }]));
        }
        return undefined;
      },
    ]),
  });

  assert.equal(result.outcome, 'complete');
  assert.deepEqual(events.filter((event) => event.startsWith('persist:')).map((_, index, persisted) => {
    const detail = events.filter((event) => event.startsWith('detail:'))[index];
    return [detail, persisted[index]];
  }), [
    ['detail:hr-10', `persist:${congressBillProviderId(congress, 'HR', '10')}`],
    ['detail:s-11', `persist:${congressBillProviderId(congress, 'S', '11')}`],
    ['detail:hr-12', `persist:${congressBillProviderId(congress, 'HR', '12')}`],
  ]);
  assert.equal(store.bills.size, 3);
});

function catalogFetch(
  congress: number,
  bills: Array<ReturnType<typeof listBill>>,
  options: {
    poison?: { type: string; number: string; mode: 'malformed' | '429' | 'timeout' };
    onDetail?: (key: string) => void;
  } = {},
): typeof fetch {
  return createRouter([
    (url) => {
      if (url.pathname === `/v3/bill/${congress}`) {
        return jsonResponse({ bills, pagination: { count: bills.length, next: null } });
      }
      return undefined;
    },
    (url) => {
      const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
      if (!detail) return undefined;
      const key = `${detail[2]}-${detail[3]}`;
      options.onDetail?.(key);
      if (options.poison && detail[2] === options.poison.type && detail[3] === options.poison.number) {
        if (options.poison.mode === '429') return new Response('slow down', { status: 429 });
        if (options.poison.mode === 'timeout') {
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          throw error;
        }
        throw new Error(`malformed Congress.gov detail api_key=${SECRET_KEY}`);
      }
      return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
    },
    (url) => {
      if (url.pathname.endsWith('/actions')) {
        return jsonResponse(actionsPayload([{
          actionDate: '2025-01-03',
          text: 'Introduced in House',
          type: 'IntroReferral',
          sourceSystem: { name: 'House floor actions' },
        }]));
      }
      return undefined;
    },
  ]);
}

test('quarantines isolated bill failures without pinning resume before the failed bill', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const poison = { type: 's', number: '11', mode: 'malformed' as const };
  const catalog = [
    listBill(congress, 'HR', '10'),
    listBill(congress, 'S', '11'),
    listBill(congress, 'HR', '12'),
    listBill(congress, 'HR', '13'),
  ];
  const store = createMemoryStore();
  const first = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    detailBudget: 3,
    fetchImpl: catalogFetch(congress, catalog, { poison }),
  });

  assert.equal(first.outcome, 'successful-with-backlog');
  assert.equal(first.watermarkAdvanced, false);
  assert.equal(first.accepted, 2);
  assert.equal(first.rejected, 1);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'HR', '10')), true);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'S', '11')), false);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'HR', '12')), true);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'HR', '13')), false);
  assert.equal(store.checkpoint?.watermark, null);
  const failedId = congressBillProviderId(congress, 'S', '11');
  assert.equal(store.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '12'));
  assert.ok(first.warnings.some((warning) => (
    warning.includes('S 11') && warning.includes('Quarantined') && warning.includes('[redacted]')
  )));
  assert.equal(JSON.stringify(first.warnings).includes(SECRET_KEY), false);

  const requested: string[] = [];
  const second = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    detailBudget: 1,
    fetchImpl: catalogFetch(congress, catalog, { poison, onDetail: (key) => requested.push(key) }),
  });

  assert.deepEqual(requested, ['hr-13']);
  assert.equal(requested.includes('s-11'), false);
  assert.equal(second.accepted, 1);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'HR', '13')), true);

  const quarantinedOnly = createMemoryStore();
  const completed = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: quarantinedOnly,
    fetchImpl: catalogFetch(congress, [
      listBill(congress, 'S', '11'),
      listBill(congress, 'HR', '12'),
    ], { poison }),
  });

  assert.equal(completed.outcome, 'complete');
  assert.equal(completed.watermarkAdvanced, true);
  assert.equal(completed.accepted, 1);
  assert.equal(completed.rejected, 1);
  assert.equal(quarantinedOnly.bills.has(failedId), false);
  assert.equal(quarantinedOnly.bills.has(congressBillProviderId(congress, 'HR', '12')), true);
  assert.ok(quarantinedOnly.checkpoint?.watermark);
  assert.equal(quarantinedOnly.checkpoint?.metadata?.resumeAfter, undefined);

  const onlyFailures = createMemoryStore();
  const walked = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: onlyFailures,
    fetchImpl: catalogFetch(congress, [listBill(congress, 'S', '11')], { poison }),
  });

  assert.equal(walked.outcome, 'complete');
  assert.equal(walked.watermarkAdvanced, true);
  assert.equal(walked.accepted, 0);
  assert.equal(walked.rejected, 1);
  assert.equal(onlyFailures.bills.size, 0);
  assert.ok(onlyFailures.checkpoint?.watermark);
  assert.equal(onlyFailures.checkpoint?.metadata?.resumeAfter, undefined);

  const limitedStore = createMemoryStore();
  const limited = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: limitedStore,
    fetchImpl: catalogFetch(congress, [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11')], {
      poison: { type: 's', number: '11', mode: '429' },
    }),
  });
  assert.equal(limited.outcome, 'successful-with-backlog');
  assert.equal(limited.watermarkAdvanced, false);
  assert.equal(limitedStore.checkpoint?.watermark, null);
  assert.equal(limitedStore.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '10'));

  const timedOutStore = createMemoryStore();
  const timedOut = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: timedOutStore,
    fetchImpl: catalogFetch(congress, [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11')], {
      poison: { type: 's', number: '11', mode: 'timeout' },
    }),
  });
  assert.equal(timedOut.outcome, 'successful-with-backlog');
  assert.equal(timedOut.watermarkAdvanced, false);
  assert.equal(timedOutStore.checkpoint?.watermark, null);
  assert.equal(timedOutStore.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '10'));
});

test('resumes federal bill detail work after the persisted in-window cursor', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const bills = [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11'), listBill(congress, 'HR', '12')];
  const store = createMemoryStore();
  const first = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    detailBudget: 1,
    fetchImpl: currentCongressFixture(congress, bills),
  });

  assert.equal(first.outcome, 'successful-with-backlog');
  assert.equal(first.watermarkAdvanced, false);
  assert.equal(first.accepted, 1);
  assert.equal(store.checkpoint?.watermark, null);
  assert.equal(store.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '10'));

  const requested: string[] = [];
  const second = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    detailBudget: 1,
    fetchImpl: createRouter([
      (url) => {
        if (url.pathname === `/v3/bill/${congress}` && !url.searchParams.get('offset')) {
          return jsonResponse({ bills, pagination: { count: bills.length, next: null } });
        }
        return undefined;
      },
      (url) => {
        const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
        if (!detail) return undefined;
        requested.push(`${detail[2]}-${detail[3]}`);
        return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
      },
      (url) => {
        if (url.pathname.endsWith('/actions')) {
          return jsonResponse(actionsPayload([{
            actionDate: '2025-01-03',
            text: 'Introduced in Senate',
            type: 'IntroReferral',
            sourceSystem: { name: 'Senate' },
          }]));
        }
        return undefined;
      },
    ]),
  });

  assert.deepEqual(requested, ['s-11']);
  assert.equal(second.outcome, 'successful-with-backlog');
  assert.equal(second.accepted, 1);
  assert.equal(second.watermarkAdvanced, false);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'S', '11')), true);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'HR', '12')), false);
  assert.equal(store.checkpoint?.watermark, null);
  assert.equal(store.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'S', '11'));
});

test('does not advance the date watermark when a later bill is rate-limited or times out', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const limitedStore = createMemoryStore();

  const limited = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: limitedStore,
    fetchImpl: createRouter([
      (url) => {
        if (url.pathname === `/v3/bill/${congress}`) {
          return jsonResponse({
            bills: [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11')],
            pagination: { count: 2, next: null },
          });
        }
        return undefined;
      },
      (url) => {
        const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
        if (!detail) return undefined;
        if (detail[3] === '11') return new Response('slow down', { status: 429 });
        return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
      },
      (url) => {
        if (url.pathname.endsWith('/actions')) {
          return jsonResponse(actionsPayload([{
            actionDate: '2025-01-03',
            text: 'Introduced in House',
            type: 'IntroReferral',
            sourceSystem: { name: 'House floor actions' },
          }]));
        }
        return undefined;
      },
    ]),
  });

  assert.equal(limited.outcome, 'successful-with-backlog');
  assert.equal(limited.watermarkAdvanced, false);
  assert.equal(limited.accepted, 1);
  assert.equal(limitedStore.checkpoint?.watermark, null);
  assert.equal(limitedStore.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '10'));
  assert.ok(limited.warnings.some((warning) => warning.includes('429')));

  const timedOutStore = createMemoryStore();
  const timedOut = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: timedOutStore,
    fetchImpl: createRouter([
      (url) => {
        if (url.pathname === `/v3/bill/${congress}`) {
          return jsonResponse({
            bills: [listBill(congress, 'HR', '10'), listBill(congress, 'S', '11')],
            pagination: { count: 2, next: null },
          });
        }
        return undefined;
      },
      (url) => {
        const detail = /^\/v3\/bill\/(\d+)\/([a-z]+)\/(\d+)$/.exec(url.pathname);
        if (!detail) return undefined;
        if (detail[3] === '11') {
          const error = new Error('The operation was aborted due to timeout');
          error.name = 'TimeoutError';
          throw error;
        }
        return jsonResponse(detailPayload(Number(detail[1]), detail[2].toUpperCase(), detail[3]));
      },
      (url) => {
        if (url.pathname.endsWith('/actions')) {
          return jsonResponse(actionsPayload([{
            actionDate: '2025-01-03',
            text: 'Introduced in House',
            type: 'IntroReferral',
            sourceSystem: { name: 'House floor actions' },
          }]));
        }
        return undefined;
      },
    ]),
  });

  assert.equal(timedOut.outcome, 'successful-with-backlog');
  assert.equal(timedOut.watermarkAdvanced, false);
  assert.equal(timedOut.accepted, 1);
  assert.equal(timedOutStore.checkpoint?.watermark, null);
  assert.equal(timedOutStore.checkpoint?.metadata?.resumeAfter, congressBillProviderId(congress, 'HR', '10'));
  assert.ok(timedOut.warnings.some((warning) => /timed out/i.test(warning)));
});

test('advances the date watermark and clears the resume cursor when the rest of the window is persisted', async () => {
  const now = new Date('2025-06-15T12:00:00.000Z');
  const congress = currentCongressForDate(now);
  const firstId = congressBillProviderId(congress, 'HR', '10');
  const store = createMemoryStore({
    checkpoint: {
      watermark: null,
      lastSuccessAt: new Date('2025-06-14T00:00:00Z'),
      metadata: { resumeAfter: firstId },
    },
  });

  const result = await syncCongressBills({
    now,
    apiKey: SECRET_KEY,
    persist: store,
    fetchImpl: currentCongressFixture(congress, [
      listBill(congress, 'HR', '10'),
      listBill(congress, 'S', '11'),
    ]),
  });

  assert.equal(result.outcome, 'complete');
  assert.equal(result.watermarkAdvanced, true);
  assert.equal(result.accepted, 1);
  assert.equal(store.bills.has(firstId), false);
  assert.equal(store.bills.has(congressBillProviderId(congress, 'S', '11')), true);
  assert.ok(store.checkpoint?.watermark);
  assert.equal(store.checkpoint?.metadata?.resumeAfter, undefined);
});
