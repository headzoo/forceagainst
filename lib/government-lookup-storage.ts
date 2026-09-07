import { isRepresentativesResult, type RepresentativesResult } from '@/lib/government-representatives';

export const GOVERNMENT_LOOKUP_STORAGE_KEY = 'forceAgainstSomething:governmentLookup';
const STORAGE_VERSION = 2;
const MAX_LOOKUP_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export type StoredGovernmentLookup = {
  version: 2;
  jurisdiction: { state: string; district: number };
  representativeId: string | null;
  senatorIds: string[];
  resolvedAt: string;
};

function isBioguideId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]\d{6}$/i.test(value);
}

function parseJurisdiction(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const { state, district } = value as Record<string, unknown>;
  if (typeof state !== 'string' || !/^[A-Z]{2}$/.test(state)) return null;
  if (typeof district !== 'number' || !Number.isSafeInteger(district) || district < 0 || district > 99) return null;
  return { state, district };
}

function fromResult(result: Record<string, unknown>, resolvedAt: string): StoredGovernmentLookup | null {
  const jurisdiction = parseJurisdiction(result.jurisdiction);
  if (!jurisdiction) return null;

  const representative = result.representative;
  const representativeId = representative && typeof representative === 'object'
    ? (representative as Record<string, unknown>).bioguideId
    : null;
  const senators = Array.isArray(result.senators) ? result.senators : [];
  const senatorIds = senators
    .map((senator) => senator && typeof senator === 'object' ? (senator as Record<string, unknown>).bioguideId : null)
    .filter(isBioguideId)
    .map((id) => id.toUpperCase());

  if (representativeId !== null && !isBioguideId(representativeId)) return null;

  return {
    version: STORAGE_VERSION,
    jurisdiction,
    representativeId: representativeId?.toUpperCase() ?? null,
    senatorIds,
    resolvedAt,
  };
}

export function parseStoredGovernmentLookup(value: unknown, now = Date.now()): StoredGovernmentLookup | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Record<string, unknown>;

  if (payload.version === STORAGE_VERSION) {
    const jurisdiction = parseJurisdiction(payload.jurisdiction);
    if (!jurisdiction) return null;
    if (payload.representativeId !== null && !isBioguideId(payload.representativeId)) return null;
    if (!Array.isArray(payload.senatorIds) || !payload.senatorIds.every(isBioguideId)) return null;
    if (typeof payload.resolvedAt !== 'string') return null;

    const resolvedAt = Date.parse(payload.resolvedAt);
    if (!Number.isFinite(resolvedAt) || resolvedAt > now + 60_000 || now - resolvedAt > MAX_LOOKUP_AGE_MS) return null;

    return {
      version: STORAGE_VERSION,
      jurisdiction,
      representativeId: payload.representativeId?.toUpperCase() ?? null,
      senatorIds: payload.senatorIds.map((id) => id.toUpperCase()),
      resolvedAt: new Date(resolvedAt).toISOString(),
    };
  }

  // Version 1 stored the visitor's street address alongside the public roster.
  // Migrate the useful jurisdiction and IDs while deliberately discarding the address.
  if (payload.result && typeof payload.result === 'object') {
    return fromResult(payload.result as Record<string, unknown>, new Date(now).toISOString());
  }

  return null;
}

export function readStoredGovernmentLookup(): StoredGovernmentLookup | null {
  try {
    const raw = window.localStorage.getItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
    if (!raw) return null;
    const stored = parseStoredGovernmentLookup(JSON.parse(raw) as unknown);
    if (!stored) {
      window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
      return null;
    }
    window.localStorage.setItem(GOVERNMENT_LOOKUP_STORAGE_KEY, JSON.stringify(stored));
    return stored;
  } catch {
    try {
      window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
    } catch {
      // Browser storage can be unavailable without preventing the lookup itself.
    }
    return null;
  }
}

export function writeStoredGovernmentLookup(result: RepresentativesResult) {
  const stored = fromResult(result as unknown as Record<string, unknown>, new Date().toISOString());
  if (!stored) return;
  try {
    window.localStorage.setItem(GOVERNMENT_LOOKUP_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Browser storage can be unavailable without preventing the lookup itself.
  }
}

export function clearStoredGovernmentLookup() {
  try {
    window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
  } catch {
    // Browser storage can be unavailable without preventing the lookup itself.
  }
}

export async function fetchStoredRepresentatives(stored: StoredGovernmentLookup): Promise<RepresentativesResult> {
  const params = new URLSearchParams({
    state: stored.jurisdiction.state,
    district: String(stored.jurisdiction.district),
  });
  const response = await fetch(`/api/government/representatives?${params}`, { cache: 'no-store' });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error('Representative lookup failed.');

  if (!isRepresentativesResult(body)) throw new Error('Representative lookup returned invalid data.');
  writeStoredGovernmentLookup(body);
  return body;
}
