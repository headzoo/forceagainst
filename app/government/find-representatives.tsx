'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { PublicCongressMember } from '@/lib/db';
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
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RepresentativesResult | null>(null);
  const requestIdRef = useRef(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = ++requestIdRef.current;

    setStatus('loading');
    setError('');
    setResult(null);

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
          <input
            id="government-address"
            name="address"
            type="text"
            autoComplete="street-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="123 Main St, Springfield, IL 62701"
            required
            aria-describedby="government-address-help"
            disabled={status === 'loading'}
          />
        </label>
        <p id="government-address-help" className="government-finder-help">
          Include street number, street name, city, state, and ZIP. PO boxes and ZIP-only lookups cannot be matched to a district.
        </p>

        <button className="form-submit" type="submit" disabled={status === 'loading' || !address.trim()} aria-busy={status === 'loading'}>
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
