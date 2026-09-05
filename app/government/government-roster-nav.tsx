import { stateName } from '@/lib/us-states';

type ChamberNav = {
  id: string;
  title: string;
  prefix: 'senate' | 'house';
  states: string[];
};

type GovernmentRosterNavProps = {
  chambers: ChamberNav[];
};

export function GovernmentRosterNav({ chambers }: GovernmentRosterNavProps) {
  if (chambers.every((chamber) => chamber.states.length === 0)) return null;

  return (
    <nav className="government-roster-nav" aria-label="Jump to state">
      <p className="eyebrow"><span /> JUMP TO</p>
      {chambers.map((chamber) => (
        chamber.states.length === 0 ? null : (
          <div className="government-roster-nav-chamber" key={chamber.id}>
            <a className="government-roster-nav-chamber-link" href={`#${chamber.id}`}>
              {chamber.title}
            </a>
            <ul className="government-roster-nav-states">
              {chamber.states.map((state) => {
                const label = stateName(state);
                return (
                  <li key={`${chamber.id}-${state}`}>
                    <a href={`#${chamber.prefix}-${state.toLowerCase()}`} aria-label={label}>
                      <span className="government-roster-nav-state-full">{label}</span>
                      <span className="government-roster-nav-state-abbr" aria-hidden="true">{state}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ))}
    </nav>
  );
}
