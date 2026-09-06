import { cn, s } from '@/app/tailwind-styles';
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
    <nav className={s.governmentRosterNav} aria-label="Jump to state">
      <p className={cn(s.eyebrow, s.rosterNavEyebrow)}><span /> JUMP TO</p>
      {chambers.map((chamber) => (
        chamber.states.length === 0 ? null : (
          <div className={s.governmentRosterNavChamber} key={chamber.id}>
            <a className={s.governmentRosterNavChamberLink} href={`#${chamber.id}`}>
              {chamber.title}
            </a>
            <ul className={s.governmentRosterNavStates}>
              {chamber.states.map((state) => {
                const label = stateName(state);
                return (
                  <li key={`${chamber.id}-${state}`}>
                    <a href={`#${chamber.prefix}-${state.toLowerCase()}`} aria-label={label}>
                      <span className={s.governmentRosterNavStateFull}>{label}</span>
                      <span className={s.governmentRosterNavStateAbbr} aria-hidden="true">{state}</span>
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
