import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActiveIssues } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';
import { ActionEditor } from './editor';

export const dynamic = 'force-dynamic';

type EditActionPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: EditActionPageProps): Promise<Metadata> {
  const { id } = await params;
  return createSiteMetadata({
    title: 'Edit action | Force Against Something',
    description: 'Update an action submitted to the Force Against Something directory.',
    path: `/organization/actions/${id}`,
  });
}

export default async function EditActionPage({ params }: EditActionPageProps) {
  const { id: value } = await params;
  const actionId = Number(value);
  if (!Number.isSafeInteger(actionId) || actionId < 1) notFound();

  const issues = await getActiveIssues();
  return <ActionEditor actionId={actionId} issues={issues} />;
}
