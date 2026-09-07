import type { Metadata } from 'next';
import { ActionsDirectory } from './actions-directory';
import { getDirectoryData } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Force Against Something — Find your way to act',
  openGraphTitle: 'Force Against Something - Do Your Part.',
  description: 'A curated directory of verified petitions, lawsuits, and campaigns organized by issue so you can find your way to act.',
  path: '/',
  image: '/og-homepage.png',
  imageAlt: 'Turn concern into force.',
  imageWidth: 1200,
  imageHeight: 630,
});

export default async function Home() {
  const directory = await getDirectoryData();

  return <ActionsDirectory {...directory} />;
}
