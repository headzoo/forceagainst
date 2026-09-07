export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
};

export const STATE_PAGE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export type StatePageCode = typeof STATE_PAGE_CODES[number];

const STATE_PAGE_CODE_SET = new Set<string>(STATE_PAGE_CODES);

function toStatePageSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const STATE_PAGE_SLUGS = Object.fromEntries(
  STATE_PAGE_CODES.map((code) => [code, toStatePageSlug(STATE_NAMES[code])]),
) as Record<StatePageCode, string>;

const STATE_PAGE_SLUG_TO_CODE = new Map(
  STATE_PAGE_CODES.map((code) => [STATE_PAGE_SLUGS[code], code]),
);

export function stateHeading(state: string) {
  return STATE_NAMES[state] ? `${STATE_NAMES[state]} (${state})` : state;
}

export function stateName(state: string) {
  return STATE_NAMES[state] ?? state;
}

export function isStatePageCode(value: string): value is StatePageCode {
  return STATE_PAGE_CODE_SET.has(value);
}

export function isStatePageSlug(value: string) {
  return STATE_PAGE_SLUG_TO_CODE.has(value);
}

export function statePageSlug(code: string) {
  if (!isStatePageCode(code)) return null;
  return STATE_PAGE_SLUGS[code];
}

export function stateCodeFromPageSlug(slug: string) {
  return STATE_PAGE_SLUG_TO_CODE.get(slug) ?? null;
}
