'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  clearStoredGovernmentLookup,
  fetchStoredRepresentatives,
  readStoredGovernmentLookup,
} from '@/lib/government-lookup-storage';
import type { RepresentativesResult } from '@/lib/government-representatives';
import { stateHeading } from '@/lib/us-states';
import { RepresentativeAddressForm } from './representative-address-form';

type ActionGovernmentWriterProps = {
  actionId?: number;
  actionTitle?: string;
  openOnMount?: boolean;
  triggerLabel?: string;
};

function memberJurisdiction(member: RepresentativesResult['senators'][number], result: RepresentativesResult) {
  if (member.chamber === 'senate') return stateHeading(member.state);
  return result.districtLabel;
}

export function ActionGovernmentWriter({
  actionId,
  actionTitle,
  openOnMount = false,
  triggerLabel = 'Write your government',
}: ActionGovernmentWriterProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(openOnMount);
  const [phase, setPhase] = useState<'loading' | 'lookup' | 'choose'>('loading');
  const [result, setResult] = useState<RepresentativesResult | null>(null);
  const [restoreMessage, setRestoreMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const animationFrame = window.requestAnimationFrame(() => {
      const stored = readStoredGovernmentLookup();
      if (!stored) {
        setPhase('lookup');
        return;
      }

      void fetchStoredRepresentatives(stored)
        .then((nextResult) => {
          if (cancelled) return;
          setResult(nextResult);
          setPhase('choose');
        })
        .catch(() => {
          if (cancelled) return;
          clearStoredGovernmentLookup();
          setRestoreMessage('Your saved representatives could not be refreshed. Enter your address to look them up again.');
          setPhase('lookup');
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ) ?? []).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function closeDialog() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openDialog() {
    setResult(null);
    setRestoreMessage('');
    setPhase('loading');
    setOpen(true);
  }

  function useDifferentAddress() {
    clearStoredGovernmentLookup();
    setResult(null);
    setRestoreMessage('');
    setPhase('lookup');
  }

  const recipients = result
    ? [result.representative, ...result.senators].filter((member): member is NonNullable<typeof member> => member !== null)
    : [];

  function writeHref(bioguideId: string) {
    const params = new URLSearchParams({ rep: bioguideId });
    if (actionId) params.set('action', String(actionId));
    return `/government/write?${params.toString()}`;
  }

  return (
    <>
      <button ref={triggerRef} className={s.actionGovernmentButton} type="button" onClick={openDialog}>
        <span>{triggerLabel}</span>
        <span aria-hidden="true">→</span>
      </button>

      {open && (
        <div className={s.actionGovernmentOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section ref={dialogRef} className={s.actionGovernmentDialog} role="dialog" aria-modal="true" aria-labelledby="government-writer-title">
            <button ref={closeRef} className={s.actionGovernmentClose} type="button" aria-label="Close representative picker" onClick={closeDialog}>×</button>
            <p className={cn(s.eyebrow, s.actionGovernmentEyebrow)}><span /> WRITE YOUR GOVERNMENT</p>

            {phase === 'loading' && (
              <div className={s.actionGovernmentLoading} aria-live="polite">
                <h2 id="government-writer-title">Finding your saved representatives.</h2>
                <p role="status">Checking the current congressional roster…</p>
              </div>
            )}

            {phase === 'lookup' && (
              <div className={s.actionGovernmentLookup}>
                <h2 id="government-writer-title">Find your representatives.</h2>
                <p>Enter your complete U.S. street address to find the federal officials who represent you.</p>
                {restoreMessage && <p className={s.actionGovernmentNotice} role="status">{restoreMessage}</p>}
                <RepresentativeAddressForm
                  autoFocus
                  onFound={(nextResult) => {
                    setResult(nextResult);
                    setPhase('choose');
                  }}
                />
              </div>
            )}

            {phase === 'choose' && result && (
              <div className={s.actionGovernmentChooser}>
                <h2 id="government-writer-title">Who do you want to write?</h2>
                <p>
                  {actionTitle
                    ? <>Choose one of your federal representatives to write about “{actionTitle}.”</>
                    : 'Choose one of your federal representatives to start your letter.'}
                </p>
                <p className={s.actionGovernmentDistrict}><strong>Your district:</strong> {result.districtLabel}</p>

                {recipients.length > 0 ? (
                  <div className={s.actionGovernmentRecipients}>
                    {recipients.map((member) => (
                      <Link key={member.bioguideId} href={writeHref(member.bioguideId)}>
                        <span>
                          <small>{member.displayTitle}</small>
                          <strong>{member.officialFullName}</strong>
                          <em>{member.party} · {memberJurisdiction(member, result)}</em>
                        </span>
                        <b aria-hidden="true">→</b>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={s.actionGovernmentNotice}>No current federal representatives are available for this jurisdiction.</p>
                )}

                <button className={s.actionGovernmentChangeAddress} type="button" onClick={useDifferentAddress}>Use a different address</button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
