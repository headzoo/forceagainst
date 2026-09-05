'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ctaImage from '@/assets/cta.jpg';
import type { DirectoryAction, Issue } from '@/lib/db';
import { authClient } from '@/lib/auth-client';
import { LikeButton } from './action-like-button';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

type ActionType = DirectoryAction['type'];
const filters: Array<'All' | ActionType> = ['All', 'Petition', 'Lawsuit', 'Campaign'];
const selectedIssueStorageKey = 'forceAgainstSomething:selectedIssueSlug';
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
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const initialIssue = issues.find((issue) => issue.status === 'active') ?? issues[0];
  const initialIssueSlug = initialIssue?.slug ?? '';
  const [issueSlug, setIssueSlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [likes, setLikes] = useState<{ userId: string; actionIds: Set<number> } | null>(null);
  const [updatingLikes, setUpdatingLikes] = useState<Set<number>>(new Set());
  const [likeError, setLikeError] = useState('');
  const likedActionIds = likes && likes.userId === userId ? likes.actionIds : new Set<number>();
  const selectedIssue = issueSlug ? issues.find((issue) => issue.slug === issueSlug) ?? initialIssue : null;
  const selectedIssueHeading = selectedIssue ? splitHeadingEnding(selectedIssue.name) : null;
  const issueActions = useMemo(
    () => actions.filter((action) => action.issueId === selectedIssue?.id),
    [actions, selectedIssue?.id],
  );
  const visible = useMemo(
    () => filter === 'All' ? issueActions : issueActions.filter((item) => item.type === filter),
    [filter, issueActions],
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

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    fetch('/api/likes', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load likes.');
        return await response.json() as { actionIds: number[] };
      })
      .then(({ actionIds }) => setLikes({ userId, actionIds: new Set(actionIds) }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') setLikeError(error.message);
      });

    return () => controller.abort();
  }, [userId]);

  async function toggleLike(actionId: number) {
    if (!session || updatingLikes.has(actionId)) return;

    const wasLiked = likedActionIds.has(actionId);
    setLikeError('');
    setLikes((current) => {
      const next = new Set(current?.userId === session.user.id ? current.actionIds : []);
      if (wasLiked) next.delete(actionId);
      else next.add(actionId);
      return { userId: session.user.id, actionIds: next };
    });
    setUpdatingLikes((current) => new Set(current).add(actionId));

    try {
      const response = await fetch('/api/likes', {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not update that like.');
      }
    } catch (error) {
      setLikes((current) => {
        const next = new Set(current?.userId === session.user.id ? current.actionIds : []);
        if (wasLiked) next.add(actionId);
        else next.delete(actionId);
        return { userId: session.user.id, actionIds: next };
      });
      setLikeError(error instanceof Error ? error.message : 'Could not update that like.');
    } finally {
      setUpdatingLikes((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  return (
    <main>
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> PICK AN ISSUE. DO YOUR PART.</p>
          <h1 className="hero-cta">
            <Image className="hero-cta-image" src={ctaImage} alt="Turn concern into force." priority sizes="(max-width: 780px) calc(100vw - 40px), 48vw" />
          </h1>
          <p className="dek">A focused directory of verified petitions, lawsuits, and campaigns fighting for the issue you choose.</p>
        </div>
        <div className="issue-card">
          <p className="issue-card-prompt" id="issue-picker-label">What are you fighting for?</p>
          {issueSlug === null ? (
            <div className="issue-options issue-options-loading" aria-hidden="true">
              {Array.from({ length: Math.max(minimumIssuePlaceholderCount, issues.length) }, (_, index) => (
                <span className="issue-option-placeholder" key={index} />
              ))}
            </div>
          ) : selectedIssue && (
            <div className="issue-options" role="group" aria-labelledby="issue-picker-label">
              {issues.map((issue) => {
                const isSelected = selectedIssue.id === issue.id;
                const isPlanned = issue.status === 'planned';
                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={`issue-option${isSelected ? ' active' : ''}`}
                    disabled={isPlanned}
                    aria-pressed={isSelected}
                    aria-label={`${issue.name}${isPlanned ? ' coming next' : ''}`}
                    title={isPlanned ? `${issue.name} coming next` : issue.name}
                    onClick={() => { setIssueSlug(issue.slug); setFilter('All'); }}
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
        <section className="actions-section" id="actions">
          <div className="section-heading">
            <div><p className="eyebrow"><span /> CURRENT FOCUS</p><h2 className="homepage-issue-heading"><Link className="issue-heading-link" href={`/i/${selectedIssue.slug}`}>{selectedIssueHeading?.headingStart}<span className="heading-end-lockup">{selectedIssueHeading?.headingEnd}<Image className="heading-end-star" src="/homepage-issue-heading-star.png" alt="" width={99} height={99} aria-hidden="true" unoptimized /></span></Link></h2></div>
            <p>Every listing gives you the context, organization, and direct path you need to act. We check ownership, activity, and a clear path to impact.</p>
          </div>
          <div className="filter-row" role="group" aria-label="Filter actions by type">
            {filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? 'active' : ''} aria-pressed={filter === item}>{item} {item !== 'All' && <sup>{issueActions.filter((action) => action.type === item).length}</sup>}</button>)}
          </div>
          <div className="action-list" aria-live="polite">
            {visible.map((action) => (
              <article className="action-card" key={action.id}>
                <div className="card-main">
                  <div className="action-title-row">
                    {session && (
                      <LikeButton
                        actionTitle={action.title}
                        liked={likedActionIds.has(action.id)}
                        disabled={updatingLikes.has(action.id)}
                        onClick={() => toggleLike(action.id)}
                      />
                    )}
                    <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
                  </div>
                  <p>{action.detail}</p>
                  <span className="organization">
                    <span className="type-pill">{action.type}</span>{action.urgent && <span className="type-pill urgent">Priority</span>} <span className="organization-prefix">BY</span> <Link href={`/o/${action.organizationSlug}`}>{action.organization.toUpperCase()}</Link>
                  </span>
                </div>
                <div className="card-action"><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION</Link><span>{action.effort}</span></div>
              </article>
            ))}
            {visible.length === 0 && <p className="empty-state">No published actions match this filter yet.</p>}
            {likeError && <p className="like-error" role="alert">{likeError}</p>}
          </div>
        </section>
      )}

      <section className="trust-band"><div className="trust-mark" aria-hidden="true"><span>✓</span></div><div><p className="eyebrow"><span /> OUR STANDARD</p><h2>Curated for action,<br />not attention.</h2></div><p>We prioritize credible organizations, active efforts, transparent asks, and direct links. No outrage bait. No pay-to-play placement. Just useful ways to help.</p></section>
      <SiteFooter homeBrandTarget="#top" />
    </main>
  );
}
