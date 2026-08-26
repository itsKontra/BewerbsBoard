import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { FittedCompetitorIdentity } from '../ui/FittedCompetitorIdentity';
import { participantLabel } from '../../utils/tv-competitor-helpers';
import { uiText } from '../../../../ui-text';

export interface CombinedRelayRowProps {
  rank: number | null;
  fireBrigadeName: string;
  groupName?: string;
  attackTimeHundredths1?: number | null;
  attackTimeErrors1?: number | null;
  relayRaceHundredths1?: number | null;
  relayRaceErrors1?: number | null;
  attackTimeHundredths2?: number | null;
  attackTimeErrors2?: number | null;
  relayRaceHundredths2?: number | null;
  relayRaceErrors2?: number | null;
  runStatus1?: string | null;
  runStatus2?: string | null;
  totalScoreHundredths?: number | null;
  isUpcoming?: boolean;
  startsUpcomingSection?: boolean;
  theme: TvTheme;
  gridColumns?: string;
  identityClass?: string;
  rankClass?: string;
  scoreClass?: string;
}

function CompactTimePenalty({
  timeHundredths,
  errors = 0,
  runStatus,
  themeStyles,
}: {
  timeHundredths?: number | null;
  errors?: number | null;
  runStatus?: string | null;
  themeStyles: (typeof TV_PRESENTATION_STYLES)[TvTheme];
}) {
  const isDnf = runStatus === 'DNF';
  const hasTime = typeof timeHundredths === 'number';
  const penalty = (errors ?? 0) * 100;

  return (
    <div className="inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.25rem,1.7vw,1.8rem)] font-black tabular-nums">
      <span className={themeStyles.score.time}>
        {isDnf ? uiText.tv.dnf : hasTime ? formatHundredthsToDisplayTime(timeHundredths) : '—'}
      </span>
      <span className="w-[3.5ch] text-left">
        {!isDnf && penalty > 0 && (
          <span className={`inline-block rounded-md px-2 py-0.5 text-[0.85em] font-black leading-none ${themeStyles.score.penalty}`}>
            +{errors}F
          </span>
        )}
      </span>
    </div>
  );
}

export function CombinedRelayRow({
  rank,
  fireBrigadeName,
  groupName,
  attackTimeHundredths1,
  attackTimeErrors1 = 0,
  relayRaceHundredths1,
  relayRaceErrors1 = 0,
  attackTimeHundredths2,
  attackTimeErrors2 = 0,
  relayRaceHundredths2,
  relayRaceErrors2 = 0,
  runStatus1,
  runStatus2,
  totalScoreHundredths,
  isUpcoming = false,
  startsUpcomingSection = false,
  theme,
  gridColumns = 'grid-cols-[5%_minmax(0,1fr)_14%_14%_14%_14%_17%]',
  identityClass = 'text-[clamp(1.15rem,2vw,2.25rem)]',
  rankClass = 'text-[clamp(1.25rem,2.1vw,2.4rem)]',
  scoreClass = 'text-[clamp(1.3rem,2.2vw,2.5rem)]',
}: CombinedRelayRowProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];
  const participantText = participantLabel({ fireBrigadeName, groupName });
  const { container: rankLeadingClass, rankNumber: rankTextClass } = themeStyles.row(rank);

  if (isUpcoming) {
    return (
      <tr
        className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-transparent ${themeStyles.rowBase} ${gridColumns} ${startsUpcomingSection ? themeStyles.upcomingBorder : ''}`}
        data-row-kind="upcoming"
      >
        <td className="px-3 py-1.5 text-center" />
        <td className="min-w-0 px-3 py-1.5">
          <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
            {participantText}
          </FittedCompetitorIdentity>
        </td>
        <td className="px-2 py-1.5" />
        <td className="px-2 py-1.5" />
        <td className="px-2 py-1.5" />
        <td className="px-2 py-1.5" />
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
      {/* Rank */}
      <td className="px-3 py-1.5 text-center">
        <span className={`inline-flex items-center justify-center font-oswald font-black ${rankClass} ${rankTextClass}`}>
          {rank ?? '—'}
        </span>
      </td>

      {/* Competitor Identity */}
      <td className="min-w-0 px-3 py-1.5">
        <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
          {participantText}
        </FittedCompetitorIdentity>
      </td>

      {/* Cat 1 Attack */}
      <td className="px-2 py-1.5 text-center">
        <CompactTimePenalty
          timeHundredths={attackTimeHundredths1}
          errors={attackTimeErrors1}
          runStatus={runStatus1}
          themeStyles={themeStyles}
        />
      </td>

      {/* Cat 1 Relay */}
      <td className="px-2 py-1.5 text-center">
        <CompactTimePenalty
          timeHundredths={relayRaceHundredths1}
          errors={relayRaceErrors1}
          runStatus={runStatus1}
          themeStyles={themeStyles}
        />
      </td>

      {/* Cat 2 Attack */}
      <td className="px-2 py-1.5 text-center">
        <CompactTimePenalty
          timeHundredths={attackTimeHundredths2}
          errors={attackTimeErrors2}
          runStatus={runStatus2}
          themeStyles={themeStyles}
        />
      </td>

      {/* Cat 2 Relay */}
      <td className="px-2 py-1.5 text-center">
        <CompactTimePenalty
          timeHundredths={relayRaceHundredths2}
          errors={relayRaceErrors2}
          runStatus={runStatus2}
          themeStyles={themeStyles}
        />
      </td>

      {/* Total Score */}
      <td className={`whitespace-nowrap px-4 py-1.5 text-right font-mono font-black leading-none tabular-nums ${themeStyles.score.total} ${scoreClass}`}>
        {formatHundredthsToDisplayTime(totalScoreHundredths)}
      </td>
    </tr>
  );
}
