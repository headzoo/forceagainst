import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { s } from '@/app/tailwind-styles';
import { ActionGovernmentWriter } from '@/app/government/action-government-writer';
import { getCurrentCongressMemberByBioguideId, getPublishedAction } from '@/lib/db';
import { buildGovernmentActionContext } from '@/lib/government-action-context';
import { createSiteMetadata } from '@/lib/site-metadata';
import { stateHeading } from '@/lib/us-states';
import { LetterBuilder } from './letter-builder';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Write Your Representative | Force Against Something',
  description: 'Build, copy, and download a letter to your representative.',
  path: '/government/write',
});

type WritePageProps = {
  searchParams: Promise<{ rep?: string | string[]; action?: string | string[] }>;
};

function positiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function constituencyLabel(chamber: 'house' | 'senate', state: string, district: number | null) {
  if (chamber === 'senate') return stateHeading(state);
  if (district === 0) return `${stateHeading(state)} at-large district`;
  if (district != null) return `District ${district}`;
  return stateHeading(state);
}

export default async function GovernmentWritePage({ searchParams }: WritePageProps) {
  const params = await searchParams;
  const rep = Array.isArray(params.rep) ? params.rep[0] : params.rep;
  const actionValue = Array.isArray(params.action) ? params.action[0] : params.action;
  const actionId = positiveInteger(actionValue);
  const action = actionId ? await getPublishedAction(actionId) : undefined;
  const actionContext = action ? buildGovernmentActionContext(action) : undefined;
  const backHref = action ? `/a/${action.issueSlug}/${action.slug}` : '/government';
  const backLabel = action ? 'Back to the action' : 'Back to your government';

  if (!rep) {
    return (
      <main className={s.governmentWritePage}>
        <SiteHeader />

        <section className={s.governmentWriteHero}>
          <Link className={s.backLink} href={backHref}>&larr; {backLabel}</Link>
          <p className={s.eyebrow}><span /> LETTER BUILDER</p>
          <h1>Choose who<br />to write.</h1>
          <p>
            Select one of your saved representatives, or enter your address to find the federal officials who represent you.
          </p>
        </section>

        <section className={s.governmentWritePicker} aria-label="Choose a representative">
          <ActionGovernmentWriter actionId={actionContext?.id} actionTitle={actionContext?.title} openOnMount triggerLabel="Choose a representative" />
        </section>

        <SiteFooter />
      </main>
    );
  }

  if (!/^[A-Z]\d{6}$/i.test(rep)) notFound();

  const member = await getCurrentCongressMemberByBioguideId(rep.toUpperCase());
  if (!member) notFound();

  const recipientAddress = member.mailingAddress
    || member.capitolOffice
    || `United States Capitol\nWashington, DC ${member.chamber === 'senate' ? '20510' : '20515'}`;
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(new Date());

  return (
    <main className={s.governmentWritePage}>
      <SiteHeader />

      <section className={s.governmentWriteHero}>
        <Link className={s.backLink} href={backHref}>&larr; {backLabel}</Link>
        <p className={s.eyebrow}><span /> LETTER BUILDER</p>
        <h1>Write to<br />{member.lastName}.</h1>
        <p>
          {actionContext
            ? <>We added a starting point from “{actionContext.title}.” Review every outlined field and make the letter your own. Your draft is saved only in this browser.</>
            : 'Select any outlined field in the letter to add your words. Your draft is saved only in this browser.'}
        </p>
      </section>

      <LetterBuilder
        key={`${member.bioguideId}:${actionContext?.id ?? 'general'}`}
        member={{
          bioguideId: member.bioguideId,
          officialFullName: member.officialFullName,
          lastName: member.lastName,
          displayTitle: member.displayTitle,
          chamber: member.chamber,
          recipientAddress,
          mailingAddress: member.mailingAddress ?? recipientAddress,
          contactFormUrl: member.contactFormUrl,
          officialWebsite: member.officialWebsite,
          defaultConstituency: constituencyLabel(member.chamber, member.state, member.district),
        }}
        dateLabel={dateLabel}
        actionContext={actionContext}
      />

      <SiteFooter />
    </main>
  );
}
