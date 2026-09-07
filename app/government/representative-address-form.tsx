'use client';

import { s } from '@/app/tailwind-styles';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { writeStoredGovernmentLookup } from '@/lib/government-lookup-storage';
import { isRepresentativesResult, type RepresentativesResult } from '@/lib/government-representatives';
import {
  createPlacesSessionToken,
  fetchPlaceStreetAddress,
  fetchPlaceSuggestions,
  hasPlacesAutocomplete,
} from '@/lib/places-autocomplete';
import { mergeSuggestionWithPlace, type PlaceSuggestion } from '@/lib/places-address';

type RepresentativeAddressFormProps = {
  onFound: (result: RepresentativesResult) => void;
  autoFocus?: boolean;
};

export function RepresentativeAddressForm({ onFound, autoFocus = false }: RepresentativeAddressFormProps) {
  const fieldId = useId();
  const listId = `${fieldId}-suggestions`;
  const comboboxRef = useRef<HTMLDivElement>(null);
  const filledAddressRef = useRef('');
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const requestIdRef = useRef(0);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
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
    if (resolvingPlace || !address.trim()) return;
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError('');
    setOpen(false);

    try {
      const response = await fetch('/api/government/representatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const body = await response.json().catch(() => null) as unknown;
      if (requestId !== requestIdRef.current) return;
      if (!response.ok || !isRepresentativesResult(body)) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'Representative lookup is temporarily unavailable.';
        setStatus('error');
        setError(message);
        return;
      }

      writeStoredGovernmentLookup(body);
      onFound(body);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus('error');
      setError('Representative lookup is temporarily unavailable.');
    }
  }

  return (
    <form className={s.governmentFinderForm} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <label htmlFor={fieldId}>
        Street address
        <div className={s.governmentAddressCombobox} ref={comboboxRef}>
          <input
            id={fieldId}
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
            autoFocus={autoFocus}
            aria-describedby={`${fieldId}-help`}
            disabled={status === 'loading' || resolvingPlace}
          />
          {showSuggestions && (
            <ul className={s.governmentAddressPanel} id={listId} role="listbox">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.placeId} role="presentation">
                  <button
                    id={`${listId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    className={activeIndex === index ? s.governmentAddressActive : undefined}
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
      <p id={`${fieldId}-help`} className={s.governmentFinderHelp}>
        Include street number, street name, city, state, and ZIP. Your address is used for this lookup and is not saved.
      </p>
      <button className={s.formSubmit} type="submit" disabled={status === 'loading' || resolvingPlace || !address.trim()} aria-busy={status === 'loading' || resolvingPlace}>
        {status === 'loading' ? 'LOOKING UP DISTRICT' : 'FIND REPRESENTATIVES'} <span aria-hidden="true">→</span>
      </button>
      <div className={s.governmentFinderStatus} aria-live="polite" aria-atomic="true">
        {status === 'loading' && <p role="status">Looking up your congressional district…</p>}
        {status === 'error' && error && <p className={s.formError} role="alert">{error}</p>}
      </div>
    </form>
  );
}

