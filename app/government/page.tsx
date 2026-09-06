import { cn, s } from '@/app/tailwind-styles';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getCurrentCongressMembers, type PublicCongressMember } from '@/lib/db';
import { createSiteMetadata } from '@/lib/site-metadata';
import { stateHeading } from '@/lib/us-states';
import { CongressMemberCard } from './congress-member-card';
import { FindRepresentatives } from './find-representatives';
import { GovernmentRosterNav } from './government-roster-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createSiteMetadata({
  title: 'Your Government | Force Against Something',
  description: 'Find your U.S. representatives and browse the current Senate and House roster.',
  path: '/government',
});

function groupByState(members: PublicCongressMember[]) {
  const groups = new Map<string, PublicCongressMember[]>();

  for (const member of members) {
    const current = groups.get(member.state) ?? [];
    current.push(member);
    groups.set(member.state, current);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function RosterSection({
  id,
  title,
  chamberPrefix,
  members,
  note,
}: {
  id: string;
  title: string;
  chamberPrefix: 'senate' | 'house';
  members: PublicCongressMember[];
  note?: string;
}) {
  if (members.length === 0) return null;

  const grouped = groupByState(members);
  const headingId = `${id}-heading`;

  return (
    <section className={s.governmentRosterSection} id={id} aria-labelledby={headingId}>
      <div className={s.governmentRosterHeading}>
        <p className={s.eyebrow}><span /> CURRENT ROSTER</p>
        <h2 id={headingId}>{title}</h2>
        {note && <p>{note}</p>}
      </div>

      <div className={s.governmentRosterGroups}>
        {grouped.map(([state, stateMembers]) => (
          <div className={s.governmentStateGroup} id={`${chamberPrefix}-${state.toLowerCase()}`} key={state}>
            <h3>{stateHeading(state)}</h3>
            <div className={s.congressMemberGrid}>
              {stateMembers.map((member) => (
                <CongressMemberCard key={member.bioguideId} member={member} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function GovernmentPage() {
  const members = await getCurrentCongressMembers();
  const senators = members.filter((member) => member.chamber === 'senate');
  const representatives = members.filter((member) => member.chamber === 'house');
  const senateStates = groupByState(senators).map(([state]) => state);
  const houseStates = groupByState(representatives).map(([state]) => state);

  return (
    <main className={s.governmentPage}>
      <SiteHeader />

      <section className={s.governmentHero}>
        <div className={s.governmentHeading}>
          <Link className={cn(s.backLink, s.governmentBackLink)} href="/">← Back to all actions</Link>
          <p className={s.eyebrow}><span /> YOUR GOVERNMENT</p>
          <h1 className={s.governmentTitle}>Representatives<br />and Senators.</h1>
          <p className={s.governmentHeadingCopy}>
            Look up who represents a U.S. street address, then browse the full current congressional roster mirrored from Congress.gov.
          </p>
        </div>
        <FindRepresentatives />
      </section>

      <section className={s.governmentRosterShell} aria-labelledby="full-roster-heading">
        <div className={s.governmentRosterIntro}>
          <p className={s.eyebrow}><span /> FULL ROSTER</p>
          <h2 id="full-roster-heading">Current Congress.</h2>
          <p>
            Delegates and the resident commissioner appear in the House roster. The District of Columbia and U.S. territories do not have voting senators.
          </p>
        </div>

        {members.length === 0 ? (
          <div className={s.governmentRosterEmpty} role="status">
            <h3>Roster setup in progress.</h3>
            <p>
              The congressional directory has not been populated yet. Once the roster sync completes, current senators and representatives will appear here automatically.
            </p>
          </div>
        ) : (
          <div className={s.governmentRosterLayout}>
            <GovernmentRosterNav
              chambers={[
                { id: 'us-senate', title: 'U.S. Senate', prefix: 'senate', states: senateStates },
                { id: 'us-house', title: 'U.S. House', prefix: 'house', states: houseStates },
              ]}
            />
            <div className={s.governmentRosterMain}>
              <RosterSection id="us-senate" title="U.S. Senate" chamberPrefix="senate" members={senators} />
              <RosterSection
                id="us-house"
                title="U.S. House"
                chamberPrefix="house"
                members={representatives}
                note="Includes voting representatives, delegates, and the resident commissioner for Puerto Rico."
              />
            </div>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
