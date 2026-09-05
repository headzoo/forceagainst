import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getCurrentCongressMembers, type PublicCongressMember } from '@/lib/db';
import { stateHeading } from '@/lib/us-states';
import { CongressMemberCard } from './congress-member-card';
import { FindRepresentatives } from './find-representatives';
import { GovernmentRosterNav } from './government-roster-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your Government | Force Against Something',
  description: 'Find your U.S. representatives and browse the current Senate and House roster.',
  openGraph: {
    url: '/government',
    title: 'Your Government | Force Against Something',
    description: 'Look up your congressional district and browse current U.S. senators and representatives.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'Your Government | Force Against Something',
    description: 'Look up your congressional district and browse current U.S. senators and representatives.',
    images: [],
  },
};

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
    <section className="government-roster-section" id={id} aria-labelledby={headingId}>
      <div className="government-roster-heading">
        <p className="eyebrow"><span /> CURRENT ROSTER</p>
        <h2 id={headingId}>{title}</h2>
        {note && <p>{note}</p>}
      </div>

      <div className="government-roster-groups">
        {grouped.map(([state, stateMembers]) => (
          <div className="government-state-group" id={`${chamberPrefix}-${state.toLowerCase()}`} key={state}>
            <h3>{stateHeading(state)}</h3>
            <div className="congress-member-grid">
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
    <main className="government-page">
      <SiteHeader />

      <section className="government-hero">
        <div className="government-heading">
          <Link className="back-link" href="/">← Back to all actions</Link>
          <p className="eyebrow"><span /> YOUR GOVERNMENT</p>
          <h1>Representatives<br />and Senators.</h1>
          <p>
            Look up who represents a U.S. street address, then browse the full current congressional roster mirrored from Congress.gov.
          </p>
        </div>
        <FindRepresentatives />
      </section>

      <section className="government-roster-shell" aria-labelledby="full-roster-heading">
        <div className="government-roster-intro">
          <p className="eyebrow"><span /> FULL ROSTER</p>
          <h2 id="full-roster-heading">Current Congress.</h2>
          <p>
            Delegates and the resident commissioner appear in the House roster. The District of Columbia and U.S. territories do not have voting senators.
          </p>
        </div>

        {members.length === 0 ? (
          <div className="government-roster-empty" role="status">
            <h3>Roster setup in progress.</h3>
            <p>
              The congressional directory has not been populated yet. Once the roster sync completes, current senators and representatives will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="government-roster-layout">
            <GovernmentRosterNav
              chambers={[
                { id: 'us-senate', title: 'U.S. Senate', prefix: 'senate', states: senateStates },
                { id: 'us-house', title: 'U.S. House', prefix: 'house', states: houseStates },
              ]}
            />
            <div className="government-roster-main">
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
