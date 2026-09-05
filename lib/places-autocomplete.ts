import {
  formatPlaceStreetAddress,
  normalizePlaceId,
  type PlaceSuggestion,
  type PlacesAddressComponent,
} from '@/lib/places-address';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const REQUEST_TIMEOUT_MS = 5_000;

function getBrowserPlacesKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || '';
}

export function hasPlacesAutocomplete() {
  return Boolean(getBrowserPlacesKey());
}

export function createPlacesSessionToken() {
  return crypto.randomUUID();
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
};

type PlaceDetailsResponse = {
  addressComponents?: PlacesAddressComponent[];
  formattedAddress?: string;
};

export async function fetchPlaceSuggestions(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const apiKey = getBrowserPlacesKey();
  if (!apiKey) return [];

  const response = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input,
      languageCode: 'en',
      includedRegionCodes: ['us', 'pr', 'gu', 'vi', 'as', 'mp'],
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
      includeQueryPredictions: false,
      sessionToken,
    }),
    cache: 'no-store',
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) return [];

  const body = await response.json() as AutocompleteResponse;
  const suggestions: PlaceSuggestion[] = [];

  for (const suggestion of body.suggestions ?? []) {
    const placeId = normalizePlaceId(suggestion.placePrediction?.placeId);
    const primaryText = suggestion.placePrediction?.structuredFormat?.mainText?.text?.trim()
      || suggestion.placePrediction?.text?.text?.trim()
      || '';
    if (!placeId || !primaryText) continue;

    suggestions.push({
      placeId,
      primaryText,
      secondaryText: suggestion.placePrediction?.structuredFormat?.secondaryText?.text?.trim() ?? '',
    });
  }

  return suggestions;
}

export async function fetchPlaceStreetAddress(
  placeId: string,
  sessionToken: string,
  signal?: AbortSignal,
) {
  const apiKey = getBrowserPlacesKey();
  const normalizedPlaceId = normalizePlaceId(placeId);
  if (!apiKey || !normalizedPlaceId) return null;

  const params = new URLSearchParams({ sessionToken, languageCode: 'en', regionCode: 'US' });
  const response = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(normalizedPlaceId)}?${params}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'addressComponents,formattedAddress',
    },
    cache: 'no-store',
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const body = await response.json() as PlaceDetailsResponse;
  return formatPlaceStreetAddress(body.addressComponents, body.formattedAddress);
}
