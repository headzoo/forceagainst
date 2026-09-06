import type { Metadata } from 'next';
import { createSiteMetadata } from '@/lib/site-metadata';
import { AdminReview } from './review';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Action review | Force Against Something',
  description: 'Review pending action submissions for the Force Against Something directory.',
  path: '/admin',
});

export default function AdminPage() {
  return <AdminReview />;
}
