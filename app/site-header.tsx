'use client';

import { cn, s } from '@/app/tailwind-styles';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import navbarLogo from '@/assets/logo-2.png';
import type { SearchActionResult, SearchOrganizationResult, SearchResults } from '@/lib/db';

type SiteHeaderProps = {
  showSubmitLink?: boolean;
};

type FlatResult =
  | { kind: 'organization'; item: SearchOrganizationResult }
  | { kind: 'action'; item: SearchActionResult };

function resultHref(result: FlatResult) {
  return result.kind === 'organization'
    ? `/o/${result.item.slug}`
    : `/a/${result.item.issueSlug}/${result.item.slug}`;
}

function flattenResults(results: SearchResults | null): FlatResult[] {
  if (!results) return [];
  return [
    ...results.organizations.map((item) => ({ kind: 'organization' as const, item })),
    ...results.actions.map((item) => ({ kind: 'action' as const, item })),
  ];
}

export function SiteHeader({ showSubmitLink = true }: SiteHeaderProps) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const flat = flattenResults(results);
  const showPanel = open && query.trim().length >= 2;

  useEffect(() => {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json().catch(() => null) as (SearchResults & { error?: string }) | null;
          if (!response.ok) throw new Error(body?.error ?? 'Search failed.');
          setResults({ actions: body?.actions ?? [], organizations: body?.organizations ?? [] });
          setActiveIndex(-1);
        })
        .catch((reason: unknown) => {
          if (reason instanceof Error && reason.name === 'AbortError') return;
          setResults(null);
          setError(reason instanceof Error ? reason.message : 'Search failed.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open && !expanded) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setExpanded(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, expanded]);

  function goTo(result: FlatResult) {
    setOpen(false);
    setExpanded(false);
    setQuery('');
    setResults(null);
    router.push(resultHref(result));
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!showPanel && event.key !== 'Escape') return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, flat.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === 'Enter') {
      const target = activeIndex >= 0 ? flat[activeIndex] : flat[0];
      if (target) {
        event.preventDefault();
        goTo(target);
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setExpanded(false);
      inputRef.current?.blur();
    }
  }

  return (
    <header className={s.siteHeader}>
      <Link className={cn(s.brand, s.headerBrand)} href="/" aria-label="Force Against home">
        <Image src={navbarLogo} alt="Force Against" priority unoptimized />
      </Link>
      <div className={s.siteSearch} ref={rootRef}>
        <button className={s.siteSearchToggle}
          type="button"
          aria-label="Search actions and organizations"
          aria-expanded={expanded || open}
          onClick={() => {
            setExpanded(true);
            setOpen(true);
            window.requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 20 20" />
          </svg>
        </button>
        <div className={s.siteSearchField}>
          <label className={s.visuallyHidden} htmlFor={`${listId}-input`}>Search</label>
          <input
            id={`${listId}-input`}
            ref={inputRef}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={showPanel}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            placeholder="Search actions & orgs"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (nextQuery.trim().replace(/\s+/g, ' ').length < 2) {
                setResults(null);
                setError('');
                setLoading(false);
                setActiveIndex(-1);
              } else {
                setLoading(true);
                setError('');
              }
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {showPanel && (
            <div className={s.siteSearchPanel} id={listId} role="listbox">
              {loading && <p className={s.siteSearchStatus}>Searching…</p>}
              {!loading && error && <p className={s.siteSearchStatus} role="alert">{error}</p>}
              {!loading && !error && results && flat.length === 0 && (
                <p className={s.siteSearchStatus}>No published matches.</p>
              )}
              {!loading && !error && results && results.organizations.length > 0 && (
                <div className={s.siteSearchGroup}>
                  <p className={s.siteSearchLabel}>Organizations</p>
                  {results.organizations.map((item, index) => {
                    const flatIndex = index;
                    return (
                      <button
                        key={`org-${item.id}`}
                        id={`${listId}-option-${flatIndex}`}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === flatIndex}
                        className={activeIndex === flatIndex ? s.searchResultActive : undefined}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => goTo({ kind: 'organization', item })}
                      >
                        <strong>{item.name}</strong>
                        {item.description && <span>{item.description}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {!loading && !error && results && results.actions.length > 0 && (
                <div className={s.siteSearchGroup}>
                  <p className={s.siteSearchLabel}>Actions</p>
                  {results.actions.map((item, index) => {
                    const flatIndex = (results?.organizations.length ?? 0) + index;
                    return (
                      <button
                        key={`action-${item.id}`}
                        id={`${listId}-option-${flatIndex}`}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === flatIndex}
                        className={activeIndex === flatIndex ? s.searchResultActive : undefined}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => goTo({ kind: 'action', item })}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.type} · {item.organization} · {item.issue}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={s.headerActions}>
        <AuthControl />
        {showSubmitLink && (
          <Link className={s.submitLink} href="/submit">
            <span className={s.submitLinkFull}>Submit an action</span>
            <span className={s.submitLinkShort}>Add action</span>
          </Link>
        )}
      </div>
    </header>
  );
}
