'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { normalizeStreetAddress } from '@/lib/civic-district';
import type { PublicCongressMember } from '@/lib/db';
import {
  createPlacesSessionToken,
  fetchPlaceStreetAddress,
  fetchPlaceSuggestions,
  hasPlacesAutocomplete,
} from '@/lib/places-autocomplete';
import { mergeSuggestionWithPlace, type PlaceSuggestion } from '@/lib/places-address';
import { CongressMemberCard } from './congress-member-card';

const GOVERNMENT_LOOKUP_STORAGE_KEY = 'forceAgainstSomething:governmentLookup';

type RepresentativesResult = {
  jurisdiction: { state: string; district: number };
  districtLabel: string;
  representative: PublicCongressMember | null;
  senators: PublicCongressMember[];
  senateApplies: boolean;
  houseVacant: boolean;
};

type StoredGovernmentLookup = {
  address: string;
  result: RepresentativesResult;
};

function isPublicCongressMember(value: unknown): value is PublicCongressMember {
  if (!value || typeof value !== 'object') return false;
  const member = value as Record<string, unknown>;
  return typeof member.bioguideId === 'string'
    && typeof member.officialFullName === 'string'
    && typeof member.displayTitle === 'string'
    && typeof member.state === 'string';
}

function isRepresentativesResult(value: unknown): value is RepresentativesResult {
  if (!value || typeof value !== 'object') return false;

  const result = value as Record<string, unknown>;
  const jurisdiction = result.jurisdiction;
  if (!jurisdiction || typeof jurisdiction !== 'object') return false;

  const { state, district } = jurisdiction as Record<string, unknown>;
  if (typeof state !== 'string' || typeof district !== 'number' || !Number.isFinite(district)) return false;
  if (typeof result.districtLabel !== 'string') return false;
  if (typeof result.senateApplies !== 'boolean' || typeof result.houseVacant !== 'boolean') return false;
  if (!Array.isArray(result.senators) || !result.senators.every(isPublicCongressMember)) return false;
  if (result.representative !== null && !isPublicCongressMember(result.representative)) return false;

  return true;
}

function readStoredGovernmentLookup(): StoredGovernmentLookup | null {
  try {
    const raw = window.localStorage.getItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
      return null;
    }

    const payload = parsed as Record<string, unknown>;
    const address = normalizeStreetAddress(payload.address);
    if (!address || !isRepresentativesResult(payload.result)) {
      window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
      return null;
    }

    return { address, result: payload.result };
  } catch {
    try {
      window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
    } catch {
      // Ignore storage failures when browser storage is restricted.
    }
    return null;
  }
}

function writeStoredGovernmentLookup(address: string, result: RepresentativesResult) {
  try {
    window.localStorage.setItem(GOVERNMENT_LOOKUP_STORAGE_KEY, JSON.stringify({ address, result }));
  } catch {
    // Ignore storage failures so lookup still works when browser storage is restricted.
  }
}

function clearStoredGovernmentLookup() {
  try {
    window.localStorage.removeItem(GOVERNMENT_LOOKUP_STORAGE_KEY);
  } catch {
    // Ignore storage failures when browser storage is restricted.
  }
}

export function FindRepresentatives() {
  const listId = useId();
  const comboboxRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const filledAddressRef = useRef('');
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const requestIdRef = useRef(0);

  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RepresentativesResult | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [restored, setRestored] = useState(false);

  const placesEnabled = hasPlacesAutocomplete();
  const locked = status === 'success' && result !== null;
  const showSuggestions = placesEnabled && !locked && open && suggestions.length > 0;

  useEffect(() => {
    const stored = readStoredGovernmentLookup();
    if (stored) {
      filledAddressRef.current = stored.address;
      setAddress(stored.address);
      setResult(stored.result);
      setStatus('success');
      setError('');
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!placesEnabled || locked) return;

    function onPointerDown(event: PointerEvent) {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [placesEnabled, locked]);

  useEffect(() => {
    if (!placesEnabled || locked || !restored) return;

    const query = address.trim();
    if (query.length < 3 || query === filledAddressRef.current) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const nextSuggestions = await fetchPlaceSuggestions(query, sessionTokenRef.current, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(nextSuggestions);
        setOpen(nextSuggestions.length > 0);
        setActiveIndex(-1);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, placesEnabled, locked, restored]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setResolvingPlace(true);
    setOpen(false);
    setActiveIndex(-1);

    try {
      const formatted = mergeSuggestionWithPlace(
        suggestion,
        await fetchPlaceStreetAddress(suggestion.placeId, sessionTokenRef.current),
      );
      filledAddressRef.current = formatted;
      sessionTokenRef.current = createPlacesSessionToken();
      setAddress(formatted);
      setSuggestions([]);
    } catch {
      const formatted = mergeSuggestionWithPlace(suggestion, null);
      filledAddressRef.current = formatted;
      sessionTokenRef.current = createPlacesSessionToken();
      setAddress(formatted);
      setSuggestions([]);
    } finally {
      setResolvingPlace(false);
    }
  }

  function onAddressKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (event.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      void selectSuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function clearAddress() {
    clearStoredGovernmentLookup();
    requestIdRef.current += 1;
    filledAddressRef.current = '';
    sessionTokenRef.current = createPlacesSessionToken();
    setAddress('');
    setResult(null);
    setStatus('idle');
    setError('');
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setResolvingPlace(false);
    window.requestAnimationFrame(() => addressInputRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resolvingPlace || locked) return;
    const requestId = ++requestIdRef.current;

    setStatus('loading');
    setError('');
    setResult(null);
    setOpen(false);

    try {
      const response = await fetch('/api/government/representatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const body = await response.json().catch(() => null) as RepresentativesResult | { error?: string } | null;
      if (requestId !== requestIdRef.current) return;

      if (!response.ok || !body || 'error' in body) {
        setStatus('error');
        setError(body && 'error' in body && body.error ? body.error : 'Representative lookup is temporarily unavailable.');
        return;
      }

      const nextResult = body as RepresentativesResult;
      const savedAddress = normalizeStreetAddress(address) ?? address.trim();
      writeStoredGovernmentLookup(savedAddress, nextResult);
      filledAddressRef.current = savedAddress;
      setAddress(savedAddress);
      setResult(nextResult);
      setStatus('success');
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus('error');
      setError('Representative lookup is temporarily unavailable.');
    }
  }

  return (
    <section className="government-finder-panel" aria-labelledby="government-finder-heading">
      <p className="step">ADDRESS LOOKUP / 01</p>
      <h2 id="government-finder-heading">Find your<br />representatives.</h2>
      <p>
        Enter a complete U.S. street address with city, state, and ZIP. A ZIP code alone is not enough to determine your congressional district.
      </p>

      <form className="government-finder-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="government-address">
          Street address
          <div className="government-address-combobox" ref={comboboxRef}>
            <input
              id="government-address"
              ref={addressInputRef}
              name="address"
              type="text"
              role={placesEnabled && !locked ? 'combobox' : undefined}
              autoComplete={placesEnabled ? 'off' : 'street-address'}
              aria-autocomplete={placesEnabled && !locked ? 'list' : undefined}
              aria-controls={placesEnabled && !locked ? listId : undefined}
              aria-expanded={placesEnabled && !locked ? showSuggestions : undefined}
              aria-activedescendant={showSuggestions && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
              value={address}
              onChange={(event) => {
                filledAddressRef.current = '';
                setAddress(event.target.value);
                if (placesEnabled) setOpen(true);
              }}
              onFocus={() => {
                if (placesEnabled && !locked && suggestions.length > 0) setOpen(true);
              }}
              onKeyDown={onAddressKeyDown}
              placeholder="123 Main St, Springfield, IL 62701"
              required
              aria-describedby="government-address-help"
              disabled={locked || status === 'loading' || resolvingPlace}
            />
            {showSuggestions && (
              <ul className="government-address-panel" id={listId} role="listbox">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.placeId} role="presentation">
                    <button
                      id={`${listId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      className={activeIndex === index ? 'active' : ''}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void selectSuggestion(suggestion)}
                    >
                      <strong>{suggestion.primaryText}</strong>
                      {suggestion.secondaryText && <span>{suggestion.secondaryText}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
        <p id="government-address-help" className="government-finder-help">
          Include street number, street name, city, state, and ZIP. Start typing to search suggested U.S. street addresses. PO boxes and ZIP-only lookups cannot be matched to a district.
        </p>

        {locked ? (
          <button className="form-submit" type="button" onClick={clearAddress}>
            CLEAR ADDRESS <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button className="form-submit" type="submit" disabled={status === 'loading' || resolvingPlace || !address.trim()} aria-busy={status === 'loading' || resolvingPlace}>
            {status === 'loading' ? 'LOOKING UP DISTRICT' : 'FIND REPRESENTATIVES'} <span aria-hidden="true">→</span>
          </button>
        )}
      </form>

      <div className="government-finder-status" aria-live="polite" aria-atomic="true">
        {status === 'loading' && <p role="status">Looking up your congressional district…</p>}
        {status === 'error' && error && <p className="form-error" role="alert">{error}</p>}
        {status === 'success' && result && (
          <p role="status">Found congressional district {result.districtLabel}.</p>
        )}
      </div>

      {status === 'success' && result && (
        <div className="government-finder-results">
          <p className="government-finder-district">
            <strong>District:</strong> {result.districtLabel}
          </p>

          <div className="government-finder-group">
            <h3>U.S. House</h3>
            {result.houseVacant || !result.representative ? (
              <p className="government-finder-vacant">
                This House seat is currently vacant or not yet listed in our roster.
              </p>
            ) : (
              <CongressMemberCard member={result.representative} />
            )}
          </div>

          <div className="government-finder-group">
            <h3>U.S. Senate</h3>
            {!result.senateApplies ? (
              <p className="government-finder-note">
                {result.jurisdiction.state === 'DC'
                  ? 'The District of Columbia does not have voting representation in the U.S. Senate.'
                  : 'U.S. territories and the District of Columbia do not have senators in the U.S. Senate.'}
              </p>
            ) : result.senators.length === 0 ? (
              <p className="government-finder-vacant">Senate seats for this state are not yet listed in our roster.</p>
            ) : (
              <div className="congress-member-grid">
                {result.senators.map((senator) => (
                  <CongressMemberCard key={senator.bioguideId} member={senator} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
