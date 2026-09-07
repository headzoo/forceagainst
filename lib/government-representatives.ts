import type { PublicCongressMember } from '@/lib/db';

export type RepresentativesResult = {
  jurisdiction: { state: string; district: number };
  districtLabel: string;
  representative: PublicCongressMember | null;
  senators: PublicCongressMember[];
  senateApplies: boolean;
  houseVacant: boolean;
};

export function isPublicCongressMember(value: unknown): value is PublicCongressMember {
  if (!value || typeof value !== 'object') return false;
  const member = value as Record<string, unknown>;
  return typeof member.bioguideId === 'string'
    && /^[A-Z]\d{6}$/i.test(member.bioguideId)
    && typeof member.officialFullName === 'string'
    && typeof member.displayTitle === 'string'
    && typeof member.party === 'string'
    && typeof member.state === 'string';
}

export function isRepresentativesResult(value: unknown): value is RepresentativesResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as Record<string, unknown>;
  const jurisdiction = result.jurisdiction;
  if (!jurisdiction || typeof jurisdiction !== 'object') return false;

  const { state, district } = jurisdiction as Record<string, unknown>;
  if (typeof state !== 'string' || !/^[A-Z]{2}$/.test(state)) return false;
  if (typeof district !== 'number' || !Number.isSafeInteger(district) || district < 0) return false;
  if (typeof result.districtLabel !== 'string') return false;
  if (typeof result.senateApplies !== 'boolean' || typeof result.houseVacant !== 'boolean') return false;
  if (!Array.isArray(result.senators) || !result.senators.every(isPublicCongressMember)) return false;
  if (result.representative !== null && !isPublicCongressMember(result.representative)) return false;

  return true;
}

