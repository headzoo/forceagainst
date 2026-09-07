import { s } from '@/app/tailwind-styles';
import type { LegislativeBillListItem } from '@/lib/legislative-bills';

type BillCardProps = {
  bill: LegislativeBillListItem;
  showOriginChamber?: boolean;
};

function formatBillDate(value: Date | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function formatOriginChamberLabel(value: string | null) {
  if (!value) return null;

  switch (value.toLowerCase()) {
    case 'house':
      return 'U.S. House';
    case 'senate':
      return 'U.S. Senate';
    default:
      return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function latestActionSummary(bill: LegislativeBillListItem) {
  const parts: string[] = [];

  if (bill.latestActionBody) parts.push(bill.latestActionBody);
  if (bill.latestActionText) parts.push(bill.latestActionText);

  return parts.join(' · ');
}

export function BillCard({ bill, showOriginChamber = false }: BillCardProps) {
  const formattedDate = formatBillDate(bill.latestActionDate);
  const actionSummary = latestActionSummary(bill);
  const originLabel = showOriginChamber ? formatOriginChamberLabel(bill.originChamber) : null;
  const externalLabel = bill.publicSourceUrl
    ? `View ${bill.billNumber} on official source (opens in new tab)`
    : null;

  return (
    <article className={s.billCard} aria-labelledby={`bill-${bill.id}-title`}>
      <div className={s.billCardMain}>
        <p className={s.billCardNumber}>{bill.billNumber}</p>
        <h3 className={s.billCardTitle} id={`bill-${bill.id}-title`}>
          {bill.title}
        </h3>

        <ul className={s.billCardMeta} aria-label="Bill status">
          <li>
            <span className={s.billCardMetaLabel}>Stage</span>
            <span>{bill.stageLabel}</span>
          </li>
          <li>
            <span className={s.billCardMetaLabel}>Status</span>
            <span>{bill.isActive ? 'Active' : 'Inactive'}</span>
          </li>
          {originLabel && (
            <li>
              <span className={s.billCardMetaLabel}>Origin</span>
              <span>{originLabel}</span>
            </li>
          )}
          <li>
            <span className={s.billCardMetaLabel}>Session</span>
            <span>{bill.sessionLabel}</span>
          </li>
        </ul>

        {(actionSummary || formattedDate) && (
          <div className={s.billCardLatest}>
            <p className={s.billCardLatestLabel}>Latest reported action</p>
            {actionSummary && <p className={s.billCardLatestText}>{actionSummary}</p>}
            {formattedDate && (
              <p className={s.billCardLatestDate}>
                <time dateTime={bill.latestActionDate!.toISOString()}>{formattedDate}</time>
              </p>
            )}
          </div>
        )}

        {bill.detailsPending && (
          <p className={s.billCardPending} role="status">
            Details updating — summary is available while full bill details sync.
          </p>
        )}
      </div>

      {bill.publicSourceUrl && externalLabel && (
        <div className={s.billCardAction}>
          <a
            href={bill.publicSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={externalLabel}
          >
            Official source
          </a>
        </div>
      )}
    </article>
  );
}
