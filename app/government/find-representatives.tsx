'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { PublicCongressMember } from '@/lib/db';
import {
  createPlacesSessionToken,
  fetchPlaceStreetAddress,
  fetchPlaceSuggestions,
  hasPlacesAutocomplete,
} from '@/lib/places-autocomplete';
import { mergeSuggestionWithPlace, type PlaceSuggestion } from '@/lib/places-address';
import { CongressMemberCard } from './congress-member-card';

type RepresentativesResult = {
  jurisdiction: { state: string; district: number };
  districtLabel: string;
  representative: PublicCongressMember | null;
  senators: PublicCongressMember[];
  senateApplies: boolean;
  houseVacant: boolean;
};

export function FindRepresentatives() {
  const listId = useId();
  const comboboxRef = useRef<HTMLDivElement>(null);
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

  const placesEnabled = hasPlacesAutocomplete();
  const showSuggestions = placesEnabled && open && suggestions.length > 0;

  useEffect(() => {
    if (!placesEnabled) return;

    function onPointerDown(event: PointerEvent) {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [placesEnabled]);

  useEffect(() => {
    if (!placesEnabled) return;

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
  }, [address, placesEnabled]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resolvingPlace) return;
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

      setResult(body as RepresentativesResult);
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
              name="address"
              type="text"
              role={placesEnabled ? 'combobox' : undefined}
              autoComplete={placesEnabled ? 'off' : 'street-address'}
              aria-autocomplete={placesEnabled ? 'list' : undefined}
              aria-controls={placesEnabled ? listId : undefined}
              aria-expanded={placesEnabled ? showSuggestions : undefined}
              aria-activedescendant={showSuggestions && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
              value={address}
              onChange={(event) => {
                filledAddressRef.current = '';
                setAddress(event.target.value);
                if (placesEnabled) setOpen(true);
              }}
              onFocus={() => {
                if (placesEnabled && suggestions.length > 0) setOpen(true);
              }}
              onKeyDown={onAddressKeyDown}
              placeholder="123 Main St, Springfield, IL 62701"
              required
              aria-describedby="government-address-help"
              disabled={status === 'loading' || resolvingPlace}
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

        <button className="form-submit" type="submit" disabled={status === 'loading' || resolvingPlace || !address.trim()} aria-busy={status === 'loading' || resolvingPlace}>
          {status === 'loading' ? 'LOOKING UP DISTRICT' : 'FIND REPRESENTATIVES'} <span aria-hidden="true">→</span>
        </button>
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
