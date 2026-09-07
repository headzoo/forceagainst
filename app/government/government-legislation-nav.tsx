import { s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { STATE_PAGE_CODES, STATE_PAGE_SLUGS, stateName } from '@/lib/us-states';

const FEDERAL_DIRECTORIES = [
  { href: '/government/house', label: 'U.S. House bills', description: 'Bills originating in the House' },
  { href: '/government/senate', label: 'U.S. Senate bills', description: 'Bills originating in the Senate' },
] as const;

export function GovernmentLegislationNav() {
  return (
    <nav className={s.governmentLegislationNav} aria-label="Legislation directories">
      <div className={s.governmentLegislationFederal}>
        <h3 className={s.governmentLegislationGroupHeading}>Federal</h3>
        <ul className={s.governmentLegislationFederalList}>
          {FEDERAL_DIRECTORIES.map((directory) => (
            <li key={directory.href}>
              <Link className="group" href={directory.href}>
                <span className={s.governmentLegislationFederalLabel}>{directory.label}</span>
                <span className={s.governmentLegislationFederalDescription}>{directory.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className={s.governmentLegislationStates}>
        <h3 className={s.governmentLegislationGroupHeading}>States</h3>
        <ul className={s.governmentLegislationStateList}>
          {STATE_PAGE_CODES.map((code) => {
            const label = stateName(code);
            const slug = STATE_PAGE_SLUGS[code];
            return (
              <li key={code}>
                <Link href={`/government/state/${slug}`} aria-label={`${label} legislation`}>
                  <span className={s.governmentLegislationStateFull}>{label}</span>
                  <span className={s.governmentLegislationStateAbbr} aria-hidden="true">{code}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
