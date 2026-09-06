import type { Metadata } from 'next';
import { getActiveIssues } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';
import { SubmissionFlow } from './submission-flow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Submit an action | Force Against Something',
  description: 'Submit a petition, lawsuit, or campaign for review in the Force Against Something directory.',
  path: '/submit',
});

export default async function SubmitPage() {
  const issues = await getActiveIssues();
  return <SubmissionFlow issues={issues} />;
}
