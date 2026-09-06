import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getLikedActions } from '@/lib/db';
import { getMemberSession } from '@/lib/member';
import { LikedActionsList } from './liked-actions-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Liked actions | Force Against Something',
  description: 'The actions you liked on Force Against Something.',
};

export default async function LikedPage() {
  const session = await getMemberSession();
  const likedActions = session ? await getLikedActions(session.user.id) : [];

  return (
    <main>
      <SiteHeader />

      <section className={s.likedHero}>
        <div className={s.likedHeading}>
          <Link className={cn(s.backLink, s.likedBackLink)} href="/">← Back to all actions</Link>
          <p className={s.eyebrow}><span /> YOUR SHORTLIST</p>
          <h1 className={s.likedTitle}>Liked.</h1>
          <p className={s.likedHeadingCopy}>Keep the actions that matter to you close, then come back when you’re ready to make your move.</p>
        </div>
        <aside className={s.likedSummary}>
          <p className={s.step}>SAVED FOR LATER</p>
          <strong>{String(likedActions.length).padStart(2, '0')}</strong>
          <span>{likedActions.length === 1 ? 'action you want to remember.' : 'actions you want to remember.'}</span>
        </aside>
      </section>

      <section className={s.likedActionsSection} aria-label="Liked actions">
        {session ? (
          <LikedActionsList actions={likedActions} />
        ) : (
          <div className={s.likedEmpty}>
            <h2>Sign in to see your likes.</h2>
            <p>Use the sign-in button above, then every action you like will appear here.</p>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
