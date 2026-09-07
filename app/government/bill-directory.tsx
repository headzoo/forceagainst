import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { Fragment } from 'react';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import {
  DEFAULT_LEGISLATIVE_PAGE_SIZE,
  formatLegislativeSyncFreshness,
  type LegislativeBillDirectoryResult,
} from '@/lib/legislative-bills';
import { BillCard } from './bill-card';
import { LegislativeStageSummary } from './legislative-stage-summary';

export type BillDirectoryVariant = 'state' | 'federal';

type BillDirectoryProps = {
  variant: BillDirectoryVariant;
  title: string;
  eyebrow: string;
  intro: string;
  note?: string;
  basePath: string;
  backHref?: string;
  backLabel?: string;
  result: LegislativeBillDirectoryResult;
  showOriginChamber?: boolean;
};

function directoryPageHref(basePath: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (pageSize !== DEFAULT_LEGISLATIVE_PAGE_SIZE) params.set('pageSize', String(pageSize));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function pageNumbers(currentPage: number, totalPages: number) {
  return [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

function resultRange(result: LegislativeBillDirectoryResult) {
  if (result.total === 0) return '0 results';

  const start = (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.total);
  return `${start.toLocaleString('en-US')}–${end.toLocaleString('en-US')} of ${result.total.toLocaleString('en-US')}`;
}

function emptyStateContent(result: LegislativeBillDirectoryResult, variant: BillDirectoryVariant) {
  if (!result.lastSuccessfulSyncAt) {
    return {
      title: 'Bill directory setup in progress.',
      body: variant === 'state'
        ? 'State legislation has not been synced yet. Once the mirror completes, active bills from the current session will appear here automatically.'
        : 'Federal legislation has not been synced yet. Once the mirror completes, active bills originating in this chamber will appear here automatically.',
    };
  }

  if (!result.sessionLabel) {
    return {
      title: 'Current session not available yet.',
      body: variant === 'state'
        ? 'Legislation sync has started, but the current session has not been identified yet. Check back after the next sync.'
        : 'Congress legislation sync has started, but the current Congress session has not been identified yet. Check back after the next sync.',
    };
  }

  return {
    title: 'No active bills in the current session.',
    body: variant === 'state'
      ? 'The mirror is current, but there are no active bills recorded for this state’s current legislative session.'
      : 'The mirror is current, but there are no active bills recorded as originating in this chamber for the current Congress.',
  };
}

export function BillDirectory({
  variant,
  title,
  eyebrow,
  intro,
  note,
  basePath,
  backHref = '/government',
  backLabel = '← Back to your government',
  result,
  showOriginChamber = false,
}: BillDirectoryProps) {
  const freshness = formatLegislativeSyncFreshness({ lastSuccessfulSyncAt: result.lastSuccessfulSyncAt });
  const numbers = pageNumbers(result.page, result.totalPages);
  const rangeLabel = resultRange(result);
  const emptyState = emptyStateContent(result, variant);

  return (
    <main className={s.billDirectoryPage}>
      <SiteHeader />

      <section className={s.billDirectoryHero}>
        <div className={s.billDirectoryHeading}>
          <Link className={cn(s.backLink, s.governmentBackLink)} href={backHref}>
            {backLabel}
          </Link>
          <p className={s.eyebrow}><span /> {eyebrow}</p>
          <h1 className={s.billDirectoryTitle}>{title}</h1>
          <p className={s.billDirectoryIntro}>{intro}</p>
          {note && <p className={s.billDirectoryNote}>{note}</p>}
        </div>

        <aside className={s.billDirectoryAside} aria-label="Directory status">
          {result.sessionLabel && (
            <p className={s.billDirectorySession}>
              <span>Current session</span>
              <strong>{result.sessionLabel}</strong>
            </p>
          )}
          <p className={s.billDirectoryFreshness} role="status">
            <span>Data freshness</span>
            <strong>{freshness}</strong>
          </p>
        </aside>
      </section>

      <section className={s.billDirectoryShell} aria-labelledby="bill-directory-heading">
        <div className={s.billDirectoryShellIntro}>
          <p className={s.eyebrow}><span /> ACTIVE BILLS</p>
          <h2 id="bill-directory-heading">Current legislation.</h2>
          <p>
            Lists include only active bills from the current session. Latest reported stage, body, and action come from mirrored public records and may not reflect real-time changes.
          </p>
        </div>

        <LegislativeStageSummary counts={result.lifecycleCounts} total={result.total} />

        {result.items.length === 0 ? (
          <div className={s.billDirectoryEmpty} role="status">
            <h3>{emptyState.title}</h3>
            <p>{emptyState.body}</p>
          </div>
        ) : (
          <>
            <ol className={s.billDirectoryList}>
              {result.items.map((bill) => (
                <li key={bill.id}>
                  <BillCard bill={bill} showOriginChamber={showOriginChamber} />
                </li>
              ))}
            </ol>

            {result.totalPages > 1 && (
              <div className={s.actionPaginationShell}>
                <p className={s.actionPaginationSummary}>{rangeLabel}</p>
                <nav className={s.actionPagination} aria-label="Bill directory pagination">
                  {result.page > 1 && (
                    <Link
                      className={s.actionPaginationButton}
                      href={directoryPageHref(basePath, result.page - 1, result.pageSize)}
                      rel="prev"
                    >
                      ← Prev
                    </Link>
                  )}
                  {numbers.map((page, index) => (
                    <Fragment key={page}>
                      {index > 0 && page > numbers[index - 1] + 1 && (
                        <span className={s.actionPaginationGap} aria-hidden="true">…</span>
                      )}
                      {page === result.page ? (
                        <span className={s.actionPaginationCurrent} aria-current="page">{page}</span>
                      ) : (
                        <Link
                          className={s.actionPaginationButton}
                          href={directoryPageHref(basePath, page, result.pageSize)}
                          aria-label={`Page ${page}`}
                        >
                          {page}
                        </Link>
                      )}
                    </Fragment>
                  ))}
                  {result.page < result.totalPages && (
                    <Link
                      className={s.actionPaginationButton}
                      href={directoryPageHref(basePath, result.page + 1, result.pageSize)}
                      rel="next"
                    >
                      Next →
                    </Link>
                  )}
                </nav>
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
