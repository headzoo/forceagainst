'use client';

import { s } from '@/app/tailwind-styles';
import { useEffect, useState } from 'react';
import {
  clearStoredGovernmentLookup,
  fetchStoredRepresentatives,
  readStoredGovernmentLookup,
} from '@/lib/government-lookup-storage';
import type { RepresentativesResult } from '@/lib/government-representatives';
import { CongressMemberCard } from './congress-member-card';
import { RepresentativeAddressForm } from './representative-address-form';

export function FindRepresentatives() {
  const [result, setResult] = useState<RepresentativesResult | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const animationFrame = window.requestAnimationFrame(() => {
      const stored = readStoredGovernmentLookup();
      if (!stored) {
        setRestoring(false);
        return;
      }

      void fetchStoredRepresentatives(stored)
        .then((nextResult) => {
          if (!cancelled) setResult(nextResult);
        })
        .catch(() => {
          clearStoredGovernmentLookup();
        })
        .finally(() => {
          if (!cancelled) setRestoring(false);
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function useDifferentAddress() {
    clearStoredGovernmentLookup();
    setResult(null);
    setFormVersion((current) => current + 1);
  }

  return (
    <section className={s.governmentFinderPanel} aria-labelledby="government-finder-heading">
      <p className={s.step}>ADDRESS LOOKUP / 01</p>
      <h2 id="government-finder-heading">Find your<br />representatives.</h2>
      <p>
        Enter a complete U.S. street address with city, state, and ZIP. A ZIP code alone is not enough to determine your congressional district.
      </p>

      {restoring ? (
        <div className={s.governmentFinderStatus} aria-live="polite">
          <p role="status">Loading your saved representatives…</p>
        </div>
      ) : result ? (
        <button className={s.formSubmit} type="button" onClick={useDifferentAddress}>
          USE A DIFFERENT ADDRESS <span aria-hidden="true">→</span>
        </button>
      ) : (
        <RepresentativeAddressForm key={formVersion} onFound={setResult} />
      )}

      {result && (
        <div className={s.governmentFinderResults}>
          <p className={s.governmentFinderDistrict} role="status">
            <strong>District:</strong> {result.districtLabel}
          </p>

          <div className={s.governmentFinderGroup}>
            <h3>U.S. House</h3>
            {result.houseVacant || !result.representative ? (
              <p className={s.governmentFinderNote}>
                This House seat is currently vacant or not yet listed in our roster.
              </p>
            ) : (
              <CongressMemberCard member={result.representative} />
            )}
          </div>

          <div className={s.governmentFinderGroup}>
            <h3>U.S. Senate</h3>
            {!result.senateApplies ? (
              <p className={s.governmentFinderNote}>
                {result.jurisdiction.state === 'DC'
                  ? 'The District of Columbia does not have voting representation in the U.S. Senate.'
                  : 'U.S. territories and the District of Columbia do not have senators in the U.S. Senate.'}
              </p>
            ) : result.senators.length === 0 ? (
              <p className={s.governmentFinderNote}>Senate seats for this state are not yet listed in our roster.</p>
            ) : (
              <div className={s.congressMemberGrid}>
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
