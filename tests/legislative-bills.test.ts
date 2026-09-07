import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareLegislativeLifecycle,
  currentCongressForDate,
  formatLegislativeSyncFreshness,
  LEGISLATIVE_LIFECYCLE_LABELS,
  LEGISLATIVE_LIFECYCLE_STAGES,
  parseLegislativePage,
  parseLegislativePageSize,
  DEFAULT_LEGISLATIVE_PAGE_SIZE,
  MAX_LEGISLATIVE_PAGE_SIZE,
} from '../lib/legislative-bills';
import {
  isStatePageCode,
  isStatePageSlug,
  STATE_NAMES,
  STATE_PAGE_CODES,
  STATE_PAGE_SLUGS,
  stateCodeFromPageSlug,
  stateHeading,
  stateName,
  statePageSlug,
} from '../lib/us-states';

const TERRITORY_AND_DC_CODES = ['DC', 'AS', 'GU', 'MP', 'PR', 'VI'] as const;

test('round-trips all 50 state names, codes, and page slugs', () => {
  assert.equal(STATE_PAGE_CODES.length, 50);
  assert.equal(new Set(STATE_PAGE_CODES).size, 50);
  assert.equal(new Set(Object.values(STATE_PAGE_SLUGS)).size, 50);

  for (const code of STATE_PAGE_CODES) {
    const name = STATE_NAMES[code];
    const slug = statePageSlug(code);

    assert.ok(name, `missing name for ${code}`);
    assert.ok(slug, `missing slug for ${code}`);
    assert.match(slug, /^[a-z]+(?:-[a-z]+)*$/);
    assert.equal(isStatePageCode(code), true);
    assert.equal(isStatePageSlug(slug), true);
    assert.equal(stateCodeFromPageSlug(slug), code);
    assert.equal(statePageSlug(stateCodeFromPageSlug(slug) ?? ''), slug);
    assert.equal(stateName(code), name);
    assert.equal(stateHeading(code), `${name} (${code})`);
  }
});

test('excludes DC and territories from valid state-page slugs without regressing roster labels', () => {
  for (const code of TERRITORY_AND_DC_CODES) {
    const name = STATE_NAMES[code];
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    assert.ok(name);
    assert.equal(isStatePageCode(code), false);
    assert.equal(statePageSlug(code), null);
    assert.equal(isStatePageSlug(slug), false);
    assert.equal(stateCodeFromPageSlug(slug), null);
    assert.equal(stateName(code), name);
    assert.equal(stateHeading(code), `${name} (${code})`);
  }

  assert.equal(stateCodeFromPageSlug('district-of-columbia'), null);
  assert.equal(stateCodeFromPageSlug('puerto-rico'), null);
  assert.equal(stateCodeFromPageSlug('american-samoa'), null);
  assert.equal(stateCodeFromPageSlug('guam'), null);
  assert.equal(stateCodeFromPageSlug('northern-mariana-islands'), null);
  assert.equal(stateCodeFromPageSlug('u-s-virgin-islands'), null);
  assert.equal(isStatePageSlug('hawaii'), true);
  assert.equal(stateCodeFromPageSlug('hawaii'), 'HI');
});

test('labels and sorts the closed lifecycle vocabulary', () => {
  assert.deepEqual([...LEGISLATIVE_LIFECYCLE_STAGES], [
    'introduced',
    'committee',
    'floor',
    'cross_chamber',
    'enrolled',
    'executive',
    'law',
    'vetoed',
    'failed',
    'other',
  ]);

  assert.equal(LEGISLATIVE_LIFECYCLE_LABELS.introduced, 'Introduced');
  assert.equal(LEGISLATIVE_LIFECYCLE_LABELS.committee, 'In committee');
  assert.equal(LEGISLATIVE_LIFECYCLE_LABELS.cross_chamber, 'Other chamber');
  assert.equal(LEGISLATIVE_LIFECYCLE_LABELS.law, 'Became law');

  const sorted = [...LEGISLATIVE_LIFECYCLE_STAGES].reverse().sort(compareLegislativeLifecycle);
  assert.deepEqual(sorted, [...LEGISLATIVE_LIFECYCLE_STAGES]);
  assert.ok(compareLegislativeLifecycle('introduced', 'committee') < 0);
  assert.ok(compareLegislativeLifecycle('failed', 'floor') > 0);
});

test('parses positive page and page-size values within a fixed maximum', () => {
  assert.equal(parseLegislativePage(undefined), 1);
  assert.equal(parseLegislativePage(null), 1);
  assert.equal(parseLegislativePage(''), 1);
  assert.equal(parseLegislativePage('0'), 1);
  assert.equal(parseLegislativePage('-2'), 1);
  assert.equal(parseLegislativePage('abc'), 1);
  assert.equal(parseLegislativePage('2.5'), 1);
  assert.equal(parseLegislativePage('3'), 3);
  assert.equal(parseLegislativePage(4), 4);

  assert.equal(parseLegislativePageSize(undefined), DEFAULT_LEGISLATIVE_PAGE_SIZE);
  assert.equal(parseLegislativePageSize('0'), DEFAULT_LEGISLATIVE_PAGE_SIZE);
  assert.equal(parseLegislativePageSize('-10'), DEFAULT_LEGISLATIVE_PAGE_SIZE);
  assert.equal(parseLegislativePageSize('12'), 12);
  assert.equal(parseLegislativePageSize(String(MAX_LEGISLATIVE_PAGE_SIZE + 25)), MAX_LEGISLATIVE_PAGE_SIZE);
  assert.equal(parseLegislativePageSize(MAX_LEGISLATIVE_PAGE_SIZE), MAX_LEGISLATIVE_PAGE_SIZE);
});

test('uses the January 3 boundary to calculate the current Congress', () => {
  assert.equal(currentCongressForDate(new Date('2023-01-02T23:59:59.999Z')), 117);
  assert.equal(currentCongressForDate(new Date('2023-01-03T00:00:00.000Z')), 118);
  assert.equal(currentCongressForDate(new Date('2024-06-15T12:00:00.000Z')), 118);
  assert.equal(currentCongressForDate(new Date('2025-01-02T23:59:59.999Z')), 118);
  assert.equal(currentCongressForDate(new Date('2025-01-03T00:00:00.000Z')), 119);
  assert.equal(currentCongressForDate(new Date('2026-12-31T23:59:59.999Z')), 119);
  assert.equal(currentCongressForDate(new Date('2027-01-02T23:59:59.999Z')), 119);
  assert.equal(currentCongressForDate(new Date('2027-01-03T00:00:00.000Z')), 120);
});

test('formats freshness from a successful sync timestamp', () => {
  assert.equal(formatLegislativeSyncFreshness({ lastSuccessfulSyncAt: null }), 'Not yet synced');
  assert.equal(formatLegislativeSyncFreshness({
    lastSuccessfulSyncAt: new Date('2026-09-07T15:00:00.000Z'),
    now: new Date('2026-09-07T18:00:00.000Z'),
  }), 'Updated today');
  assert.equal(formatLegislativeSyncFreshness({
    lastSuccessfulSyncAt: new Date('2026-01-03T00:00:00.000Z'),
    now: new Date('2026-09-07T00:00:00.000Z'),
  }), 'Updated January 3, 2026');
});
