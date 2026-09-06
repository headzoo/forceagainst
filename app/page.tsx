import type { Metadata } from 'next';
import { ActionsDirectory } from './actions-directory';
import { getDirectoryData } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Force Against Something — Find your way to act',
  description: 'A curated directory of verified petitions, lawsuits, and campaigns organized by issue so you can find your way to act.',
  path: '/',
});

export default async function Home() {
  const directory = await getDirectoryData();

  return <ActionsDirectory {...directory} />;
}
