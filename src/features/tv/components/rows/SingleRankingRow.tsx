import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { FittedCompetitorIdentity } from '../ui/FittedCompetitorIdentity';
import { participantLabel } from '../../utils/tv-competitor-helpers';

export interface SingleRankingRowProps {
  rank: number | null;
  fireBrigadeName: string;
  groupName?: string;
  scoreHundredths?: number | null;
  attackTimeHundredths?: number | null;
  isUpcoming?: boolean;
  startsUpcomingSection?: boolean;
  theme: TvTheme;
  gridColumns?: string;
  identityClass?: string;
  rankClass?: string;
}

export function SingleRankingRow({
  rank,
  fireBrigadeName,
  groupName,
  scoreHundredths,
  attackTimeHundredths,
  isUpcoming = false,
  startsUpcomingSection = false,
  theme,
  gridColumns = 'grid-cols-[6%_minmax(0,1fr)_24%]',
  identityClass = 'text-[clamp(1.15rem,2vw,2.25rem)]',
  rankClass = 'text-[clamp(1.25rem,2.1vw,2.4rem)]',
}: SingleRankingRowProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];
  const participantText = participantLabel({ fireBrigadeName, groupName });

  const hasAttack = typeof attackTimeHundredths === 'number';
  const hasScore = typeof scoreHundredths === 'number';
  const penaltyHundredths = hasAttack && hasScore ? Math.max(0, scoreHundredths - attackTimeHundredths) : 0;
  const timeDisplay = formatHundredthsToDisplayTime(scoreHundredths ?? attackTimeHundredths);

  const { container: rankLeadingClass, rankNumber: rankTextClass } = themeStyles.row(rank);

  if (isUpcoming) {
    return (
      <tr
        className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-transparent ${themeStyles.rowBase} ${gridColumns} ${startsUpcomingSection ? themeStyles.upcomingBorder : ''}`}
        data-row-kind="upcoming"
      >
        <td className="px-4 py-1.5 text-center" />
        <td className="min-w-0 px-4 py-1.5">
          <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
            {participantText}
          </FittedCompetitorIdentity>
        </td>
        <td className="px-4 py-1.5" />
      </tr>
    );
  }

  return (
    <tr
      className={`grid min-h-0 items-center overflow-hidden ${gridColumns} ${rankLeadingClass}`}
      data-rank={rank ?? undefined}
      data-row-kind="ranked"
    >
      <td className="px-4 py-1.5 text-center">
        <span className={`inline-flex items-center justify-center font-oswald font-black ${rankClass} ${rankTextClass}`}>
          {rank}
        </span>
      </td>
      <td className="min-w-0 px-4 py-1.5">
        <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
          {participantText}
        </FittedCompetitorIdentity>
      </td>
      <td className="px-4 py-1.5 text-right">
        <div className="inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.25rem,1.9vw,2rem)] font-black tabular-nums">
          <span className={`text-right ${themeStyles.score.time}`}>
            {hasAttack ? formatHundredthsToDisplayTime(attackTimeHundredths) : timeDisplay}
          </span>
          <span className="w-[6ch] text-left">
            {penaltyHundredths > 0 && (
              <span className={`inline-block rounded-md px-2 py-0.5 text-[0.85em] font-black leading-none ${themeStyles.score.penalty}`}>
                +{formatHundredthsToDisplayTime(penaltyHundredths).replace(' s', '')}
              </span>
            )}
          </span>
        </div>
      </td>
    </tr>
  );
}
