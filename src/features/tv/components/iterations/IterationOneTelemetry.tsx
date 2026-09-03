import type { TvStateApiResponse } from '../../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../../public/components/PublicScoreboard';
import type { RankingPresentationRow } from '../canvases/RankingCanvas';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { participantLabel } from '../../utils/tv-competitor-helpers';
import { TvQrPopupCard } from '../ui/TvQrPopupCard';
import { AdminAccessSplashCanvas } from '../canvases/AdminAccessSplashCanvas';
import { TvRunScoreCell } from '../ui/TvRunScoreCell';
import { Trophy, Activity, Flame } from 'lucide-react';
import { uiText } from '../../../../ui-text';

export interface IterationOneTelemetryProps {
  tvState: TvStateApiResponse;
  resultsData: PublicResultsApiResponse;
  activeCategory: CategoryResultData | undefined;
  visibleRankingRows: RankingPresentationRow[];
  rankingPresentationRowsCount: number;
  rankingPageIndex: number;
  rankingPageCount: number;
  isDisconnected?: boolean;
}

export function IterationOneTelemetry({
  tvState,
  resultsData,
  activeCategory,
  visibleRankingRows,
  rankingPresentationRowsCount,
  rankingPageIndex,
  rankingPageCount,
  isDisconnected,
}: IterationOneTelemetryProps) {
  const { eventTitle, mode } = tvState;
  const announcementHeadline = tvState.tvAnnouncement?.headline?.trim() ?? '';
  const announcementMessage = tvState.tvAnnouncement?.message?.trim() ?? '';
  const tvPresentation = tvState.tvPresentation ?? {
    theme: 'broadcast' as const,
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
  let gridColumns = 'grid-cols-[6%_minmax(0,1fr)_28%]';

  if (isCombined) {
    if (hasRelay1 || hasRelay2) {
      layoutKind = 'combined-relay';
      gridColumns = 'grid-cols-[5%_minmax(0,1fr)_14%_14%_14%_14%_16%]';
    } else {
      layoutKind = 'combined';
      gridColumns = 'grid-cols-[6%_minmax(0,1fr)_22%_22%_20%]';
    }
  } else if (hasRelay1) {
    layoutKind = 'single-relay';
    gridColumns = 'grid-cols-[6%_minmax(0,1fr)_24%_24%]';
  }

  // Podium data for Winners mode
  const rankedWinners = Array.isArray(activeCategory?.rankedResults)
    ? activeCategory.rankedResults.filter((r) => r.rank !== null).slice(0, 3)
    : [];

  return (
    <div
      className="fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-[#070b14] text-white font-sans"
      data-theme={tvPresentation.theme}
      data-testid="tv-shared-frame"
    >
      {/* Background technical telemetry grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-80 w-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-80 w-1/2 rounded-full bg-amber-500/5 blur-[120px]" />

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

      {/* TOP BROADCAST RIBBON */}
      <header
        aria-label="Broadcast Identity Header"
        className="relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-cyan-500/20 bg-slate-950/90 px-6 sm:px-8 backdrop-blur-xl"
      >
        <div className="flex items-center gap-6 min-w-0">
          <img
            key={tvPresentation.logoUrl || '/logo.png'}
            data-testid="tv-header-logo"
            alt={uiText.tv.eventLogoAlt}
            className="max-h-12 w-auto max-w-36 shrink-0 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.3)]"
            src={tvPresentation.logoUrl || '/logo.png'}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.png';
            }}
          />

          <div className="h-10 w-[1px] bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent" />

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,229,255,0.2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>LIVE TELEMETRY</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {tvPresentation.headerLabel || 'BewerbsBoard Engine'}
              </span>
            </div>
            <h1 className="mt-0.5 truncate font-barlow-condensed text-2xl sm:text-3xl font-black uppercase tracking-wider text-white">
              {eventTitle}
            </h1>
          </div>
        </div>

        {/* Current Board Title with substantial margin-right so the QR overlay popup never hides the title */}
        <div className="flex items-center gap-4 shrink-0 mr-80 lg:mr-[380px] xl:mr-[420px]">
          {activeCategory && (
            <div className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 px-4 py-2 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
              <Flame className="h-4 w-4 text-cyan-400 animate-pulse" />
              <span className="font-barlow-condensed text-xl sm:text-2xl font-black uppercase tracking-wide text-cyan-200">
                {activeCategory.displayName}
              </span>
            </div>
          )}

          {isDisconnected && (
            <span className="rounded-lg border border-red-600 bg-red-600/90 px-3 py-1 text-xs font-black uppercase tracking-wider text-white animate-pulse">
              {uiText.tv.disconnected}
            </span>
          )}
        </div>
      </header>

      {/* MAIN CANVAS CONTENT */}
      {isAdminSplashActive ? (
        <AdminAccessSplashCanvas
          theme={tvPresentation.theme}
          serverInfo={tvState.serverInfo}
        />
      ) : mode === 'MESSAGE' ? (
        <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="tv-mode-canvas">
          <div className="max-w-4xl rounded-3xl border border-cyan-500/30 bg-slate-950/80 p-12 shadow-[0_0_50px_rgba(0,229,255,0.1)] backdrop-blur-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/60 px-4 py-1.5 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
              <Activity className="h-3.5 w-3.5 animate-spin" />
              OFFIZIELLE DURCHSAGE
            </div>
            <h2 className="font-barlow-condensed text-5xl sm:text-6xl font-black uppercase tracking-wide text-white">
              {announcementHeadline || uiText.tv.noAnnouncement}
            </h2>
            {announcementMessage && (
              <p className="mt-6 text-xl sm:text-2xl font-medium text-slate-300 leading-relaxed">
                {announcementMessage}
              </p>
            )}
          </div>
        </div>
      ) : mode === 'WINNERS' ? (
        <div className="flex flex-1 flex-col px-8 pb-6 text-center" data-testid="tv-mode-canvas">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/40 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              {uiText.tv.winnersTitle}
            </span>
            <h2 className="mt-1 font-barlow-condensed text-4xl sm:text-5xl font-black uppercase tracking-wider text-white">
              {activeCategory?.displayName ?? ''}
            </h2>
          </div>

          {rankedWinners.length === 0 ? (
            <div className="flex flex-1 items-center justify-center font-barlow-condensed text-2xl uppercase tracking-widest text-slate-500">
              {uiText.tv.noResults}
            </div>
          ) : (
            <div className="flex flex-1 items-end justify-center gap-8 max-w-6xl mx-auto w-full pb-8">
              {/* P2: Silver */}
              {rankedWinners[1] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 rounded-xl border border-slate-400/30 bg-slate-900/80 px-4 py-2 text-center w-full">
                    <span className="font-mono text-xs font-black uppercase text-slate-400">2. PLATZ</span>
                    <h3 className="truncate font-barlow-condensed text-2xl font-black text-white">
                      {rankedWinners[1].fireBrigadeName}
                    </h3>
                    {rankedWinners[1].groupName && (
                      <p className="text-sm font-semibold text-slate-400">{rankedWinners[1].groupName}</p>
                    )}
                    <p className="mt-1 font-mono text-[clamp(1.4rem,2.5vw,2.75rem)] font-black text-slate-200 tabular-nums">
                      {formatHundredthsToDisplayTime(rankedWinners[1].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[24vh] w-full rounded-t-2xl border-t-4 border-slate-300 bg-gradient-to-b from-slate-700/80 to-slate-900/90 flex items-center justify-center font-barlow-condensed text-6xl font-black text-slate-300 shadow-2xl">
                    2
                  </div>
                </div>
              )}

              {/* P1: Gold */}
              {rankedWinners[0] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 rounded-xl border border-amber-400/50 bg-amber-950/60 px-5 py-3 text-center w-full shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                    <div className="inline-flex items-center gap-1 text-xs font-black uppercase text-amber-300">
                      <Trophy className="h-3.5 w-3.5" />
                      SIEGER / 1. PLATZ
                    </div>
                    <h3 className="truncate font-barlow-condensed text-3xl font-black text-white">
                      {rankedWinners[0].fireBrigadeName}
                    </h3>
                    {rankedWinners[0].groupName && (
                      <p className="text-base font-bold text-amber-200">{rankedWinners[0].groupName}</p>
                    )}
                    <p className="mt-1 font-mono text-[clamp(1.6rem,2.8vw,3rem)] font-black text-amber-300 tabular-nums">
                      {formatHundredthsToDisplayTime(rankedWinners[0].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[32vh] w-full rounded-t-2xl border-t-4 border-amber-400 bg-gradient-to-b from-amber-600/80 to-amber-950/90 flex items-center justify-center font-barlow-condensed text-8xl font-black text-amber-300 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
                    1
                  </div>
                </div>
              )}

              {/* P3: Bronze */}
              {rankedWinners[2] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className="mb-2 rounded-xl border border-amber-700/40 bg-slate-900/80 px-4 py-2 text-center w-full">
                    <span className="font-mono text-xs font-black uppercase text-amber-600">3. PLATZ</span>
                    <h3 className="truncate font-barlow-condensed text-2xl font-black text-white">
                      {rankedWinners[2].fireBrigadeName}
                    </h3>
                    {rankedWinners[2].groupName && (
                      <p className="text-sm font-semibold text-amber-600/80">{rankedWinners[2].groupName}</p>
                    )}
                    <p className="mt-1 font-mono text-[clamp(1.4rem,2.5vw,2.75rem)] font-black text-amber-500 tabular-nums">
                      {formatHundredthsToDisplayTime(rankedWinners[2].scoreHundredths)}
                    </p>
                  </div>
                  <div className="h-[18vh] w-full rounded-t-2xl border-t-4 border-amber-700 bg-gradient-to-b from-amber-900/80 to-stone-950/90 flex items-center justify-center font-barlow-condensed text-5xl font-black text-amber-600 shadow-2xl">
                    3
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* RANKING TABLE DISPLAY */
        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6" data-testid="tv-mode-canvas">
          {!activeCategory ? (
            <div className="flex flex-1 items-center justify-center font-barlow-condensed text-3xl tracking-widest text-slate-500">
              {uiText.tv.noActiveCategory}
            </div>
          ) : (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div className="flex-1 overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950/70 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                <table
                  aria-label={uiText.tv.ranking(activeCategory.displayName)}
                  className="grid h-full w-full grid-rows-[3.5rem_minmax(0,1fr)] text-left"
                  data-density="full"
                >
                  {/* Table Header:
                      - Single results: "Angriff" and "Staffellauf"
                      - Combined results: "ANG" and "SL" */}
                  <thead className="grid h-full items-center border-b-2 border-cyan-500/30 bg-slate-900/90 font-barlow-condensed text-base sm:text-lg uppercase tracking-wider text-cyan-300/90">
                    <tr className={`grid h-full items-center ${gridColumns}`}>
                      <th className="px-4 py-2 text-center">RANG</th>
                      <th className="px-4 py-2 text-left">
                        {isBrigadePairing ? uiText.tv.fireBrigade : uiText.tv.participant}
                      </th>

                      {layoutKind === 'combined-relay' ? (
                        <>
                          <th className="px-2 py-2 text-center">{cat1Name} ANG</th>
                          <th className="px-2 py-2 text-center">{cat1Name} SL</th>
                          <th className="px-2 py-2 text-center">{cat2Name} ANG</th>
                          <th className="px-2 py-2 text-center">{cat2Name} SL</th>
                          <th className="px-4 py-2 text-right text-amber-400 font-black">GESAMT</th>
                        </>
                      ) : layoutKind === 'combined' ? (
                        <>
                          <th className="px-4 py-2 text-center">{cat1Name}</th>
                          <th className="px-4 py-2 text-center">{cat2Name}</th>
                          <th className="px-4 py-2 text-right text-amber-400 font-black">GESAMT</th>
                        </>
                      ) : layoutKind === 'single-relay' ? (
                        <>
                          <th className="px-4 py-2 text-center">ANGRIFF</th>
                          <th className="px-4 py-2 text-center">STAFFELLAUF</th>
                        </>
                      ) : (
                        <th className="px-4 py-2 text-right">ANGRIFF</th>
                      )}
                    </tr>
                  </thead>

                  {/* Table Rows */}
                  <tbody className="grid min-h-0 grid-rows-8 divide-y divide-white/5">
                    {visibleRankingRows.length === 0 ? (
                      <tr className="flex items-center justify-center font-barlow-condensed text-2xl uppercase tracking-widest text-slate-500">
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
                              className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-transparent bg-cyan-950/10 ${gridColumns}`}
                              data-row-kind="upcoming"
                            >
                              <td className="px-4 py-1.5 text-center">
                                <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                                  BEREIT
                                </span>
                              </td>
                              <td className="min-w-0 px-4 py-1.5">
                                <div className="truncate font-barlow-condensed text-xl sm:text-2xl font-black tracking-wide text-cyan-100/90">
                                  {name}
                                </div>
                              </td>
                              <td className="px-4 py-1.5 text-slate-500 text-sm font-mono" colSpan={5}>
                                Startreihenfolge #{upcoming.startOrderPosition ?? '—'}
                              </td>
                            </tr>
                          );
                        }

                        // Ranked row
                        const result = rowItem.entry;
                        const rank = result.rank;
                        const isP1 = rank === 1;
                        const isP2 = rank === 2;
                        const isP3 = rank === 3;

                        const pName = isBrigadePairing
                          ? result.fireBrigadeName
                          : participantLabel({
                              fireBrigadeName: result.fireBrigadeName,
                              groupName: result.groupName,
                            });

                        const primary = result.primaryRun;
                        const secondary = result.secondaryRun;

                        const rowLeadingClass = isP1
                          ? 'border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-500/15 via-slate-900/50 to-transparent'
                          : isP2
                          ? 'border-l-4 border-l-slate-300 bg-gradient-to-r from-slate-400/10 via-slate-900/40 to-transparent'
                          : isP3
                          ? 'border-l-4 border-l-amber-600 bg-gradient-to-r from-amber-700/10 via-slate-900/40 to-transparent'
                          : 'border-l-4 border-l-transparent bg-slate-900/20';

                        return (
                          <tr
                            key={`ranked-${result.groupId}-${rank}`}
                            className={`grid min-h-0 items-center overflow-hidden ${gridColumns} ${rowLeadingClass}`}
                            data-rank={rank ?? undefined}
                            data-row-kind="ranked"
                          >
                            {/* Rank Column */}
                            <td className="px-4 py-1.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-barlow-condensed font-black text-[clamp(1.25rem,2.1vw,2.4rem)] ${
                                  isP1
                                    ? 'text-amber-300 font-extrabold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                    : isP2
                                    ? 'text-slate-200'
                                    : isP3
                                    ? 'text-amber-500'
                                    : 'text-white/70'
                                }`}
                              >
                                {rank}
                              </span>
                            </td>

                            {/* Competitor Identity */}
                            <td className="min-w-0 px-4 py-1.5">
                              <div className="flex items-center gap-2">
                                {isP1 && (
                                  <span
                                    aria-hidden="true"
                                    className="hidden sm:inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/40"
                                  >
                                    LEADER
                                  </span>
                                )}
                                <span
                                  className="truncate whitespace-nowrap font-barlow-condensed text-[clamp(1.2rem,2.2vw,2.3rem)] font-black uppercase tracking-wide text-white"
                                  title={pName}
                                  aria-label={pName}
                                >
                                  {pName}
                                </span>
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
                                  />
                                </td>
                                {/* Cat 1 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                  />
                                </td>
                                {/* Cat 2 Attack */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.attackTimeHundredths}
                                    errors={secondary?.attackTimeErrors}
                                    scoreHundredths={secondary?.scoreHundredths}
                                    runStatus={secondary?.runStatus}
                                  />
                                </td>
                                {/* Cat 2 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.relayRaceHundredths}
                                    errors={secondary?.relayRaceErrors}
                                    runStatus={secondary?.runStatus}
                                  />
                                </td>
                                {/* Combined Score - Reverted to clamp(1.4rem, 2.5vw, 2.75rem) */}
                                <td className="px-4 py-1 text-right font-mono font-black text-[clamp(1.4rem,2.5vw,2.75rem)] text-amber-300 tabular-nums">
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
                                  />
                                </td>
                                {/* Combined Score - Reverted to clamp(1.4rem, 2.5vw, 2.75rem) */}
                                <td className="px-4 py-1 text-right font-mono font-black text-[clamp(1.4rem,2.5vw,2.75rem)] text-amber-300 tabular-nums">
                                  {formatHundredthsToDisplayTime(result.scoreHundredths)}
                                </td>
                              </>
                            ) : layoutKind === 'single-relay' ? (
                              <>
                                {/* Angriff */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.attackTimeHundredths}
                                    errors={primary?.attackTimeErrors}
                                    scoreHundredths={primary?.scoreHundredths}
                                    runStatus={primary?.runStatus}
                                  />
                                </td>
                                {/* Staffellauf */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                  />
                                </td>
                              </>
                            ) : (
                              /* Standard: Only Angriff time + penalties. Never hide in summed time! */
                              <td className="px-4 py-1 text-right">
                                <TvRunScoreCell
                                  rawTimeHundredths={primary?.attackTimeHundredths}
                                  errors={primary?.attackTimeErrors}
                                  scoreHundredths={primary?.scoreHundredths}
                                  runStatus={primary?.runStatus}
                                  align="right"
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

              {/* FOOTER TELEMETRY RAIL */}
              <footer className="mt-3 flex shrink-0 items-center justify-between px-2 text-xs font-semibold text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-cyan-400">
                    SEITE {rankingPageIndex + 1} / {rankingPageCount}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{rankingPresentationRowsCount} TEILNEHMER IN DIESER KATEGORIE</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-cyan-300/80">
                    BEWERBSBOARD TELEMETRY ENGINE 2.0
                  </span>
                </div>
              </footer>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
