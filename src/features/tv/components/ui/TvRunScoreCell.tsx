import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { parseRunPenalty } from '../../utils/tv-competitor-helpers';

export interface TvRunScoreCellProps {
  rawTimeHundredths?: number | null;
  errors?: number | null;
  scoreHundredths?: number | null;
  runStatus?: string | null;
  groupLabel?: string;
  disciplineLabel?: string;
  timeClass?: string;
  align?: 'left' | 'center' | 'right';
}

export function TvPenaltyTag({
  penalties,
}: {
  penalties: number;
}) {
  if (penalties <= 0) return null;

  return (
    <span
      aria-label={`${penalties} Fehler`}
      className="inline-block rounded-md bg-red-600 px-2 py-0.5 text-[0.85em] font-black leading-none text-white shadow-sm ring-1 ring-red-700/80 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)] whitespace-nowrap align-middle select-none"
    >
      +{penalties}
    </span>
  );
}

export function TvRunScoreCell({
  rawTimeHundredths,
  errors,
  scoreHundredths,
  runStatus,
  groupLabel,
  disciplineLabel,
  timeClass = 'text-white',
  align = 'center',
}: TvRunScoreCellProps) {
  const isDnf = runStatus === 'DNF';
  const hasRawTime = typeof rawTimeHundredths === 'number';
  const hasScore = typeof scoreHundredths === 'number';
  const displayTimeHundredths = hasRawTime ? rawTimeHundredths : hasScore ? scoreHundredths : null;

  const penalty = parseRunPenalty(errors, rawTimeHundredths, scoreHundredths);

  const alignClass =
    align === 'left'
      ? 'justify-start text-left'
      : align === 'right'
      ? 'justify-end text-right'
      : 'justify-center text-center';

  return (
    <div className={`flex flex-col ${alignClass} min-w-0`}>
      {/* Optional sub-discipline or group tag for combined boards */}
      {(groupLabel || disciplineLabel) && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
          {groupLabel && <span>{groupLabel}</span>}
          {disciplineLabel && <span className="text-cyan-400/90">{disciplineLabel}</span>}
        </div>
      )}

      {/* Raw Time + Red Penalty Tag (Reverted to original perfect font size clamp) */}
      <div className={`inline-grid grid-cols-[1fr_auto] items-baseline gap-1.5 whitespace-nowrap font-mono text-[clamp(1.25rem,1.9vw,2rem)] font-black tabular-nums ${alignClass}`}>
        <span className={timeClass}>
          {isDnf ? (
            <span className="rounded bg-red-950/80 px-2 py-0.5 text-[0.85em] font-black text-red-400 border border-red-600/40">
              DNF
            </span>
          ) : displayTimeHundredths !== null ? (
            formatHundredthsToDisplayTime(displayTimeHundredths)
          ) : (
            <span className="text-slate-600 font-normal">—</span>
          )}
        </span>

        <span className="w-[4ch] text-left">
          {!isDnf && penalty > 0 && <TvPenaltyTag penalties={penalty} />}
        </span>
      </div>
    </div>
  );
}
