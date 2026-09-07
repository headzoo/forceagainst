'use client';

import { cn, s } from '@/app/tailwind-styles';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ctaImage from '@/assets/cta.jpg';
import type { DirectoryAction, Issue } from '@/lib/db';
import { ActionList } from './action-list';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

const selectedIssueStorageKey = 'forceAgainst:selectedIssueSlug';
const minimumIssuePlaceholderCount = 8;

function splitHeadingEnding(heading: string) {
  const trimmedHeading = heading.trim();
  const finalSpaceIndex = trimmedHeading.lastIndexOf(' ');

  if (finalSpaceIndex === -1) {
    return { headingStart: '', headingEnd: trimmedHeading };
  }

  return {
    headingStart: trimmedHeading.slice(0, finalSpaceIndex + 1),
    headingEnd: trimmedHeading.slice(finalSpaceIndex + 1),
  };
}

export function ActionsDirectory({ issues, actions }: { issues: Issue[]; actions: DirectoryAction[] }) {
  const initialIssue = issues.find((issue) => issue.status === 'active') ?? issues[0];
  const initialIssueSlug = initialIssue?.slug ?? '';
  const [issueSlug, setIssueSlug] = useState<string | null>(null);
  const selectedIssue = issueSlug ? issues.find((issue) => issue.slug === issueSlug) ?? initialIssue : null;
  const selectedIssueHeading = selectedIssue ? splitHeadingEnding(selectedIssue.name) : null;
  const issueActions = useMemo(
    () => actions.filter((action) => action.issueId === selectedIssue?.id),
    [actions, selectedIssue?.id],
  );

  useEffect(() => {
    let restoredSlug = initialIssueSlug;

    try {
      const storedSlug = window.localStorage.getItem(selectedIssueStorageKey);
      const storedIssue = issues.find((issue) => issue.slug === storedSlug && issue.status !== 'planned');

      if (storedIssue) restoredSlug = storedIssue.slug;
      else if (storedSlug) window.localStorage.removeItem(selectedIssueStorageKey);
    } finally {
      setIssueSlug(restoredSlug);
    }
  }, [initialIssueSlug, issues]);

  useEffect(() => {
    if (!issueSlug) return;

    const selected = issues.find((issue) => issue.slug === issueSlug && issue.status !== 'planned');
    if (!selected) return;

    try {
      window.localStorage.setItem(selectedIssueStorageKey, selected.slug);
    } catch {
      // Ignore storage failures so the selector still works when browser storage is restricted.
    }
  }, [issueSlug, issues]);

  return (
    <main>
      <SiteHeader />

      <section className={s.hero} id="top">
        <div className={s.heroCopy}>
          <p className={s.eyebrow}><span /> DO YOUR PART.</p>
          <h1 className={s.heroCta}>
            <Image className={s.heroCtaImage} src={ctaImage} alt="Turn concern into force." priority sizes="(max-width: 780px) calc(100vw - 40px), 48vw" />
          </h1>
          <p className={s.dek}>A focused directory of petitions, lawsuits, and campaigns fighting for the issue you choose.</p>
        </div>
        <div className={s.issueCard}>
          <p className={s.issueCardPrompt} id="issue-picker-label">What are you fighting for?</p>
          {issueSlug === null ? (
            <div className={cn(s.issueOptions, s.issueOptionsLoading)} aria-hidden="true">
              {Array.from({ length: Math.max(minimumIssuePlaceholderCount, issues.length) }, (_, index) => (
                <span className={s.issueOptionPlaceholder} key={index} />
              ))}
            </div>
          ) : selectedIssue && (
            <div className={s.issueOptions} role="group" aria-labelledby="issue-picker-label">
              {issues.map((issue) => {
                const isSelected = selectedIssue.id === issue.id;
                const isPlanned = issue.status === 'planned';
                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={cn(s.issueOption, isSelected && s.issueOptionActive)}
                    disabled={isPlanned}
                    aria-pressed={isSelected}
                    aria-label={`${issue.name}${isPlanned ? ' coming next' : ''}`}
                    title={isPlanned ? `${issue.name} coming next` : issue.name}
                    onClick={() => setIssueSlug(issue.slug)}
                  >
                    <span>{issue.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedIssue && (
        <section className={s.actionsSection} id="actions">
          <div className={s.sectionHeading}>
            <div><p className={s.eyebrow}><span /> CURRENT FOCUS</p><h2 className={s.homepageIssueHeading}><Link className={s.issueHeadingLink} href={`/i/${selectedIssue.slug}`}>{selectedIssueHeading?.headingStart}<span className={s.headingEndLockup}>{selectedIssueHeading?.headingEnd}<Image className={s.headingEndStar} src="/homepage-issue-heading-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span></Link></h2></div>
            <p>Every listing gives you the context, organization, and direct path you need to act. We check ownership, activity, and a clear path to impact.</p>
          </div>
          <ActionList key={selectedIssue.id} actions={issueActions} />
          <Link className={cn(s.primaryButton, s.homepageBrowseMore)} href={`/i/${selectedIssue.slug}`}>
            BROWSE MORE <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      <section className={s.trustBand}><div className={s.trustMark} aria-hidden="true"><span>✓</span></div><div><p className={s.eyebrowLight}><span /> OUR STANDARD</p><h2>Curated for action,<br />not attention.</h2></div><p>We prioritize credible organizations, active efforts, transparent asks, and direct links. No outrage bait. No pay-to-play placement. Just useful ways to help.</p></section>
      <SiteFooter homeBrandTarget="#top" />
    </main>
  );
}
