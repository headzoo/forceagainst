export const LEGISLATIVE_SOURCES = ['legiscan', 'congress'] as const;
export type LegislativeSource = (typeof LEGISLATIVE_SOURCES)[number];

export const LEGISLATIVE_LIFECYCLE_STAGES = [
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
] as const;

export type LegislativeLifecycleStage = (typeof LEGISLATIVE_LIFECYCLE_STAGES)[number];

export const LEGISLATIVE_LIFECYCLE_LABELS: Record<LegislativeLifecycleStage, string> = {
  introduced: 'Introduced',
  committee: 'In committee',
  floor: 'Floor',
  cross_chamber: 'Other chamber',
  enrolled: 'Enrolled',
  executive: 'Executive',
  law: 'Became law',
  vetoed: 'Vetoed',
  failed: 'Failed',
  other: 'Other',
};

export const LEGISLATIVE_LIFECYCLE_SORT_ORDER: Record<LegislativeLifecycleStage, number> = {
  introduced: 0,
  committee: 1,
  floor: 2,
  cross_chamber: 3,
  enrolled: 4,
  executive: 5,
  law: 6,
  vetoed: 7,
  failed: 8,
  other: 9,
};

export const FEDERAL_ORIGIN_CHAMBERS = ['house', 'senate'] as const;
export type FederalOriginChamber = (typeof FEDERAL_ORIGIN_CHAMBERS)[number];

export const DEFAULT_LEGISLATIVE_PAGE_SIZE = 20;
export const MAX_LEGISLATIVE_PAGE_SIZE = 50;
export const FEDERAL_LEGISLATION_SYNC_SCOPE = 'congress:bills';
export const FIRST_CONGRESS_YEAR = 1789;

export type LegislativeLifecycleCounts = Record<LegislativeLifecycleStage, number>;

export type LegislativeBillListItem = {
  id: number;
  source: LegislativeSource;
  providerBillId: string;
  jurisdiction: string;
  billNumber: string;
  billType: string | null;
  title: string;
  originChamber: string | null;
  latestActionBody: string | null;
  latestActionText: string | null;
  latestActionDate: Date | null;
  stage: LegislativeLifecycleStage;
  stageLabel: string;
  isActive: boolean;
  publicSourceUrl: string | null;
  sessionLabel: string;
  detailsPending: boolean;
};

export type LegislativeBillDirectoryResult = {
  items: LegislativeBillListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  lifecycleCounts: LegislativeLifecycleCounts;
  lastSuccessfulSyncAt: Date | null;
  sessionLabel: string | null;
  jurisdiction: string;
  originChamber?: FederalOriginChamber;
  congress?: number;
};

export type LegislativeFreshnessInput = {
  lastSuccessfulSyncAt: Date | null;
  now?: Date;
};

export function isLegislativeLifecycleStage(value: string): value is LegislativeLifecycleStage {
  return (LEGISLATIVE_LIFECYCLE_STAGES as readonly string[]).includes(value);
}

export function legislativeLifecycleLabel(stage: LegislativeLifecycleStage) {
  return LEGISLATIVE_LIFECYCLE_LABELS[stage];
}

export function compareLegislativeLifecycle(
  left: LegislativeLifecycleStage,
  right: LegislativeLifecycleStage,
) {
  return LEGISLATIVE_LIFECYCLE_SORT_ORDER[left] - LEGISLATIVE_LIFECYCLE_SORT_ORDER[right];
}

export function emptyLegislativeLifecycleCounts(): LegislativeLifecycleCounts {
  return {
    introduced: 0,
    committee: 0,
    floor: 0,
    cross_chamber: 0,
    enrolled: 0,
    executive: 0,
    law: 0,
    vetoed: 0,
    failed: 0,
    other: 0,
  };
}

export function parseLegislativePage(value: unknown, fallback = 1) {
  return parsePositiveInteger(value, fallback);
}

export function parseLegislativePageSize(
  value: unknown,
  fallback = DEFAULT_LEGISLATIVE_PAGE_SIZE,
  maximum = MAX_LEGISLATIVE_PAGE_SIZE,
) {
  return Math.min(parsePositiveInteger(value, fallback), maximum);
}

export function isFederalOriginChamber(value: string): value is FederalOriginChamber {
  return (FEDERAL_ORIGIN_CHAMBERS as readonly string[]).includes(value);
}

export function stateLegislationSyncScope(stateCode: string) {
  return `state:${stateCode.toUpperCase()}`;
}

export function currentCongressForDate(date: Date = new Date()) {
  const year = date.getUTCFullYear();
  const effectiveYear = date.getUTCMonth() === 0 && date.getUTCDate() < 3 ? year - 1 : year;
  return Math.max(1, Math.floor((effectiveYear - FIRST_CONGRESS_YEAR) / 2) + 1);
}

export function formatLegislativeSyncFreshness(input: LegislativeFreshnessInput) {
  if (!input.lastSuccessfulSyncAt) return 'Not yet synced';

  const now = input.now ?? new Date();
  if (sameUtcCalendarDay(input.lastSuccessfulSyncAt, now)) return 'Updated today';

  const formatted = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(input.lastSuccessfulSyncAt);

  return `Updated ${formatted}`;
}

function sameUtcCalendarDay(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate();
}

export function toLegislativeBillListItem(row: {
  id: number;
  source: LegislativeSource;
  providerBillId: string;
  jurisdiction: string;
  billNumber: string;
  billType: string | null;
  title: string;
  originChamber: string | null;
  latestActionBody: string | null;
  latestActionText: string | null;
  latestActionDate: Date | null;
  stage: LegislativeLifecycleStage;
  isActive: boolean;
  publicSourceUrl: string | null;
  sessionLabel: string;
  detailsPending: boolean;
}): LegislativeBillListItem {
  return {
    ...row,
    stageLabel: legislativeLifecycleLabel(row.stage),
  };
}

export function emptyLegislativeBillDirectoryResult(input: {
  page: number;
  pageSize: number;
  jurisdiction: string;
  originChamber?: FederalOriginChamber;
  congress?: number;
}): LegislativeBillDirectoryResult {
  return {
    items: [],
    page: input.page,
    pageSize: input.pageSize,
    total: 0,
    totalPages: 1,
    lifecycleCounts: emptyLegislativeLifecycleCounts(),
    lastSuccessfulSyncAt: null,
    sessionLabel: null,
    jurisdiction: input.jurisdiction,
    originChamber: input.originChamber,
    congress: input.congress,
  };
}

function parsePositiveInteger(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value.trim()) return parsed;
  }

  return fallback;
}
