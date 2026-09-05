import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchCurrentCongressMembers,
  normalizeCongressMember,
  normalizeDistrict,
  persistCongressRosterAtomically,
  staleBioguideIds,
} from '../lib/government-sync';

function member(id: string, overrides: Record<string, unknown> = {}) {
  return {
    bioguideId: id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    directOrderName: 'Ada Lovelace',
    partyName: 'Independent',
    state: 'Alaska',
    district: 0,
    terms: [{ chamber: 'House', stateCode: 'AK', district: 0 }],
    ...overrides,
  };
}

function response(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('fetches every Congress.gov pagination page before accepting roster', async () => {
  const pages = new Map([
    ['https://api.congress.gov/v3/member?currentMember=true&format=json&limit=250&api_key=test', { members: Array.from({ length: 250 }, (_, index) => member(`A${index}`)), pagination: { count: 500, next: 'https://api.congress.gov/v3/member?currentMember=true&format=json&limit=250&offset=250' } }],
    ['https://api.congress.gov/v3/member?currentMember=true&format=json&limit=250&offset=250&api_key=test', { members: Array.from({ length: 250 }, (_, index) => member(`B${index}`)), pagination: { count: 500, next: null } }],
  ]);
  const result = await fetchCurrentCongressMembers(async (url) => response(pages.get(String(url))), 'test');
  assert.equal(result.length, 500);
  assert.equal(result.at(-1)?.bioguideId, 'B249');
});

test('parses production-shaped Congress.gov terms.item payloads', async () => {
  const productionMember = (id: string) => ({
    ...member(id),
    terms: {
      item: [{
        chamber: 'House of Representatives',
        memberType: 'Representative',
        stateCode: 'AK',
        district: 0,
        startYear: 2025,
        endYear: 2027,
      }],
    },
  });
  const result = await fetchCurrentCongressMembers(
    async () => response({
      members: Array.from({ length: 500 }, (_, index) => productionMember(`P${index}`)),
      pagination: { count: 500, next: null },
    }),
    'test',
  );
  const normalized = normalizeCongressMember(result[0]);
  assert.equal(normalized.chamber, 'house');
  assert.equal(normalized.state, 'AK');
  assert.equal(normalized.district, 0);
});

test('rejects incomplete Congress.gov pagination before persistence can occur', async () => {
  await assert.rejects(
    fetchCurrentCongressMembers(async () => response({ members: Array.from({ length: 250 }, (_, index) => member(`A${index}`)), pagination: { count: 500, next: null } }), 'test'),
    /ended before the complete roster/,
  );
});

test('normalizes at-large districts and territory titles', () => {
  assert.equal(normalizeDistrict('At-Large'), 0);
  const delegate = normalizeCongressMember(member('D000001', { state: 'District of Columbia', district: 'At-Large', terms: [{ chamber: 'House', stateCode: 'DC', district: 'At-Large' }] }));
  const residentCommissioner = normalizeCongressMember(member('P000001', { state: 'Puerto Rico', district: 0, terms: [{ chamber: 'House', stateCode: 'PR', district: 0 }] }));
  assert.equal(delegate.district, 0);
  assert.equal(delegate.displayTitle, 'Delegate');
  assert.equal(residentCommissioner.displayTitle, 'Resident Commissioner');
});

test('strips HTML from official image attribution', () => {
  const normalized = normalizeCongressMember(member('A000001', {
    depiction: {
      imageUrl: 'https://example.test/ada.jpg',
      attribution: '<a href="http://www.senate.gov/artandhistory/history/common/generic/Photo_Collection_of_the_Senate_Historical_Office.htm">U.S. Senate Historical Office</a>',
    },
  }));
  assert.equal(normalized.officialImageAttribution, 'U.S. Senate Historical Office');
});

test('uses enrichment only for an authoritative member and preserves Congress fallbacks', () => {
  const normalized = normalizeCongressMember(member('A000001'), {
    id: { bioguide: 'A000001' },
    name: { first: 'Ada', last: 'Byron', official_full: 'Ada Byron' },
    terms: [{ type: 'rep', state: 'AK', district: 'At-Large', party: 'Example', contact: 'https://example.test/contact' }],
  });
  assert.equal(normalized.officialFullName, 'Ada Byron');
  assert.equal(normalized.contactFormUrl, 'https://example.test/contact');
  assert.equal(normalized.congressGovProfileUrl, null);
});

test('calculates stale IDs and rejects duplicate authoritative IDs', async () => {
  assert.deepEqual(staleBioguideIds(['A', 'B', 'C'], ['B', 'C', 'D']), ['A']);
  await assert.rejects(
    fetchCurrentCongressMembers(async () => response({
      members: Array.from({ length: 500 }, (_, index) => member(index === 499 ? 'A0' : `A${index}`)),
      pagination: { count: 500, next: null },
    }), 'test'),
    /duplicate bioguide IDs/,
  );
});

test('does not change the roster when an atomic persistence batch fails', async () => {
  const roster = new Map([
    ['OLD', { isCurrent: true }],
    ['A000001', { isCurrent: true }],
  ]);
  const originalRoster = structuredClone([...roster.entries()]);
  const normalized = normalizeCongressMember(member('A000001'));
  type Statement = (pending: Map<string, { isCurrent: boolean }>) => void;

  await assert.rejects(
    persistCongressRosterAtomically<Statement, Statement, never>([normalized], {
      upsert(row) {
        return (pending) => {
          pending.set(row.bioguideId, { isCurrent: true });
        };
      },
      deactivateNotIn(ids) {
        return (pending) => {
          for (const [id, row] of pending) {
            if (!ids.includes(id) && row.isCurrent) row.isCurrent = false;
          }
        };
      },
      async batch(statements) {
        const pending = structuredClone(roster);
        statements[0](pending);
        throw new Error('simulated batch failure');
      },
    }),
    /simulated batch failure/,
  );
  assert.deepEqual([...roster.entries()], originalRoster);
});
