import type { Metadata } from 'next';
import { BillDirectory } from '@/app/government/bill-directory';
import { getActiveFederalLegislation } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';

const BASE_PATH = '/government/senate';

export const metadata: Metadata = createSiteMetadata({
  title: 'U.S. Senate Bills | Force Against',
  description: 'Browse active federal bills originating in the U.S. Senate for the current Congress.',
  path: BASE_PATH,
});

type FederalBillDirectoryPageProps = {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
};

export default async function SenateBillDirectoryPage({ searchParams }: FederalBillDirectoryPageProps) {
  const query = await searchParams;
  const page = Array.isArray(query.page) ? query.page[0] : query.page;
  const pageSize = Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize;
  const result = await getActiveFederalLegislation('senate', page, pageSize);

  return (
    <BillDirectory
      variant="federal"
      eyebrow="FEDERAL LEGISLATION"
      title="Senate bills."
      intro="Active federal bills originating in the U.S. Senate for the current Congress."
      note="Latest reported action, committee activity, enrollment, or executive review may involve the House, a committee, or the executive branch even though these bills originated in the Senate."
      basePath={BASE_PATH}
      result={result}
      showOriginChamber
    />
  );
}
