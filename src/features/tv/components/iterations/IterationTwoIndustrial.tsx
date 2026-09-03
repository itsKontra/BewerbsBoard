import { useState, useEffect } from 'react';
import type { TvStateApiResponse } from '../../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../../public/components/PublicScoreboard';
import type { RankingPresentationRow } from '../canvases/RankingCanvas';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { participantLabel } from '../../utils/tv-competitor-helpers';
import { TvQrPopupCard } from '../ui/TvQrPopupCard';
import { AdminAccessSplashCanvas } from '../canvases/AdminAccessSplashCanvas';
import { TvRunScoreCell } from '../ui/TvRunScoreCell';
import { AlertOctagon, Gauge, Flame, Award } from 'lucide-react';
import { uiText } from '../../../../ui-text';

export interface IterationTwoIndustrialProps {
  tvState: TvStateApiResponse;
  resultsData: PublicResultsApiResponse;
  activeCategory: CategoryResultData | undefined;
  visibleRankingRows: RankingPresentationRow[];
  rankingPresentationRowsCount: number;
  rankingPageIndex: number;
  rankingPageCount: number;
  isDisconnected?: boolean;
}

export function IterationTwoIndustrial({
  tvState,
  resultsData,
  activeCategory,
  visibleRankingRows,
  rankingPresentationRowsCount,
  rankingPageIndex,
  rankingPageCount,
  isDisconnected,
}: IterationTwoIndustrialProps) {
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('de-AT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const { eventTitle, mode } = tvState;
  const announcementHeadline = tvState.tvAnnouncement?.headline?.trim() ?? '';
  const announcementMessage = tvState.tvAnnouncement?.message?.trim() ?? '';
  const tvPresentation = tvState.tvPresentation ?? {
    theme: 'outdoor' as const,
    logoUrl: '/logo.png',
    headerLabel: 'Feuerwehr Leistungsbewerb',
    qrCodeEnabled: true,
    qrCodeAlwaysVisible: false,
    qrCodeIntervalSeconds: 30,
    qrCodeDurationSeconds: 10,
    adminSplashEnabled: false,
  };

  const isAdminSplashActive = tvPresentation.adminSplashEnabled ?? false;

  // Determine category layout
  const isCombined = activeCategory?.type === 'combined';
  const hasRelay1 = Boolean(activeCategory?.hasRelayRace1 && !activeCategory?.excludeRelayRace);
  const hasRelay2 = Boolean(activeCategory?.hasRelayRace2 && !activeCategory?.excludeRelayRace);
  const isBrigadePairing = Boolean(activeCategory?.isBrigadePairing);
  const cat1Name = activeCategory?.categoryTypeName1 || 'Gruppe 1';
  const cat2Name = activeCategory?.categoryTypeName2 || 'Gruppe 2';

  let layoutKind: 'standard' | 'single-relay' | 'combined' | 'combined-relay' = 'standard';
  let gridColumns = 'grid-cols-[7%_minmax(0,1fr)_30%]';

  if (isCombined) {
    if (hasRelay1 || hasRelay2) {
      layoutKind = 'combined-relay';
      gridColumns = 'grid-cols-[6%_minmax(0,1fr)_14%_14%_14%_14%_16%]';
    } else {
      layoutKind = 'combined';
      gridColumns = 'grid-cols-[7%_minmax(0,1fr)_22%_22%_20%]';
    }
  } else if (hasRelay1) {
    layoutKind = 'single-relay';
    gridColumns = 'grid-cols-[7%_minmax(0,1fr)_24%_24%]';
  }

  const rankedWinners = Array.isArray(activeCategory?.rankedResults)
    ? activeCategory.rankedResults.filter((r) => r.rank !== null).slice(0, 3)
    : [];

  return (
    <div
      className="fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-[#0c0e12] text-slate-100 font-sans"
      data-theme={tvPresentation.theme}
      data-testid="tv-shared-frame"
    >
      {/* Heavy Steel / Industrial apparatus background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(#ffffff 1.5px, transparent 1.5px), radial-gradient(#ffffff 1.5px, #0c0e12 1.5px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px',
        }}
      />

      {/* Floating QR Popup */}
      {!isAdminSplashActive && (
        <TvQrPopupCard
          publicUrl={resultsData.publicUrl}
          theme={tvPresentation.theme}
          enabled={tvPresentation.qrCodeEnabled ?? true}
          alwaysVisible={tvPresentation.qrCodeAlwaysVisible ?? false}
          intervalSeconds={tvPresentation.qrCodeIntervalSeconds ?? 30}
          durationSeconds={tvPresentation.qrCodeDurationSeconds ?? 10}
        />
      )}

      {/* TACTICAL APPARATUS HEADER */}
      <header
        aria-label="Tactical Iron Header"
        className="relative z-10 flex h-24 shrink-0 flex-col border-b-4 border-[#e2f802] bg-[#141820] px-6 sm:px-8 shadow-2xl"
      >
        {/* Top safety hazard chevron ribbon */}
        <div
          className="absolute top-0 left-0 right-0 h-2 bg-repeat-x opacity-90"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #e2f802, #e2f802 12px, #141820 12px, #141820 24px)',
          }}
        />

        <div className="flex flex-1 items-center justify-between pt-1">
          <div className="flex items-center gap-6 min-w-0">
            <div className="rounded-lg bg-black/60 p-1.5 border border-slate-700 shadow-inner">
              <img
                key={tvPresentation.logoUrl || '/logo.png'}
                data-testid="tv-header-logo"
                alt={uiText.tv.eventLogoAlt}
                className="max-h-12 w-auto max-w-36 shrink-0 object-contain"
                src={tvPresentation.logoUrl || '/logo.png'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-[#e2f802] px-2 py-0.5 font-teko text-sm font-black uppercase tracking-wider text-black">
                  <Gauge className="h-3.5 w-3.5" />
                  TACTICAL EINSATZBOARD
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
                  // {tvPresentation.headerLabel || 'FF Einsatzleitstelle'}
                </span>
              </div>
              <h1 className="truncate font-teko text-3xl sm:text-4xl font-black uppercase tracking-wider text-white drop-shadow">
                {eventTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {activeCategory && (
              <div className="flex items-center gap-2 rounded-lg border-2 border-[#e2f802] bg-black/80 px-4 py-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                <Flame className="h-5 w-5 text-[#e2f802]" />
                <span className="font-teko text-2xl font-black uppercase tracking-wide text-[#e2f802]">
                  {activeCategory.displayName}
                </span>
              </div>
            )}

            {isDisconnected && (
              <span className="rounded border border-red-500 bg-red-600 px-3 py-1 font-teko text-base font-black uppercase text-white animate-pulse">
                {uiText.tv.disconnected}
              </span>
            )}

            {/* Industrial Digital Clock Gauge */}
            <div className="flex items-center gap-2 rounded border border-slate-700 bg-black/90 px-3 py-1.5 font-mono text-lg font-black text-[#e2f802] shadow-inner">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{currentTime || '00:00:00'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      {isAdminSplashActive ? (
        <AdminAccessSplashCanvas
          theme={tvPresentation.theme}
          serverInfo={tvState.serverInfo}
        />
      ) : mode === 'MESSAGE' ? (
        <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="tv-mode-canvas">
          <div className="max-w-4xl rounded-2xl border-4 border-amber-500 bg-[#161b24] p-12 shadow-[0_0_80px_rgba(245,158,11,0.2)]">
            <div className="mb-6 inline-flex items-center gap-2 rounded bg-amber-500 px-4 py-1 font-teko text-xl font-black uppercase tracking-wider text-black">
              <AlertOctagon className="h-5 w-5" />
              EINSATZLEITUNG DURCHSAGE
            </div>
            <h2 className="font-teko text-6xl font-black uppercase tracking-wide text-white">
              {announcementHeadline || uiText.tv.noAnnouncement}
            </h2>
            {announcementMessage && (
              <p className="mt-6 font-sans text-2xl font-bold text-slate-300">
                {announcementMessage}
              </p>
            )}
          </div>
        </div>
      ) : mode === 'WINNERS' ? (
        <div className="flex flex-1 flex-col px-8 pb-6 text-center" data-testid="tv-mode-canvas">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded bg-[#e2f802] px-4 py-1 font-teko text-xl font-black uppercase tracking-wider text-black">
              <Award className="h-5 w-5" />
              {uiText.tv.winnersTitle}
            </span>
            <h2 className="mt-1 font-teko text-5xl font-black uppercase tracking-wider text-white">
              {activeCategory?.displayName ?? ''}
            </h2>
          </div>

          {rankedWinners.length === 0 ? (
            <div className="flex flex-1 items-center justify-center font-teko text-4xl uppercase tracking-widest text-slate-500">
              {uiText.tv.noResults}
            </div>
          ) : (
            <div className="flex flex-1 items-end justify-center gap-8 max-w-6xl mx-auto w-full pb-8">
              {/* P2: Silver Metal Pillar */}
              {rankedWinners[1] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 w-full rounded border-2 border-slate-500 bg-[#1a202c] p-3 text-center">
                    <span className="font-teko text-lg font-black uppercase text-slate-300">2. RANG</span>
                    <h3 className="truncate font-teko text-3xl font-black text-white">
                      {rankedWinners[1].fireBrigadeName}
                    </h3>
                    <p className="font-mono text-xl font-black text-slate-200">
                      {formatHundredthsToDisplayTime(rankedWinners[1].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[24vh] w-full rounded-t-lg border-t-8 border-slate-400 bg-slate-800 flex items-center justify-center font-teko text-7xl font-black text-slate-300 shadow-2xl">
                    2
                  </div>
                </div>
              )}

              {/* P1: Heavy Gold Apparatus */}
              {rankedWinners[0] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 w-full rounded border-4 border-[#e2f802] bg-[#1f271b] p-4 text-center shadow-[0_0_30px_rgba(226,248,2,0.3)]">
                    <span className="font-teko text-2xl font-black uppercase text-[#e2f802]">
                      ★ 1. PLATZ SIEGER ★
                    </span>
                    <h3 className="truncate font-teko text-4xl font-black text-white">
                      {rankedWinners[0].fireBrigadeName}
                    </h3>
                    <p className="font-mono text-3xl font-black text-[#e2f802]">
                      {formatHundredthsToDisplayTime(rankedWinners[0].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[32vh] w-full rounded-t-lg border-t-8 border-[#e2f802] bg-gradient-to-b from-[#e2f802]/80 to-[#141820] flex items-center justify-center font-teko text-9xl font-black text-black shadow-2xl">
                    1
                  </div>
                </div>
              )}

              {/* P3: Bronze Metal Pillar */}
              {rankedWinners[2] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 w-full rounded border-2 border-amber-700 bg-[#231a14] p-3 text-center">
                    <span className="font-teko text-lg font-black uppercase text-amber-500">3. RANG</span>
                    <h3 className="truncate font-teko text-3xl font-black text-white">
                      {rankedWinners[2].fireBrigadeName}
                    </h3>
                    <p className="font-mono text-xl font-black text-amber-400">
                      {formatHundredthsToDisplayTime(rankedWinners[2].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[18vh] w-full rounded-t-lg border-t-8 border-amber-700 bg-amber-950 flex items-center justify-center font-teko text-6xl font-black text-amber-600 shadow-2xl">
                    3
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* INDUSTRIAL TACTICAL TABLE */
        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6" data-testid="tv-mode-canvas">
          {!activeCategory ? (
            <div className="flex flex-1 items-center justify-center font-teko text-4xl uppercase tracking-widest text-slate-500">
              {uiText.tv.noActiveCategory}
            </div>
          ) : (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div className="flex-1 overflow-hidden rounded-xl border-2 border-slate-700 bg-[#12161f] shadow-2xl">
                <table
                  aria-label={uiText.tv.ranking(activeCategory.displayName)}
                  className="grid h-full w-full grid-rows-[3.5rem_minmax(0,1fr)] text-left"
                  data-density="full"
                >
                  {/* Table Header */}
                  <thead className="grid h-full items-center border-b-2 border-slate-700 bg-[#181e2b] font-teko text-2xl uppercase tracking-wider text-slate-300">
                    <tr className={`grid h-full items-center ${gridColumns}`}>
                      <th className="px-4 py-2 text-center text-[#e2f802]">RANG</th>
                      <th className="px-4 py-2 text-left">
                        {isBrigadePairing ? uiText.tv.fireBrigade : uiText.tv.participant}
                      </th>

                      {layoutKind === 'combined-relay' ? (
                        <>
                          <th className="px-2 py-2 text-center">{cat1Name} ANG</th>
                          <th className="px-2 py-2 text-center">{cat1Name} SL</th>
                          <th className="px-2 py-2 text-center">{cat2Name} ANG</th>
                          <th className="px-2 py-2 text-center">{cat2Name} SL</th>
                          <th className="px-4 py-2 text-right text-[#e2f802] font-black">GESAMT</th>
                        </>
                      ) : layoutKind === 'combined' ? (
                        <>
                          <th className="px-4 py-2 text-center">{cat1Name}</th>
                          <th className="px-4 py-2 text-center">{cat2Name}</th>
                          <th className="px-4 py-2 text-right text-[#e2f802] font-black">GESAMT</th>
                        </>
                      ) : layoutKind === 'single-relay' ? (
                        <>
                          <th className="px-4 py-2 text-center">ANGRIFF (ANG)</th>
                          <th className="px-4 py-2 text-center">STAFFELLAUF (SL)</th>
                        </>
                      ) : (
                        <th className="px-4 py-2 text-right">ANGRIFF (ANG)</th>
                      )}
                    </tr>
                  </thead>

                  {/* Table Rows */}
                  <tbody className="grid min-h-0 grid-rows-8 divide-y divide-slate-800">
                    {visibleRankingRows.length === 0 ? (
                      <tr className="flex items-center justify-center font-teko text-3xl uppercase tracking-widest text-slate-500">
                        <td colSpan={6}>{uiText.tv.noResults}</td>
                      </tr>
                    ) : (
                      visibleRankingRows.map((rowItem, idx) => {
                        if (rowItem.kind === 'upcoming') {
                          const upcoming = rowItem.entry;
                          const name = participantLabel({
                            fireBrigadeName: upcoming.fireBrigadeName,
                            groupName: upcoming.groupName,
                          });
                          return (
                            <tr
                              key={`upcoming-${idx}-${upcoming.fireBrigadeName}`}
                              className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-amber-500 bg-amber-500/5 ${gridColumns}`}
                              data-row-kind="upcoming"
                            >
                              <td className="px-4 py-1.5 text-center">
                                <span className="inline-block rounded bg-amber-500/20 px-2 py-0.5 font-teko text-base font-black text-amber-300 border border-amber-500/40">
                                  IN STARTBOX
                                </span>
                              </td>
                              <td className="min-w-0 px-4 py-1.5">
                                <div className="truncate font-teko text-2xl font-bold uppercase tracking-wide text-amber-200">
                                  {name}
                                </div>
                              </td>
                              <td className="px-4 py-1.5 text-slate-500 font-mono text-xs" colSpan={5}>
                                STARTPLATZ #{upcoming.startOrderPosition ?? '—'}
                              </td>
                            </tr>
                          );
                        }

                        // Ranked row
                        const result = rowItem.entry;
                        const rank = result.rank;
                        const isP1 = rank === 1;

                        const pName = isBrigadePairing
                          ? result.fireBrigadeName
                          : participantLabel({
                              fireBrigadeName: result.fireBrigadeName,
                              groupName: result.groupName,
                            });

                        const primary = result.primaryRun;
                        const secondary = result.secondaryRun;

                        const rowClass = isP1
                          ? 'border-l-4 border-l-[#e2f802] bg-[#1a2318]'
                          : rank === 2
                          ? 'border-l-4 border-l-slate-400 bg-slate-800/40'
                          : rank === 3
                          ? 'border-l-4 border-l-amber-700 bg-amber-950/20'
                          : 'border-l-4 border-l-transparent bg-[#141822]/60 hover:bg-[#181e2b]';

                        return (
                          <tr
                            key={`ranked-${result.groupId}-${rank}`}
                            className={`grid min-h-0 items-center overflow-hidden ${gridColumns} ${rowClass}`}
                            data-rank={rank ?? undefined}
                            data-row-kind="ranked"
                          >
                            {/* Rank polygon stamp */}
                            <td className="px-4 py-1.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-teko text-3xl font-black ${
                                  isP1 ? 'text-[#e2f802]' : 'text-slate-200'
                                }`}
                              >
                                {rank}
                              </span>
                            </td>

                            {/* Competitor Identity */}
                            <td className="min-w-0 px-4 py-1.5">
                              <div className="truncate font-teko text-2xl sm:text-3xl font-bold uppercase tracking-wide text-white">
                                {pName}
                              </div>
                            </td>

                            {/* Dynamic Timing Columns according to layout */}
                            {layoutKind === 'combined-relay' ? (
                              <>
                                {/* Cat 1 Attack */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.attackTimeHundredths}
                                    errors={primary?.attackTimeErrors}
                                    scoreHundredths={primary?.scoreHundredths}
                                    runStatus={primary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Cat 1 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Cat 2 Attack */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.attackTimeHundredths}
                                    errors={secondary?.attackTimeErrors}
                                    scoreHundredths={secondary?.scoreHundredths}
                                    runStatus={secondary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Cat 2 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.relayRaceHundredths}
                                    errors={secondary?.relayRaceErrors}
                                    runStatus={secondary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className="px-4 py-1 text-right font-mono font-black text-2xl text-[#e2f802] tabular-nums">
                                  {formatHundredthsToDisplayTime(result.scoreHundredths)}
                                </td>
                              </>
                            ) : layoutKind === 'combined' ? (
                              <>
                                {/* Group 1 */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.attackTimeHundredths}
                                    errors={primary?.attackTimeErrors}
                                    scoreHundredths={primary?.scoreHundredths}
                                    runStatus={primary?.runStatus}
                                    groupLabel={isBrigadePairing && result.groupName ? `Gr. ${result.groupName}` : undefined}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Group 2 */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.attackTimeHundredths}
                                    errors={secondary?.attackTimeErrors}
                                    scoreHundredths={secondary?.scoreHundredths}
                                    runStatus={secondary?.runStatus}
                                    groupLabel={isBrigadePairing && result.secondaryGroupName ? `Gr. ${result.secondaryGroupName}` : undefined}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className="px-4 py-1 text-right font-mono font-black text-2xl text-[#e2f802] tabular-nums">
                                  {formatHundredthsToDisplayTime(result.scoreHundredths)}
                                </td>
                              </>
                            ) : layoutKind === 'single-relay' ? (
                              <>
                                {/* Attack (ANG) */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.attackTimeHundredths}
                                    errors={primary?.attackTimeErrors}
                                    scoreHundredths={primary?.scoreHundredths}
                                    runStatus={primary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                                {/* Relay (SL) */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    variant="industrial"
                                  />
                                </td>
                              </>
                            ) : (
                              /* Standard: Only Angriff (ANG) time + penalties. Never hide in summed time! */
                              <td className="px-4 py-1 text-right">
                                <TvRunScoreCell
                                  rawTimeHundredths={primary?.attackTimeHundredths}
                                  errors={primary?.attackTimeErrors}
                                  scoreHundredths={primary?.scoreHundredths}
                                  runStatus={primary?.runStatus}
                                  align="right"
                                  variant="industrial"
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* INDUSTRIAL FOOTER */}
              <footer className="mt-3 flex shrink-0 items-center justify-between px-2 font-mono text-xs font-bold text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-200">
                    DURCHLAUF: SEITE {rankingPageIndex + 1} / {rankingPageCount}
                  </span>
                  <span>TEILNEHMER: {rankingPresentationRowsCount}</span>
                  <span>STATUS: WERTUNG AKTIV</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <span>/// BEWERBSBOARD TACTICAL SYSTEM ///</span>
                </div>
              </footer>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
