import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BillDirectory } from '@/app/government/bill-directory';
import { getActiveStateLegislation } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';
import {
  isStatePageSlug,
  stateCodeFromPageSlug,
  stateName,
  statePageSlug,
} from '@/lib/us-states';

export const dynamic = 'force-dynamic';

type StateBillDirectoryPageProps = {
  params: Promise<{ state: string }>;
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
};

async function resolveState(params: StateBillDirectoryPageProps['params']) {
  const { state: slug } = await params;
  if (!isStatePageSlug(slug)) return null;

  const stateCode = stateCodeFromPageSlug(slug);
  if (!stateCode) return null;

  return { slug, stateCode, name: stateName(stateCode) };
}

export async function generateMetadata({ params }: StateBillDirectoryPageProps): Promise<Metadata> {
  const resolved = await resolveState(params);
  if (!resolved) {
    return createSiteMetadata({
      title: 'State not found | Force Against',
      description: 'The requested state legislation directory could not be found.',
      path: '/government',
    });
  }

  const path = `/government/state/${resolved.slug}`;
  return createSiteMetadata({
    title: `${resolved.name} Legislation | Force Against`,
    description: `Browse active bills in ${resolved.name}'s current legislative session.`,
    path,
  });
}

export default async function StateBillDirectoryPage({ params, searchParams }: StateBillDirectoryPageProps) {
  const resolved = await resolveState(params);
  if (!resolved) notFound();

  const query = await searchParams;
  const page = Array.isArray(query.page) ? query.page[0] : query.page;
  const pageSize = Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize;
  const result = await getActiveStateLegislation(resolved.stateCode, page, pageSize);
  const canonicalSlug = statePageSlug(resolved.stateCode) ?? resolved.slug;

  return (
    <BillDirectory
      variant="state"
      eyebrow="STATE LEGISLATION"
      title={`${resolved.name} bills.`}
      intro={`Active bills in ${resolved.name}'s current legislative session, mirrored from public legislative records.`}
      basePath={`/government/state/${canonicalSlug}`}
      result={result}
    />
  );
}
