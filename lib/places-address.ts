export type PlacesAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

function componentText(components: PlacesAddressComponent[], type: string, useShort = false) {
  const match = components.find((component) => component.types?.includes(type));
  if (!match) return '';

  const text = useShort
    ? match.shortText || match.longText
    : match.longText || match.shortText;

  return text?.trim() ?? '';
}

export function formatUsStreetFromComponents(components: PlacesAddressComponent[]): string | null {
  const streetNumber = componentText(components, 'street_number');
  const route = componentText(components, 'route');
  const subpremise = componentText(components, 'subpremise');
  const city = componentText(components, 'locality')
    || componentText(components, 'sublocality_level_1')
    || componentText(components, 'sublocality')
    || componentText(components, 'postal_town');
  const state = componentText(components, 'administrative_area_level_1', true).toUpperCase();
  const zip = componentText(components, 'postal_code');
  const zipSuffix = componentText(components, 'postal_code_suffix');

  if (!streetNumber || !route || !city || !/^[A-Z]{2}$/.test(state) || !zip) return null;

  const street = subpremise ? `${streetNumber} ${route} #${subpremise}` : `${streetNumber} ${route}`;
  const postal = zipSuffix ? `${zip}-${zipSuffix}` : zip;
  return `${street}, ${city}, ${state} ${postal}`;
}

export function stripCountrySuffix(value: string) {
  return value
    .trim()
    .replace(/,+\s*(USA|United States|United States of America)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPlaceStreetAddress(
  components: PlacesAddressComponent[] | undefined,
  formattedAddress: string | undefined,
) {
  const fromComponents = components?.length ? formatUsStreetFromComponents(components) : null;
  if (fromComponents) return fromComponents;

  const stripped = formattedAddress ? stripCountrySuffix(formattedAddress) : '';
  return stripped || null;
}

export function mergeSuggestionWithPlace(suggestion: PlaceSuggestion, placeAddress: string | null) {
  const suggestedLine = stripCountrySuffix(
    [suggestion.primaryText, suggestion.secondaryText].filter(Boolean).join(', '),
  );
  const place = placeAddress ? stripCountrySuffix(placeAddress) : '';

  if (place && /^\d/.test(place)) return place;

  const streetNumber = suggestion.primaryText.match(/^(\d+[a-z]?(?:[-/]\d+[a-z]?)?)\b/i)?.[1];
  if (place && streetNumber && !/^\d/.test(place)) {
    return `${streetNumber} ${place}`.replace(/\s+/g, ' ').trim();
  }

  return place || suggestedLine;
}

export const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,256}$/;

export function normalizePlaceId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const placeId = value.trim().replace(/^places\//, '');
  return PLACE_ID_PATTERN.test(placeId) ? placeId : null;
}
