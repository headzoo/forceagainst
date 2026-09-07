import { s } from '@/app/tailwind-styles';
import type { LegislativeLifecycleCounts } from '@/lib/legislative-bills';

type StageGroup = {
  id: string;
  label: string;
  description: string;
  stages: (keyof LegislativeLifecycleCounts)[];
};

const STAGE_GROUPS: StageGroup[] = [
  {
    id: 'introduced',
    label: 'Introduced',
    description: 'Filed and awaiting committee or floor action.',
    stages: ['introduced'],
  },
  {
    id: 'committee',
    label: 'In committee',
    description: 'Assigned to a committee for review.',
    stages: ['committee'],
  },
  {
    id: 'floor',
    label: 'Floor or other chamber',
    description: 'On a chamber floor or moving between chambers.',
    stages: ['floor', 'cross_chamber'],
  },
  {
    id: 'enrolled',
    label: 'Enrolled or executive',
    description: 'Enrolled for signature or awaiting executive action.',
    stages: ['enrolled', 'executive'],
  },
  {
    id: 'terminal',
    label: 'Terminal outcomes',
    description: 'Became law, vetoed, or failed. Active directories list only open bills.',
    stages: ['law', 'vetoed', 'failed'],
  },
  {
    id: 'unspecified',
    label: 'Unspecified stage',
    description:
      'Latest action could not be mapped to a precise stage. These bills are still active, not closed.',
    stages: ['other'],
  },
];

type LegislativeStageSummaryProps = {
  counts: LegislativeLifecycleCounts;
  total: number;
};

export function LegislativeStageSummary({ counts, total }: LegislativeStageSummaryProps) {
  return (
    <section className={s.legislativeStageSummary} aria-labelledby="lifecycle-summary-heading">
      <div className={s.legislativeStageSummaryIntro}>
        <h2 id="lifecycle-summary-heading">Active bill stages</h2>
        <p>
          {total === 0
            ? 'Counts reflect active bills in the current session once data is available.'
            : `${total.toLocaleString('en-US')} active bill${total === 1 ? '' : 's'} in the current session, grouped by latest reported stage.`}
        </p>
      </div>

      <dl className={s.legislativeStageSummaryGrid}>
        {STAGE_GROUPS.map((group) => {
          const count = group.stages.reduce((sum, stage) => sum + counts[stage], 0);

          return (
            <div className={s.legislativeStageSummaryItem} key={group.id}>
              <dt>
                <span className={s.legislativeStageSummaryCount}>{count.toLocaleString('en-US')}</span>
                <span className={s.legislativeStageSummaryLabel}>{group.label}</span>
              </dt>
              <dd>{group.description}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
