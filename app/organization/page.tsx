import type { Metadata } from 'next';
import { createSiteMetadata } from '@/lib/site-metadata';
import { OrganizationSettings } from './settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Your organization | Force Against',
  description: 'Manage your organization profile and its action submissions on Force Against.',
  path: '/organization',
});

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const organizationId = Number((await searchParams).organizationId);
  return <OrganizationSettings initialOrganizationId={Number.isSafeInteger(organizationId) && organizationId > 0 ? organizationId : null} />;
}
