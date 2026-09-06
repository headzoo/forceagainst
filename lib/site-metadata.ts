import type { Metadata } from 'next';

export const SITE_NAME = 'Force Against Something';
export const SITE_URL = 'https://forceagainstsomething.com';

const SITE_OPEN_GRAPH_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 628,
  alt: SITE_NAME,
};

type SiteMetadataOptions = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
};

export function createSiteMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
}: SiteMetadataOptions): Metadata {
  const openGraphImages = image
    ? [{ url: image, alt: imageAlt || title }]
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
      title,
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
