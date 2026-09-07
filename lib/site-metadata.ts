import type { Metadata } from 'next';

export const SITE_NAME = 'Force Against';
export const SITE_URL = 'https://forceagainst.com';

const SITE_OPEN_GRAPH_IMAGE = {
  url: '/og-homepage.png',
  width: 1200,
  height: 630,
  alt: 'Turn concern into force.',
};

type SiteMetadataOptions = {
  title: string;
  openGraphTitle?: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export function createSiteMetadata({
  title,
  openGraphTitle,
  description,
  path,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
}: SiteMetadataOptions): Metadata {
  const openGraphImages = image
    ? [{ url: image, alt: imageAlt || title, width: imageWidth, height: imageHeight }]
    : [SITE_OPEN_GRAPH_IMAGE];
  const twitterImages = image ? [image] : [SITE_OPEN_GRAPH_IMAGE.url];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      siteName: SITE_NAME,
      title: openGraphTitle || title,
      description,
      images: openGraphImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: twitterImages,
    },
  };
}

export function summarizeForMetadata(value: string, fallback: string, maxLength = 200) {
  const summary = value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-+*>]\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!summary) return fallback;
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength - 1).trimEnd()}…`;
}
