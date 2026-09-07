import type { Metadata } from 'next';
import { createSiteMetadata } from '@/lib/site-metadata';
import { AccountSettings } from './settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Account settings | Force Against Something',
  description: 'Manage your Force Against Something profile, password, passkey, avatar, and blocked accounts.',
  path: '/account',
});

export default function AccountPage() {
  return <AccountSettings />;
}
