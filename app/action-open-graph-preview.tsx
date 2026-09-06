import type { ActionOpenGraph } from '@/db/schema';
import { s } from '@/app/tailwind-styles';

function displayHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return value;
  }
}

export function ActionOpenGraphPreview({
  href,
  openGraph,
}: {
  href: string;
  openGraph: ActionOpenGraph;
}) {
  const displayUrl = openGraph.url || href;
  const host = displayHost(displayUrl);
  const siteLabel = openGraph.siteName || host;

  return (
    <a
      className={s.actionOpenGraphPreview}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${openGraph.title || siteLabel}`}
    >
      {openGraph.image && (
        // Arbitrary third-party preview hosts cannot be listed in Next Image configuration.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={s.actionOpenGraphImage}
          src={openGraph.image}
          alt={openGraph.imageAlt || ''}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
      <span className={s.actionOpenGraphBody}>
        {siteLabel && <small className={s.actionOpenGraphSite}>{siteLabel}</small>}
        {openGraph.title && <strong className={s.actionOpenGraphTitle}>{openGraph.title}</strong>}
        {openGraph.description && <span className={s.actionOpenGraphDescription}>{openGraph.description}</span>}
        {openGraph.siteName && <span className={s.actionOpenGraphUrl}>{host}</span>}
      </span>
    </a>
  );
}
