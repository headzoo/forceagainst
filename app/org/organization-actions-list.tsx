'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ActionCardMeta } from '@/app/action-card-meta';
import type { PublicAction } from '@/lib/db';

type OrganizationActionCard = Pick<
  PublicAction,
  'id' | 'slug' | 'title' | 'detail' | 'type' | 'urgent' | 'effort' | 'commentCount'
> & { issue: string; issueSlug: string };

type ActionType = PublicAction['type'];
const filters: Array<'All' | ActionType> = ['All', 'Petition', 'Lawsuit', 'Campaign'];

export function OrganizationActionsList({ actions }: { actions: OrganizationActionCard[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const visible = useMemo(
    () => filter === 'All' ? actions : actions.filter((action) => action.type === filter),
    [actions, filter],
  );

  return (
    <div>
      <div className={s.filterRow} role="group" aria-label="Filter actions by type">
        {filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? s.filterActive : undefined} aria-pressed={filter === item}>{item} {item !== 'All' && <sup>{actions.filter((action) => action.type === item).length}</sup>}</button>)}
      </div>
      <div aria-live="polite">
        {visible.map((action) => (
          <article className={s.actionCard} key={action.id}>
            <div className={s.cardMain}>
              <h3><Link href={`/a/${action.issueSlug}/${action.slug}`}>{action.title}</Link></h3>
              <p>{action.detail}</p>
              <span className={s.organization}>
                <span className={s.typePill}>{action.type}</span>{action.urgent && <span className={cn(s.typePill, s.typePillUrgent)}>Priority</span>} <Link href={`/i/${action.issueSlug}`}>{action.issue.toUpperCase()}</Link>
              </span>
            </div>
            <div className={s.cardAction}><Link href={`/a/${action.issueSlug}/${action.slug}`} aria-label={`Learn more and take action: ${action.title}`}>TAKE ACTION <b aria-hidden="true">→</b></Link><ActionCardMeta commentCount={action.commentCount} effort={action.effort} /></div>
          </article>
        ))}
        {visible.length === 0 && <p className={s.emptyState}>{actions.length === 0 ? 'This organization has no published actions yet.' : 'No published actions match this filter yet.'}</p>}
      </div>
    </div>
  );
}
