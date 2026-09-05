const CIVIC_DIVISIONS_URL = 'https://www.googleapis.com/civicinfo/v2/divisionsByAddress';
const REQUEST_TIMEOUT_MS = 5_000;
export const MAX_ADDRESS_LENGTH = 240;

const SENATE_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

type CivicDivision = {
  alsoKnownAs?: unknown;
};

type CivicDivisionsResponse = {
  divisions?: Record<string, CivicDivision>;
};

export type CivicDistrict = {
  state: string;
  district: number;
};

export type CivicErrorCode = 'configuration' | 'not_found' | 'unavailable';

export class CivicDistrictError extends Error {
  constructor(
    public readonly code: CivicErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

const PO_BOX_PATTERN = /\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box|pobox)\b/i;
const STATE_ZIP_SUFFIX = /(?:,\s*|\s+)([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/;

const VALID_STATE_CODES = new Set([
  ...SENATE_STATES,
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

export function normalizeStreetAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const address = value.trim().replace(/\s+/g, ' ');
  if (!address || address.length > MAX_ADDRESS_LENGTH) return null;
  if (/^\d{5}(?:-\d{4})?$/.test(address)) return null;
  if (PO_BOX_PATTERN.test(address)) return null;

  const stateZipMatch = STATE_ZIP_SUFFIX.exec(address);
  if (!stateZipMatch) return null;

  const state = stateZipMatch[1].toUpperCase();
  if (!VALID_STATE_CODES.has(state)) return null;

  const streetAndCity = address.slice(0, stateZipMatch.index).trim().replace(/,\s*$/, '');
  if (!streetAndCity || !/,/.test(streetAndCity)) return null;

  // Require a street number and a street name. Geocoding a city, state, or ZIP
  // is deliberately out of scope for this private address lookup.
  if (!/^\d+[a-z]?(?:[-/]\d+[a-z]?)?\s+/i.test(streetAndCity) || !/[a-z]/i.test(streetAndCity.replace(/^\d+[a-z]?(?:[-/]\d+[a-z]?)?\s+/i, ''))) {
    return null;
  }

  const [streetPart, ...cityParts] = streetAndCity.split(',').map((part) => part.trim());
  if (!streetPart || cityParts.length === 0 || cityParts.every((part) => !part || !/[a-z]/i.test(part))) {
    return null;
  }

  return address;
}

function parseDistrictId(id: string): CivicDistrict | null {
  const match = /^ocd-division\/country:us\/state:([a-z]{2})\/cd:([^/]+)$/i.exec(id);
  if (!match) return null;

  const state = match[1].toUpperCase();
  const rawDistrict = match[2].toLowerCase();
  let district: number;

  if (rawDistrict === 'at-large' || rawDistrict === 'al') {
    district = 0;
  } else if (/^\d+$/.test(rawDistrict)) {
    district = Number(rawDistrict);
  } else {
    return null;
  }

  if (!Number.isSafeInteger(district) || district < 0) return null;
  return { state, district };
}

export function parseCivicDistrict(payload: unknown): CivicDistrict {
  if (!payload || typeof payload !== 'object') {
    throw new CivicDistrictError('not_found', 422);
  }

  const divisions = (payload as CivicDivisionsResponse).divisions;
  if (!divisions || typeof divisions !== 'object') {
    throw new CivicDistrictError('not_found', 422);
  }

  const matches = new Map<string, CivicDistrict>();
  for (const [id, division] of Object.entries(divisions)) {
    const ids = [id];
    if (Array.isArray(division?.alsoKnownAs)) {
      ids.push(...division.alsoKnownAs.filter((alias): alias is string => typeof alias === 'string'));
    }

    const candidates = ids.map(parseDistrictId).filter((district): district is CivicDistrict => district !== null);
    // Civic sometimes includes cd:1 as an alias for a canonical at-large
    // cd:0 division. Prefer its explicit at-large form, which is the same
    // district convention used by government-sync.
    const district = candidates.find((candidate) => candidate.district === 0) ?? candidates[0];
    if (district) matches.set(`${district.state}:${district.district}`, district);
  }

  if (matches.size !== 1) throw new CivicDistrictError('not_found', 422);
  return [...matches.values()][0];
}

export function classifyCivicResponse(status: number): CivicDistrictError {
  if (status === 400 || status === 404) return new CivicDistrictError('not_found', 422);
  if (status === 401 || status === 403) return new CivicDistrictError('configuration', 503);
  return new CivicDistrictError('unavailable', 503);
}

export function districtLabel({ state, district }: CivicDistrict): string {
  return `${state}-${district === 0 ? 'AL' : district}`;
}

export function senateAppliesToState(state: string): boolean {
  return SENATE_STATES.has(state);
}

export async function getCivicDistrict(address: string, fetchImpl: typeof fetch = fetch): Promise<CivicDistrict> {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) throw new CivicDistrictError('configuration', 503);

  const url = new URL(CIVIC_DIVISIONS_URL);
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new CivicDistrictError('unavailable', 503);
  }

  if (!response.ok) throw classifyCivicResponse(response.status);

  try {
    return parseCivicDistrict(await response.json());
  } catch (error) {
    if (error instanceof CivicDistrictError) throw error;
    throw new CivicDistrictError('unavailable', 503);
  }
}
