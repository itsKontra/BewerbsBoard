import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { FittedCompetitorIdentity } from '../ui/FittedCompetitorIdentity';
import { participantLabel } from '../../utils/tv-competitor-helpers';
import { uiText } from '../../../../ui-text';

export interface OverallRankingRowProps {
  rank: number | null;
  fireBrigadeName: string;
  groupName?: string;
  secondaryGroupName?: string;
  isBrigadePairing?: boolean;
  score1Hundredths?: number | null;
  score2Hundredths?: number | null;
  attackTimeHundredths1?: number | null;
  attackTimeHundredths2?: number | null;
  runStatus1?: string | null;
  runStatus2?: string | null;
  totalScoreHundredths?: number | null;
  showTotal?: boolean;
  isUpcoming?: boolean;
  startsUpcomingSection?: boolean;
  theme: TvTheme;
  gridColumns?: string;
  identityClass?: string;
  rankClass?: string;
  scoreClass?: string;
}

function PairingContribution({
  groupName,
  scoreHundredths,
  attackTimeHundredths,
  runStatus,
  themeStyles,
}: {
  groupName?: string;
  scoreHundredths?: number | null;
  attackTimeHundredths?: number | null;
  runStatus?: string | null;
  themeStyles: (typeof TV_PRESENTATION_STYLES)[TvTheme];
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1">
      {groupName && (
        <div className={`max-w-full truncate font-oswald text-[clamp(1rem,1.3vw,1.35rem)] font-bold tracking-wide ${themeStyles.clockText}`}>
          {uiText.tv.groupName(groupName)}
        </div>
      )}
      <TimeWithPenalty
        scoreHundredths={scoreHundredths}
        attackTimeHundredths={attackTimeHundredths}
        runStatus={runStatus}
        themeStyles={themeStyles}
      />
    </div>
  );
}

function TimeWithPenalty({
  scoreHundredths,
  attackTimeHundredths,
  runStatus,
  themeStyles,
}: {
  scoreHundredths?: number | null;
  attackTimeHundredths?: number | null;
  runStatus?: string | null;
  themeStyles: (typeof TV_PRESENTATION_STYLES)[TvTheme];
}) {
  const isDnf = runStatus === 'DNF';
  const hasAttackTime = typeof attackTimeHundredths === 'number';
  const hasScore = typeof scoreHundredths === 'number';
  const penaltyHundredths = hasAttackTime && hasScore
    ? Math.max(0, scoreHundredths - attackTimeHundredths)
    : 0;

  return (
    <div className="inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.1rem,1.6vw,1.9rem)] font-black tabular-nums">
      <span className={themeStyles.score.time}>
        {isDnf ? uiText.tv.dnf : formatHundredthsToDisplayTime(hasAttackTime ? attackTimeHundredths : scoreHundredths)}
      </span>
      <span className="w-[5.5ch] text-left">
        {!isDnf && penaltyHundredths > 0 && (
          <span className={`inline-block rounded-md px-2 py-0.5 text-[0.85em] font-black leading-none ${themeStyles.score.penalty}`}>
            +{formatHundredthsToDisplayTime(penaltyHundredths).replace(' s', '')}
          </span>
        )}
      </span>
    </div>
  );
}

export function OverallRankingRow({
  rank,
  fireBrigadeName,
  groupName,
  secondaryGroupName,
  isBrigadePairing = false,
  score1Hundredths,
  score2Hundredths,
  attackTimeHundredths1,
  attackTimeHundredths2,
  runStatus1,
  runStatus2,
  totalScoreHundredths,
  showTotal = true,
  isUpcoming = false,
  startsUpcomingSection = false,
  theme,
  gridColumns = 'grid-cols-[6%_minmax(0,1fr)_20%_20%_22%]',
  identityClass = 'text-[clamp(1.15rem,2vw,2.25rem)]',
  rankClass = 'text-[clamp(1.25rem,2.1vw,2.4rem)]',
  scoreClass = 'text-[clamp(1.4rem,2.5vw,2.75rem)]',
}: OverallRankingRowProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];
  const participantText = isBrigadePairing
    ? fireBrigadeName
    : participantLabel({ fireBrigadeName, groupName });

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
        {showTotal && <td className="px-6 py-1.5" />}
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
          {rank ?? '—'}
        </span>
      </td>

      {/* Competitor Identity */}
      <td className="min-w-0 px-4 py-1.5">
        <FittedCompetitorIdentity className={`font-oswald font-black leading-tight tracking-wide ${themeStyles.competitorName} ${identityClass}`}>
          {participantText}
        </FittedCompetitorIdentity>
      </td>

      {/* Category 1 Score Column */}
      <td className={`px-4 py-1.5 text-center ${themeStyles.clockText}`}>
        {isBrigadePairing ? (
          <PairingContribution
            groupName={groupName}
            scoreHundredths={score1Hundredths}
            attackTimeHundredths={attackTimeHundredths1}
            runStatus={runStatus1}
            themeStyles={themeStyles}
          />
        ) : (
          <TimeWithPenalty
            scoreHundredths={score1Hundredths}
            attackTimeHundredths={attackTimeHundredths1}
            runStatus={runStatus1}
            themeStyles={themeStyles}
          />
        )}
      </td>

      {/* Category 2 Score Column */}
      <td className={`px-4 py-1.5 text-center ${themeStyles.clockText}`}>
        {isBrigadePairing ? (
          <PairingContribution
            groupName={secondaryGroupName}
            scoreHundredths={score2Hundredths}
            attackTimeHundredths={attackTimeHundredths2}
            runStatus={runStatus2}
            themeStyles={themeStyles}
          />
        ) : (
          <TimeWithPenalty
            scoreHundredths={score2Hundredths}
            attackTimeHundredths={attackTimeHundredths2}
            runStatus={runStatus2}
            themeStyles={themeStyles}
          />
        )}
      </td>

      {/* GESAMT (Total Score) Column if enabled */}
      {showTotal && (
        <td className={`whitespace-nowrap px-6 py-1.5 text-right font-mono font-black leading-none tabular-nums ${themeStyles.score.total} ${scoreClass}`}>
          {formatHundredthsToDisplayTime(totalScoreHundredths)}
        </td>
      )}
    </tr>
  );
}
