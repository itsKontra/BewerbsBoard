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
  variant?: 'broadcast' | 'industrial' | 'nordic';
}

export function TvPenaltyTag({
  penalties,
  variant = 'broadcast',
}: {
  penalties: number;
  variant?: 'broadcast' | 'industrial' | 'nordic';
}) {
  if (penalties <= 0) return null;

  if (variant === 'industrial') {
    return (
      <span
        aria-label={`${penalties} Fehler`}
        className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 font-teko text-sm font-black tracking-wider text-white border border-red-700 shadow-md whitespace-nowrap"
      >
        [+{penalties}]
      </span>
    );
  }

  if (variant === 'nordic') {
    return (
      <span
        aria-label={`${penalties} Fehler`}
        className="inline-flex items-center rounded-md bg-red-600/90 px-1.5 py-0.5 font-mono text-[11px] font-black text-white ring-1 ring-red-500/50 shadow-sm whitespace-nowrap"
      >
        [+{penalties}]
      </span>
    );
  }

  // broadcast default
  return (
    <span
      aria-label={`${penalties} Fehler`}
      className="inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 font-mono text-xs font-black text-white shadow-sm ring-1 ring-red-700/80 whitespace-nowrap drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]"
    >
      [+{penalties}]
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
  variant = 'broadcast',
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

      {/* Raw Time + Red Penalty Tag */}
      <div className={`inline-flex items-center gap-2 ${alignClass} whitespace-nowrap font-mono tabular-nums font-black`}>
        {isDnf ? (
          <span className="rounded bg-red-950/80 px-2 py-0.5 text-xs font-black text-red-400 border border-red-600/40">
            DNF
          </span>
        ) : displayTimeHundredths !== null ? (
          <>
            <span className={timeClass}>
              {formatHundredthsToDisplayTime(displayTimeHundredths)}
            </span>
            {penalty > 0 && <TvPenaltyTag penalties={penalty} variant={variant} />}
          </>
        ) : (
          <span className="text-slate-600 font-normal">—</span>
        )}
      </div>
    </div>
  );
}
