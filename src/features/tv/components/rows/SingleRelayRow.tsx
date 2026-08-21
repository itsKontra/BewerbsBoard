import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { FittedCompetitorIdentity } from '../ui/FittedCompetitorIdentity';
import { participantLabel } from '../../utils/tv-competitor-helpers';

export interface SingleRelayRowProps {
  rank: number | null;
  fireBrigadeName: string;
  groupName?: string;
  attackTimeHundredths?: number | null;
  attackTimeErrors?: number | null;
  relayRaceHundredths?: number | null;
  relayRaceErrors?: number | null;
  totalScoreHundredths?: number | null;
  isUpcoming?: boolean;
  startsUpcomingSection?: boolean;
  theme: TvTheme;
  gridColumns?: string;
  identityClass?: string;
  rankClass?: string;
  scoreClass?: string;
}

export function SingleRelayRow({
  rank,
  fireBrigadeName,
  groupName,
  attackTimeHundredths,
  attackTimeErrors = 0,
  relayRaceHundredths,
  relayRaceErrors = 0,
  totalScoreHundredths,
  isUpcoming = false,
  startsUpcomingSection = false,
  theme,
  gridColumns = 'grid-cols-[6%_minmax(0,1fr)_18%_18%_20%]',
  identityClass = 'text-[clamp(1.15rem,2vw,2.25rem)]',
  rankClass = 'text-[clamp(1.25rem,2.1vw,2.4rem)]',
  scoreClass = 'text-[clamp(1.4rem,2.5vw,2.75rem)]',
}: SingleRelayRowProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];
  const participantText = participantLabel({ fireBrigadeName, groupName });

  const hasAttack = typeof attackTimeHundredths === 'number';
  const hasRelay = typeof relayRaceHundredths === 'number';
  const attackPenalty = (attackTimeErrors ?? 0) * 100;
  const relayPenalty = (relayRaceErrors ?? 0) * 100;

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
        <td className="px-4 py-1.5" />
        <td className="px-6 py-1.5" />
      </tr>
    );
  }

  return (
    <tr
      className={`grid min-h-0 items-center overflow-hidden ${gridColumns} ${rankLeadingClass}`}
      data-rank={rank ?? undefined}
      data-row-kind="ranked"
    >
      {/* Rank */}
      <td className="px-4 py-1.5 text-center">
        <span className={`inline-flex items-center justify-center font-oswald font-black ${rankClass} ${rankTextClass}`}>
          {rank}
        </span>
      </td>

      {/* Competitor Identity */}
      <td className="min-w-0 px-4 py-1.5">
        <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
          {participantText}
        </FittedCompetitorIdentity>
      </td>

      {/* Attack Time & Errors */}
      <td className="px-4 py-1.5 text-center">
        <div className="inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.25rem,1.9vw,2rem)] font-black tabular-nums">
          <span className={themeStyles.score.time}>
            {hasAttack ? formatHundredthsToDisplayTime(attackTimeHundredths) : '—'}
          </span>
          <span className="w-[4ch] text-left">
            {attackPenalty > 0 && (
              <span className={`inline-block rounded-md px-2 py-0.5 text-[0.85em] font-black leading-none ${themeStyles.score.penalty}`}>
                +{attackTimeErrors}F
              </span>
            )}
          </span>
        </div>
      </td>

      {/* Relay Race Time & Errors */}
      <td className="px-4 py-1.5 text-center">
        <div className="inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.25rem,1.9vw,2rem)] font-black tabular-nums">
          <span className={themeStyles.score.time}>
            {hasRelay ? formatHundredthsToDisplayTime(relayRaceHundredths) : '—'}
          </span>
          <span className="w-[4ch] text-left">
            {relayPenalty > 0 && (
              <span className={`inline-block rounded-md px-2 py-0.5 text-[0.85em] font-black leading-none ${themeStyles.score.penalty}`}>
                +{relayRaceErrors}F
              </span>
            )}
          </span>
        </div>
      </td>

      {/* Total Score */}
      <td className={`whitespace-nowrap px-6 py-1.5 text-right font-mono font-black leading-none tabular-nums ${themeStyles.score.total} ${scoreClass}`}>
        {formatHundredthsToDisplayTime(totalScoreHundredths)}
      </td>
    </tr>
  );
}
