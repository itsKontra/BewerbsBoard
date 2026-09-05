import { useState, useEffect } from 'react';
import { formatHundredthsToDisplayTime } from '../../../../shared/utils/time-parser';
import { uiText } from '../../../ui-text';

export interface RunResultRow {
  entryId: string;
  runStatus?: 'OPEN' | 'VALID' | 'DNF' | string | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  scoreHundredths: number | null;
}

export interface RankedResultRow {
  rank: number | null;
  groupId: string;
  groupName: string;
  secondaryGroupName?: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
  scoreHundredths: number | null;
  primaryRun: RunResultRow;
  secondaryRun?: RunResultRow | null;
}

export interface OpenEntryRow {
  id?: string;
  groupId?: string;
  groupName: string;
  fireBrigadeId?: string;
  fireBrigadeName: string;
  startOrderPosition: number | null;
}

export interface DnfEntryRow {
  id?: string;
  groupId?: string;
  groupName: string;
  fireBrigadeId?: string;
  fireBrigadeName: string;
}

export interface CategoryResultData {
  id: string;
  displayName: string;
  publicEnabled: boolean;
  tvEnabled?: boolean;
  order: number;
  type: 'standard' | 'combined';
  isBrigadePairing?: boolean;
  showSingleResults?: boolean;
  hasRelayRace1?: boolean;
  hasRelayRace2?: boolean;
  excludeRelayRace?: boolean;
  categoryTypeName1?: string;
  categoryTypeName2?: string | null;
  rankedResults: RankedResultRow[];
  openEntries: OpenEntryRow[];
  dnfEntries: DnfEntryRow[];
}

export interface PublicResultsApiResponse {
  eventTitle: string;
  publicUrl: string;
  timestamp: number;
  categories: Record<string, CategoryResultData>;
}

const FALLBACK_CATEGORY_KEYS: string[] = [];

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === 1) return <span className="bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] inline-flex items-center justify-center w-8 h-8 rounded-full font-oswald font-extrabold text-sm border-2">1</span>;
  if (rank === 2) return <span className="bg-slate-300/20 text-slate-200 border-slate-400/50 shadow-[0_0_15px_rgba(148,163,184,0.2)] inline-flex items-center justify-center w-8 h-8 rounded-full font-oswald font-extrabold text-sm border-2">2</span>;
  if (rank === 3) return <span className="bg-amber-700/20 text-amber-400 border-amber-700/50 shadow-[0_0_15px_rgba(180,83,9,0.2)] inline-flex items-center justify-center w-8 h-8 rounded-full font-oswald font-extrabold text-sm border-2">3</span>;
  return <span className="bg-[#2a2a2a] text-neutral-400 border-neutral-700 inline-flex items-center justify-center w-7 h-7 rounded-full font-oswald font-bold text-xs border">{rank ?? '—'}</span>;
}

function participantLabel(item: { fireBrigadeName?: unknown; groupName?: unknown }) {
  return [item.fireBrigadeName, item.groupName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' ');
}

function Contribution({
  label,
  groupName,
  attackTimeHundredths,
  scoreHundredths,
  errors,
  mobileLabel,
  runStatus,
}: {
  label?: string;
  groupName?: string;
  attackTimeHundredths?: number | null;
  scoreHundredths?: number | null;
  errors?: number | null;
  mobileLabel?: string;
  runStatus?: RunResultRow['runStatus'];
}) {
  const isDnf = runStatus === 'DNF';
  const hasAttackTime = typeof attackTimeHundredths === 'number';
  const penaltyHundredths = hasAttackTime && typeof scoreHundredths === 'number'
    ? Math.max(0, scoreHundredths - attackTimeHundredths)
    : (typeof errors === 'number' ? errors * 100 : 0);
  const displayedTime = hasAttackTime
    ? formatHundredthsToDisplayTime(attackTimeHundredths)
    : formatHundredthsToDisplayTime(scoreHundredths ?? attackTimeHundredths);

  return (
    <div className="flex flex-col">
      {(label || groupName || mobileLabel) && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          <span className="min-[1025px]:hidden">
            {mobileLabel || label}
            {groupName && (
              <span className="ml-2 normal-case tracking-normal text-neutral-300">{groupName}</span>
            )}
          </span>
          <span className="hidden min-[1025px]:inline">{label}{label && groupName && <> · </>}{groupName}</span>
        </div>
      )}
      <div className={`${label || groupName || mobileLabel ? 'mt-1' : ''} flex items-baseline gap-1 whitespace-nowrap font-mono text-sm font-bold text-white`}>
        <span>{isDnf ? uiText.publicScoreboard.dnf : displayedTime}</span>
        {!isDnf && penaltyHundredths > 0 && (
          <span className="text-red-400">+ {formatHundredthsToDisplayTime(penaltyHundredths).replace(' s', '')}</span>
        )}
      </div>
    </div>
  );
}

function ResultsGrid({
  category,
}: {
  category: CategoryResultData;
}) {
  const isCombined = category.type === 'combined';
  const hasRelay1 = Boolean(category.hasRelayRace1 && !category.excludeRelayRace);
  const hasRelay2 = Boolean(category.hasRelayRace2 && !category.excludeRelayRace);
  const hasRelay = hasRelay1 || hasRelay2;
  const is4x2 = isCombined && hasRelay;
  const isSingleRelay = !isCombined && hasRelay1;

  const cat1Name = category.categoryTypeName1 || uiText.publicScoreboard.defaultDiscipline1;
  const cat2Name = category.categoryTypeName2 || uiText.publicScoreboard.defaultDiscipline2;

  // Determine desktop grid columns
  let desktopColumns = '48px 1fr 100px 40px 100px';
  let desktopRowColumns = 'min-[1025px]:grid-cols-[48px_minmax(0,1fr)_100px_40px_100px]';
  if (is4x2) {
    desktopColumns = '48px 1fr 90px 90px 90px 90px 100px';
    desktopRowColumns = 'min-[1025px]:grid-cols-[48px_minmax(0,1fr)_90px_90px_90px_90px_100px]';
  } else if (isCombined) {
    desktopColumns = '50px 1fr 140px 140px 130px';
    desktopRowColumns = 'min-[1025px]:grid-cols-[50px_minmax(0,1fr)_140px_140px_130px]';
  } else if (isSingleRelay) {
    desktopColumns = '50px 1fr 130px 130px 130px';
    desktopRowColumns = 'min-[1025px]:grid-cols-[50px_minmax(0,1fr)_130px_130px_130px]';
  }

  return (
    <div className="w-full">
      <div className="bg-[#181818]/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-3 min-[1025px]:p-6 shadow-2xl">
        <div className="flex flex-col landscape:max-lg:flex-row landscape:max-lg:items-center min-[1025px]:flex-row min-[1025px]:items-center justify-between gap-2 border-b border-neutral-800 pb-4 landscape:max-lg:pb-2 mb-4 landscape:max-lg:mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <h3 className="text-xl min-[1025px]:text-2xl font-black tracking-wide text-white uppercase font-oswald">
                {category.displayName}
              </h3>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 ml-4.5 font-medium">
              {isCombined
                ? uiText.publicScoreboard.combinedRanking
                : isSingleRelay
                  ? uiText.publicScoreboard.relayRanking
                  : uiText.publicScoreboard.standardRanking}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start min-[1025px]:self-auto text-xs font-mono bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-full text-neutral-400">
            <span>{uiText.publicScoreboard.evaluatedCount(category.rankedResults.length)}</span>
            {category.openEntries.length > 0 && (
              <>
                <span className="text-neutral-600">•</span>
                <span className="text-amber-400">{uiText.publicScoreboard.openCount(category.openEntries.length)}</span>
              </>
            )}
          </div>
        </div>

        <div
          className="hidden min-[1025px]:grid items-center gap-4 px-4 py-3 bg-neutral-900/60 rounded-xl text-neutral-400 font-oswald text-xs uppercase tracking-wider mb-2 border border-neutral-800/50"
          style={{ gridTemplateColumns: desktopColumns }}
          role="row"
        >
          <div className="text-center">{uiText.publicScoreboard.rank}</div>
          <div>{uiText.publicScoreboard.group}</div>
          {is4x2 && (
            <>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.disciplineLabel(cat1Name, uiText.publicScoreboard.attackShort)}</div>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.disciplineLabel(cat1Name, uiText.publicScoreboard.relayShort)}</div>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.disciplineLabel(cat2Name, uiText.publicScoreboard.attackShort)}</div>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.disciplineLabel(cat2Name, uiText.publicScoreboard.relayShort)}</div>
              <div className="text-right">{uiText.publicScoreboard.total}</div>
            </>
          )}
          {!is4x2 && isCombined && (
            <>
              <div className="text-center" role="columnheader">{cat1Name}</div>
              <div className="text-center" role="columnheader">{cat2Name}</div>
              <div className="text-right">{uiText.publicScoreboard.total}</div>
            </>
          )}
          {!isCombined && isSingleRelay && (
            <>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.attack}</div>
              <div className="text-center" role="columnheader">{uiText.publicScoreboard.relay}</div>
              <div className="text-right">{uiText.publicScoreboard.totalTime}</div>
            </>
          )}
          {!isCombined && !isSingleRelay && (
            <>
              <div className="text-right" role="columnheader">{uiText.publicScoreboard.attack}</div>
              <div />
              <div className="text-right">{uiText.publicScoreboard.totalTime}</div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 min-[1025px]:gap-1">
          {category.rankedResults.length === 0 && (
            <div className="text-center py-8 text-neutral-500 font-medium text-sm">
              {uiText.publicScoreboard.noResultsEntered}
            </div>
          )}

          {category.rankedResults.map((item, idx) => {
            const totalScore = item.scoreHundredths;
            const identity = category.isBrigadePairing
              ? item.fireBrigadeName
              : participantLabel(item);

            return (
              <div
                key={item.groupId || idx}
                role="row"
                className={`grid grid-cols-[2.5rem_minmax(0,1fr)] landscape:max-lg:grid-cols-[2.5rem_minmax(7rem,0.65fr)_minmax(23rem,2fr)] ${desktopRowColumns} items-center gap-x-3 gap-y-3 min-[1025px]:gap-4 p-3 min-[1025px]:p-4 rounded-xl border border-neutral-800/50 bg-neutral-900/20`}
              >
                <div className="flex justify-center"><RankBadge rank={item.rank} /></div>
                <div className="min-w-0 font-bold text-white text-sm truncate landscape:max-lg:line-clamp-2 landscape:max-lg:whitespace-normal landscape:max-lg:break-words landscape:max-lg:leading-tight">{identity}</div>

                {is4x2 && (
                  <div className="col-span-2 landscape:max-lg:col-span-1 grid min-w-0 gap-3 landscape:max-lg:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] landscape:max-lg:gap-x-2 landscape:max-lg:gap-y-2 bg-[#181818]/80 rounded-xl p-3 landscape:max-lg:p-2 min-[1025px]:contents min-[1025px]:bg-transparent min-[1025px]:p-0">
                    <div className="min-w-0 landscape:max-lg:contents min-[1025px]:contents">
                      <h4 className="mb-2 landscape:max-lg:mb-0 border-b landscape:max-lg:border-b-0 border-neutral-800/80 pb-1.5 landscape:max-lg:pb-0 landscape:max-lg:self-center font-oswald text-xs font-bold uppercase tracking-wider text-neutral-300 min-[1025px]:hidden">
                        {cat1Name}
                        {Boolean(category.isBrigadePairing) && (
                          <span className="ml-2 font-sans normal-case tracking-normal text-neutral-400">{uiText.publicScoreboard.groupName(item.groupName)}</span>
                        )}
                      </h4>
                      <div className="grid min-w-0 grid-cols-2 gap-3 landscape:max-lg:contents min-[1025px]:contents">
                        <div className="min-[1025px]:text-center">
                          <Contribution label={uiText.publicScoreboard.disciplineLabel(cat1Name, uiText.publicScoreboard.attack)} attackTimeHundredths={item.primaryRun?.attackTimeHundredths} errors={item.primaryRun?.attackTimeErrors} mobileLabel={uiText.publicScoreboard.attackShort} runStatus={item.primaryRun?.runStatus} />
                        </div>
                        <div className="min-[1025px]:text-center">
                          <Contribution label={uiText.publicScoreboard.disciplineLabel(cat1Name, uiText.publicScoreboard.relay)} attackTimeHundredths={item.primaryRun?.relayRaceHundredths} errors={item.primaryRun?.relayRaceErrors} mobileLabel={uiText.publicScoreboard.relayShort} runStatus={item.primaryRun?.runStatus} />
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 landscape:max-lg:contents border-t landscape:max-lg:border-none border-neutral-800/80 pt-3 landscape:max-lg:pt-0 min-[1025px]:contents min-[1025px]:border-none min-[1025px]:pt-0">
                      <h4 className="mb-2 landscape:max-lg:mb-0 border-b landscape:max-lg:border-b-0 border-neutral-800/80 pb-1.5 landscape:max-lg:pb-0 landscape:max-lg:self-center font-oswald text-xs font-bold uppercase tracking-wider text-neutral-300 min-[1025px]:hidden">
                        {cat2Name}
                        {Boolean(category.isBrigadePairing) && item.secondaryGroupName && (
                          <span className="ml-2 font-sans normal-case tracking-normal text-neutral-400">{uiText.publicScoreboard.groupName(item.secondaryGroupName)}</span>
                        )}
                      </h4>
                      <div className="grid min-w-0 grid-cols-2 gap-3 landscape:max-lg:contents min-[1025px]:contents">
                        <div className="min-[1025px]:text-center">
                          <Contribution label={uiText.publicScoreboard.disciplineLabel(cat2Name, uiText.publicScoreboard.attack)} attackTimeHundredths={item.secondaryRun?.attackTimeHundredths} errors={item.secondaryRun?.attackTimeErrors} mobileLabel={uiText.publicScoreboard.attackShort} runStatus={item.secondaryRun?.runStatus} />
                        </div>
                        <div className="min-[1025px]:text-center">
                          <Contribution label={uiText.publicScoreboard.disciplineLabel(cat2Name, uiText.publicScoreboard.relay)} attackTimeHundredths={item.secondaryRun?.relayRaceHundredths} errors={item.secondaryRun?.relayRaceErrors} mobileLabel={uiText.publicScoreboard.relayShort} runStatus={item.secondaryRun?.runStatus} />
                        </div>
                      </div>
                    </div>

                    <div className="landscape:max-lg:col-span-3 min-[1025px]:col-span-1 min-[1025px]:text-right pt-3 landscape:max-lg:pt-2 border-t border-neutral-800/80 min-[1025px]:border-none min-[1025px]:pt-0 flex justify-between min-[1025px]:justify-end items-center">
                      <span className="text-neutral-500 font-oswald text-xs uppercase min-[1025px]:hidden">{uiText.publicScoreboard.total}</span>
                      <span className="whitespace-nowrap font-mono font-bold text-amber-400 text-lg min-[1025px]:text-sm">{formatHundredthsToDisplayTime(totalScore)}</span>
                    </div>
                  </div>
                )}

                {!is4x2 && isCombined && Boolean(category.isBrigadePairing) && (
                  <div className="col-span-2 landscape:max-lg:col-span-1 grid min-w-0 gap-3 landscape:max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] landscape:max-lg:gap-2 bg-[#181818]/80 rounded-xl p-3 landscape:max-lg:p-2 min-[1025px]:contents min-[1025px]:bg-transparent min-[1025px]:p-0">
                    <div className="pb-3 landscape:max-lg:pb-0 min-[1025px]:contents min-[1025px]:pb-0">
                      <div className="min-[1025px]:text-center">
                        <Contribution
                          label={cat1Name}
                          groupName={uiText.publicScoreboard.groupName(item.groupName)}
                          attackTimeHundredths={item.primaryRun?.attackTimeHundredths}
                          scoreHundredths={item.primaryRun?.scoreHundredths}
                          errors={item.primaryRun?.attackTimeErrors}
                          mobileLabel={cat1Name}
                          runStatus={item.primaryRun?.runStatus}
                        />
                      </div>
                    </div>
                    <div className="border-t landscape:max-lg:border-none border-neutral-800/80 pt-3 landscape:max-lg:pt-0 min-[1025px]:contents min-[1025px]:border-none min-[1025px]:pt-0">
                      <div className="min-[1025px]:text-center">
                        <Contribution
                          label={cat2Name}
                          groupName={item.secondaryGroupName
                            ? uiText.publicScoreboard.groupName(item.secondaryGroupName)
                            : undefined}
                          attackTimeHundredths={item.secondaryRun?.attackTimeHundredths}
                          scoreHundredths={item.secondaryRun?.scoreHundredths}
                          errors={item.secondaryRun?.attackTimeErrors}
                          mobileLabel={cat2Name}
                          runStatus={item.secondaryRun?.runStatus}
                        />
                      </div>
                    </div>
                    <div className="min-[1025px]:col-span-1 min-[1025px]:text-right pt-3 landscape:max-lg:pt-0 border-t landscape:max-lg:border-none border-neutral-800/80 min-[1025px]:border-none min-[1025px]:pt-0 flex landscape:max-lg:flex-col landscape:max-lg:items-end justify-between min-[1025px]:justify-end items-center">
                      <span className="text-neutral-500 font-oswald text-xs uppercase min-[1025px]:hidden">{uiText.publicScoreboard.total}</span>
                      <span className="whitespace-nowrap font-mono font-bold text-amber-400 text-lg min-[1025px]:text-sm">{formatHundredthsToDisplayTime(totalScore)}</span>
                    </div>
                  </div>
                )}

                {!is4x2 && isCombined && !category.isBrigadePairing && (
                  <div className="col-span-2 landscape:max-lg:col-span-1 grid min-w-0 grid-cols-2 landscape:max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 bg-[#181818]/80 rounded-xl p-2 min-[1025px]:contents min-[1025px]:bg-transparent min-[1025px]:p-0">
                    <div className="min-[1025px]:text-center">
                      <Contribution
                        label={cat1Name}
                        attackTimeHundredths={item.primaryRun?.attackTimeHundredths}
                        scoreHundredths={item.primaryRun?.scoreHundredths}
                        errors={item.primaryRun?.attackTimeErrors}
                        mobileLabel={cat1Name}
                        runStatus={item.primaryRun?.runStatus}
                      />
                    </div>
                    <div className="min-[1025px]:text-center">
                      <Contribution
                        label={cat2Name}
                        attackTimeHundredths={item.secondaryRun?.attackTimeHundredths}
                        scoreHundredths={item.secondaryRun?.scoreHundredths}
                        errors={item.secondaryRun?.attackTimeErrors}
                        mobileLabel={cat2Name}
                        runStatus={item.secondaryRun?.runStatus}
                      />
                    </div>
                    <div className="col-span-2 landscape:max-lg:col-span-1 min-[1025px]:col-span-1 min-[1025px]:text-right pt-3 landscape:max-lg:pt-0 mt-1 landscape:max-lg:mt-0 border-t landscape:max-lg:border-none border-neutral-800/80 min-[1025px]:border-none min-[1025px]:pt-0 min-[1025px]:mt-0 flex landscape:max-lg:flex-col landscape:max-lg:items-end justify-between min-[1025px]:justify-end items-center">
                      <span className="text-neutral-500 font-oswald text-xs uppercase min-[1025px]:hidden">{uiText.publicScoreboard.total}</span>
                      <span className="whitespace-nowrap font-mono font-bold text-amber-400 text-lg min-[1025px]:text-sm">{formatHundredthsToDisplayTime(totalScore)}</span>
                    </div>
                  </div>
                )}

                {!isCombined && isSingleRelay && (
                  <div className="col-span-2 landscape:max-lg:col-span-1 grid min-w-0 grid-cols-2 landscape:max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 bg-[#181818]/80 rounded-xl p-2 min-[1025px]:contents min-[1025px]:bg-transparent min-[1025px]:p-0">
                    <div className="min-[1025px]:text-center">
                      <Contribution label={uiText.publicScoreboard.attack} attackTimeHundredths={item.primaryRun?.attackTimeHundredths} errors={item.primaryRun?.attackTimeErrors} mobileLabel={uiText.publicScoreboard.attack} runStatus={item.primaryRun?.runStatus} />
                    </div>
                    <div className="min-[1025px]:text-center">
                      <Contribution label={uiText.publicScoreboard.relay} attackTimeHundredths={item.primaryRun?.relayRaceHundredths} errors={item.primaryRun?.relayRaceErrors} mobileLabel={uiText.publicScoreboard.relay} runStatus={item.primaryRun?.runStatus} />
                    </div>
                    <div className="col-span-2 landscape:max-lg:col-span-1 min-[1025px]:col-span-1 min-[1025px]:text-right pt-3 landscape:max-lg:pt-0 mt-1 landscape:max-lg:mt-0 border-t landscape:max-lg:border-none border-neutral-800/80 min-[1025px]:border-none min-[1025px]:pt-0 min-[1025px]:mt-0 flex landscape:max-lg:flex-col landscape:max-lg:items-end justify-between min-[1025px]:justify-end items-center">
                      <span className="text-neutral-500 font-oswald text-xs uppercase min-[1025px]:hidden">{uiText.publicScoreboard.totalTime}</span>
                      <span className="whitespace-nowrap font-mono font-bold text-amber-400 text-xl min-[1025px]:text-sm">{formatHundredthsToDisplayTime(totalScore)}</span>
                    </div>
                  </div>
                )}

                {!isCombined && !isSingleRelay && (
                  <div className="col-span-2 landscape:max-lg:col-span-1 grid min-w-0 grid-cols-2 gap-2 bg-[#181818]/80 rounded-xl p-2 min-[1025px]:contents min-[1025px]:bg-transparent min-[1025px]:p-0">
                    <div className="min-[1025px]:text-right">
                      <Contribution label="" attackTimeHundredths={item.primaryRun?.attackTimeHundredths} scoreHundredths={totalScore} errors={item.primaryRun?.attackTimeErrors} mobileLabel={uiText.publicScoreboard.attack} runStatus={item.primaryRun?.runStatus} />
                    </div>
                    <div className="hidden min-[1025px]:flex justify-center items-center font-mono text-lg font-bold text-neutral-600">=</div>
                    <div className="col-span-2 landscape:max-lg:col-span-1 min-[1025px]:col-span-1 min-[1025px]:text-right pt-3 landscape:max-lg:pt-0 mt-1 landscape:max-lg:mt-0 border-t landscape:max-lg:border-none border-neutral-800/80 min-[1025px]:border-none min-[1025px]:pt-0 min-[1025px]:mt-0 flex landscape:max-lg:flex-col landscape:max-lg:items-end justify-between min-[1025px]:justify-end items-center">
                      <span className="text-neutral-500 font-oswald text-xs uppercase min-[1025px]:hidden">{uiText.publicScoreboard.totalTime}</span>
                      <span className="whitespace-nowrap font-mono font-bold text-amber-400 text-xl min-[1025px]:text-sm">{formatHundredthsToDisplayTime(totalScore)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PublicScoreboard() {
  const [data, setData] = useState<PublicResultsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>(FALLBACK_CATEGORY_KEYS[0] ?? '');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchResults = async (isInitial = false) => {
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    if (isDemoMode) {
      try {
        const { DEMO_RESULTS_DATA } = await import('../../../mock/demo-scoreboard-data');
        setData(DEMO_RESULTS_DATA as unknown as PublicResultsApiResponse);
        setLastUpdated(new Date());
        setError(null);
      } catch (err: any) {
        if (isInitial) {
          setError(err.message || uiText.publicScoreboard.resultsCouldNotBeLoaded);
        }
      } finally {
        if (isInitial) setLoading(false);
      }
      return;
    }
    try {
      const res = await fetch('/api/public/results');
      if (!res.ok) {
        throw new Error(uiText.publicScoreboard.resultsLoadError(res.status));
      }
      const json: PublicResultsApiResponse = await res.json();
      setData(json);
      setSelectedCategoryKey((current) => {
        if (json.categories[current] && json.categories[current].publicEnabled !== false) return current;
        return Object.entries(json.categories)
          .filter(([, category]) => category.publicEnabled !== false)
          .sort(([, left], [, right]) => (left.order ?? 99) - (right.order ?? 99))[0]?.[0] ?? '';
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (isInitial) {
        setError(err.message || uiText.publicScoreboard.resultsCouldNotBeLoaded);
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchResults(true);
    const interval = setInterval(() => {
      fetchResults(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const categoryEntries = data?.categories ? Object.entries(data.categories) : [];
  const visibleCategoryKeys = categoryEntries.length > 0
    ? categoryEntries
      .filter(([, cat]) => cat.publicEnabled !== false)
      .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
      .map(([key]) => key)
    : FALLBACK_CATEGORY_KEYS;

  useEffect(() => {
    if (data?.categories) {
      const currentCat = data.categories[selectedCategoryKey];
      if (!currentCat || currentCat.publicEnabled === false) {
        const firstVisible = visibleCategoryKeys[0];
        if (firstVisible) {
          setSelectedCategoryKey(firstVisible);
        }
      }
    }
  }, [data, selectedCategoryKey, visibleCategoryKeys]);

  const handleCategorySwitch = (catKey: string) => {
    if (selectedCategoryKey === catKey) return;
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setSelectedCategoryKey(catKey);
      });
    } else {
      setSelectedCategoryKey(catKey);
    }
  };

  const activeCategory: CategoryResultData | undefined = data?.categories[selectedCategoryKey];

  return (
    <div className="min-h-screen bg-[#111111] text-neutral-100 font-sans flex flex-col selection:bg-[#b90000] selection:text-white">
      {/* Header */}
      <header className="relative bg-[#181818] text-white border-b border-[#b90000]/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-30">
        <div className="absolute inset-0 bg-gradient-to-r from-[#8d0000]/20 via-transparent to-[#1a1a1a] opacity-60 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 font-oswald">
                {uiText.publicScoreboard.livePolling}
              </span>
            </div>
            <h1 className="font-oswald text-2xl md:text-3xl font-extrabold tracking-wide uppercase drop-shadow-md text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400">
              {data?.eventTitle || uiText.publicScoreboard.defaultCompetitionTitle}
            </h1>
          </div>
        </div>
      </header>

      {/* Category Selection Bar */}
      <nav className="bg-[#151515]/80 backdrop-blur-lg border-b border-neutral-800/80 sticky top-0 z-20 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2.5 overflow-x-auto snap-x scroll-px-4 hide-scrollbar">
          {visibleCategoryKeys.map((catKey) => {
            const cat = data?.categories[catKey];
            const isSelected = selectedCategoryKey === catKey;
            const displayName = cat?.displayName || catKey;

            return (
              <button
                key={catKey}
                onClick={() => handleCategorySwitch(catKey)}
                data-testid={`category-tab-${catKey}`}
                className={`snap-start flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full font-oswald text-sm uppercase tracking-wider font-semibold transition-all duration-300 ${isSelected
                    ? 'bg-gradient-to-r from-red-700 to-[#b90000] text-white shadow-[0_0_15px_rgba(185,0,0,0.4)] border border-red-500/40'
                    : 'bg-[#222222]/80 text-neutral-400 hover:bg-[#2e2e2e] hover:text-white border border-neutral-700/50 hover:border-neutral-500/50'
                  }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-grow" style={{ viewTransitionName: 'scoreboard-content' }}>
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
            <div className="w-12 h-12 border-4 border-[#b90000] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-oswald uppercase tracking-wider text-sm">{uiText.publicScoreboard.loadingResults}</p>
          </div>
        )}

        {error && !data && (
          <div className="bg-red-950/30 backdrop-blur-md border border-red-900/50 text-red-200 p-6 rounded-2xl text-center my-6 shadow-lg">
            <p className="font-bold mb-2 text-lg">{uiText.publicScoreboard.loadingErrorTitle}</p>
            <p className="text-sm opacity-80">{error}</p>
            <button
              onClick={() => fetchResults(true)}
              className="mt-4 px-5 py-2 bg-red-700 hover:bg-red-600 transition-colors text-white font-oswald text-sm uppercase font-semibold rounded-lg"
            >
              {uiText.publicScoreboard.retry}
            </button>
          </div>
        )}

        {data && activeCategory && (
          <div className="space-y-10">
            {/* Category Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-neutral-800/80 pb-4 gap-2">
              <div>
                <h2 className="font-oswald text-2xl md:text-3xl font-bold tracking-wide uppercase text-white drop-shadow-sm">
                  {activeCategory.displayName}
                </h2>
              </div>
              {lastUpdated && (
                <span className="text-[11px] text-neutral-500 font-mono bg-neutral-900/50 px-2.5 py-1 rounded-md border border-neutral-800/50 self-start sm:self-auto">
                  {uiText.publicScoreboard.lastUpdated(lastUpdated.toLocaleTimeString('de-DE'))}
                </span>
              )}
            </div>

            {/* Ranked VALID Results */}
            <section>
              <h3 className="font-oswald text-sm font-bold tracking-widest uppercase text-amber-400 mb-4 flex items-center space-x-2">
                <span className="text-lg">🏆</span>
                <span>{uiText.publicScoreboard.rankingList}</span>
              </h3>

              {activeCategory.rankedResults.length === 0 ? (
                <div className="bg-[#222222]/50 backdrop-blur-sm border border-neutral-800/80 rounded-2xl p-10 text-center text-neutral-400 shadow-inner">
                  <p className="font-oswald text-base uppercase tracking-wider">{uiText.publicScoreboard.noRankedTimes}</p>
                </div>
              ) : (
                <ResultsGrid category={activeCategory} />
              )}
            </section>

            {/* Upcoming OPEN Groups Section */}
            {activeCategory.type === 'standard' && (
              <section>
                <h3 className="font-oswald text-sm font-bold tracking-widest uppercase text-sky-400 mb-4 flex items-center space-x-2">
                  <span className="text-lg">⏱️</span>
                  <span>{uiText.publicScoreboard.upcomingStarts}</span>
                </h3>

                {activeCategory.openEntries.length === 0 ? (
                  <div className="bg-[#222222]/50 border border-neutral-800/80 rounded-2xl p-6 text-center text-neutral-500 text-sm font-oswald uppercase">
                    {uiText.publicScoreboard.noPendingRuns}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeCategory.openEntries.map((item: any) => (
                      <div
                        key={item.id}
                        className="bg-[#222222]/60 backdrop-blur-md border border-neutral-800 hover:border-sky-500/50 p-4 rounded-2xl flex items-center space-x-4 transition-all shadow-md group hover:-translate-y-0.5 hover:shadow-sky-900/20 hover:shadow-lg"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-oswald font-bold text-sm rounded-full flex items-center justify-center group-hover:bg-sky-500/20 group-hover:scale-110 transition-transform">
                          #{item.startOrderPosition}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold text-white text-lg truncate tracking-tight">
                            {participantLabel(item)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* DNF Groups Section */}
            {activeCategory.type === 'standard' && activeCategory.dnfEntries.length > 0 && (
              <section>
                <h3 className="font-oswald text-sm font-bold tracking-widest uppercase text-red-500 mb-4 flex items-center space-x-2">
                  <span className="text-lg">❌</span>
                  <span>{uiText.publicScoreboard.disqualified}</span>
                </h3>

                <div className="bg-red-950/10 backdrop-blur-sm border border-red-900/30 rounded-2xl divide-y divide-red-900/20 overflow-hidden shadow-inner">
                  {activeCategory.dnfEntries.map((item: any) => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-red-900/10 transition-colors">
                      <div>
                        <span className="font-bold text-neutral-300 text-base">{item.fireBrigadeName}</span>
                        <span className="text-sm text-neutral-500 ml-2">({item.groupName})</span>
                      </div>
                      <span className="bg-red-950/80 text-red-400 text-[10px] font-oswald uppercase tracking-wider px-3 py-1 rounded-md border border-red-800/50 shadow-sm">
                        {uiText.publicScoreboard.dnf}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-neutral-800/60 py-6 text-center text-xs text-neutral-500 font-sans mt-auto">
        <p>{uiText.publicScoreboard.footer(new Date().getFullYear())}</p>
      </footer>
    </div>
  );
}
