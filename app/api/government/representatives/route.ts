import {
  CivicDistrictError,
  districtLabel,
  getCivicDistrict,
  normalizeStreetAddress,
  senateAppliesToState,
} from '@/lib/civic-district';
import { getCongressMembersByJurisdiction } from '@/lib/db';
import { STATE_NAMES } from '@/lib/us-states';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function response(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init?.headers },
  });
}

async function representativesForJurisdiction(jurisdiction: { state: string; district: number }) {
  const roster = await getCongressMembersByJurisdiction(jurisdiction.state, jurisdiction.district);
  const senateApplies = senateAppliesToState(jurisdiction.state);

  return {
    jurisdiction,
    districtLabel: districtLabel(jurisdiction),
    representative: roster.representative,
    senators: senateApplies ? roster.senators : [],
    senateApplies,
    houseVacant: roster.representative === null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state')?.toUpperCase() ?? '';
  const rawDistrict = url.searchParams.get('district') ?? '';
  const district = /^\d{1,2}$/.test(rawDistrict) ? Number(rawDistrict) : Number.NaN;

  if (!(state in STATE_NAMES) || !Number.isSafeInteger(district) || district < 0 || district > 99) {
    return response({ error: 'Provide a valid congressional jurisdiction.' }, { status: 400 });
  }

  try {
    return response(await representativesForJurisdiction({ state, district }));
  } catch {
    return response({ error: 'Representative lookup is temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const address = normalizeStreetAddress(
    body && typeof body === 'object' && 'address' in body ? body.address : null,
  );

  if (!address) {
    return response({ error: 'Provide a complete street address.' }, { status: 400 });
  }

  try {
    const jurisdiction = await getCivicDistrict(address);
    return response(await representativesForJurisdiction(jurisdiction));
  } catch (error) {
    if (error instanceof CivicDistrictError) {
      return response(
        { error: error.code === 'not_found' ? 'That address could not be matched to a congressional district.' : 'Representative lookup is temporarily unavailable.' },
        { status: error.status },
      );
    }

    return response({ error: 'Representative lookup is temporarily unavailable.' }, { status: 500 });
  }
}
