import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { getCurrentCongressMembers, type PublicCongressMember } from '@/lib/db';
import { CongressMemberCard } from './congress-member-card';
import { FindRepresentatives } from './find-representatives';

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

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
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

function stateHeading(state: string) {
  return STATE_NAMES[state] ? `${STATE_NAMES[state]} (${state})` : state;
}

function RosterSection({
  title,
  members,
  note,
}: {
  title: string;
  members: PublicCongressMember[];
  note?: string;
}) {
  if (members.length === 0) return null;

  const grouped = groupByState(members);

  return (
    <section className="government-roster-section" aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <div className="government-roster-heading">
        <p className="eyebrow"><span /> CURRENT ROSTER</p>
        <h2 id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>{title}</h2>
        {note && <p>{note}</p>}
      </div>

      <div className="government-roster-groups">
        {grouped.map(([state, stateMembers]) => (
          <div className="government-state-group" key={state}>
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
          <>
            <RosterSection title="U.S. Senate" members={senators} />
            <RosterSection
              title="U.S. House"
              members={representatives}
              note="Includes voting representatives, delegates, and the resident commissioner for Puerto Rico."
            />
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
