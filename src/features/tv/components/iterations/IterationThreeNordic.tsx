import { useState, useEffect } from 'react';
import type { TvStateApiResponse } from '../../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../../public/components/PublicScoreboard';
import type { RankingPresentationRow } from '../canvases/RankingCanvas';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { participantLabel, parseRunPenalty } from '../../utils/tv-competitor-helpers';
import { TvQrPopupCard } from '../ui/TvQrPopupCard';
import { AdminAccessSplashCanvas } from '../canvases/AdminAccessSplashCanvas';
import { TvRunScoreCell, TvPenaltyTag } from '../ui/TvRunScoreCell';
import { Crown, Sparkles, Clock } from 'lucide-react';
import { uiText } from '../../../../ui-text';

export interface IterationThreeNordicProps {
  tvState: TvStateApiResponse;
  resultsData: PublicResultsApiResponse;
  activeCategory: CategoryResultData | undefined;
  visibleRankingRows: RankingPresentationRow[];
  rankingPresentationRowsCount: number;
  rankingPageIndex: number;
  rankingPageCount: number;
  isDisconnected?: boolean;
}

export function IterationThreeNordic({
  tvState,
  resultsData,
  activeCategory,
  visibleRankingRows,
  rankingPresentationRowsCount,
  rankingPageIndex,
  rankingPageCount,
  isDisconnected,
}: IterationThreeNordicProps) {
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
    theme: 'ceremony' as const,
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
  let ladderColumns = 'grid-cols-[8%_minmax(0,1fr)_32%]';

  if (isCombined) {
    if (hasRelay1 || hasRelay2) {
      layoutKind = 'combined-relay';
      ladderColumns = 'grid-cols-[7%_minmax(0,1fr)_14%_14%_14%_14%_16%]';
    } else {
      layoutKind = 'combined';
      ladderColumns = 'grid-cols-[8%_minmax(0,1fr)_22%_22%_20%]';
    }
  } else if (hasRelay1) {
    layoutKind = 'single-relay';
    ladderColumns = 'grid-cols-[8%_minmax(0,1fr)_25%_25%]';
  }

  // Current leader (Rank 1) for left spotlight
  const leaderEntry = activeCategory?.rankedResults?.[0] ?? null;
  const leaderPrimary = leaderEntry?.primaryRun;
  const leaderSecondary = leaderEntry?.secondaryRun;
  const leaderAttackPenalty = parseRunPenalty(leaderPrimary?.attackTimeErrors, leaderPrimary?.attackTimeHundredths, leaderPrimary?.scoreHundredths);
  const leaderRelayPenalty = parseRunPenalty(leaderPrimary?.relayRaceErrors, leaderPrimary?.relayRaceHundredths);

  return (
    <div
      className="fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-[#050811] text-slate-100 font-sans"
      data-theme={tvPresentation.theme}
      data-testid="tv-shared-frame"
    >
      {/* Subtle architectural gradient background */}
      <div className="pointer-events-none absolute top-0 left-0 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[150px]" />

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

      {/* NORDIC GLASS HEADER */}
      <header
        aria-label="Precision Studio Header"
        className="relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-white/10 bg-[#070d1a]/80 px-8 backdrop-blur-2xl"
      >
        <div className="flex items-center gap-6 min-w-0">
          <img
            key={tvPresentation.logoUrl || '/logo.png'}
            data-testid="tv-header-logo"
            alt={uiText.tv.eventLogoAlt}
            className="max-h-12 w-auto max-w-36 shrink-0 object-contain drop-shadow"
            src={tvPresentation.logoUrl || '/logo.png'}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.png';
            }}
          />

          <div className="h-8 w-[1px] bg-white/10" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-400">
                PRECISION TIMING ENGINE
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                • {tvPresentation.headerLabel || 'Offizielle Wertung'}
              </span>
            </div>
            <h1 className="truncate font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {eventTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {activeCategory && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="font-sans text-lg font-bold text-white tracking-tight">
                {activeCategory.displayName}
              </span>
            </div>
          )}

          {isDisconnected && (
            <span className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white shadow-lg shadow-red-900/50">
              {uiText.tv.disconnected}
            </span>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-base font-semibold text-slate-300 tabular-nums">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{currentTime || '00:00:00'}</span>
          </div>
        </div>
      </header>

      {/* MAIN DUAL-PANE WORKSPACE */}
      {isAdminSplashActive ? (
        <AdminAccessSplashCanvas
          theme={tvPresentation.theme}
          serverInfo={tvState.serverInfo}
        />
      ) : mode === 'MESSAGE' ? (
        <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="tv-mode-canvas">
          <div className="max-w-4xl rounded-3xl border border-white/15 bg-white/[0.04] p-12 shadow-2xl backdrop-blur-2xl">
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white">
              {announcementHeadline || uiText.tv.noAnnouncement}
            </h2>
            {announcementMessage && (
              <p className="mt-6 text-xl text-slate-300 leading-relaxed">
                {announcementMessage}
              </p>
            )}
          </div>
        </div>
      ) : mode === 'WINNERS' ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="tv-mode-canvas">
          <div className="max-w-3xl rounded-3xl border border-amber-500/30 bg-amber-950/20 p-12 backdrop-blur-2xl">
            <Crown className="mx-auto h-16 w-16 text-amber-400" />
            <span className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
              {uiText.tv.winnersTitle}
            </span>
            <h2 className="mt-2 text-4xl font-extrabold text-white">
              {activeCategory?.displayName}
            </h2>
            {leaderEntry && (
              <div className="mt-8 rounded-2xl bg-white/10 p-6">
                <h3 className="text-3xl font-black text-amber-300">
                  {leaderEntry.fireBrigadeName}
                </h3>
                {leaderEntry.groupName && (
                  <p className="text-lg text-slate-300 font-semibold">{leaderEntry.groupName}</p>
                )}
                <p className="mt-2 font-mono text-4xl font-black text-white tabular-nums">
                  {formatHundredthsToDisplayTime(leaderEntry.scoreHundredths)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* DUAL-PANE TIMING STUDIO */
        <main className="flex min-h-0 flex-1 gap-6 p-6" data-testid="tv-mode-canvas">
          {!activeCategory ? (
            <div className="flex flex-1 items-center justify-center text-2xl font-medium text-slate-500">
              {uiText.tv.noActiveCategory}
            </div>
          ) : (
            <>
              {/* LEFT PANE: LEADER SPOTLIGHT (38% width) */}
              <section className="flex w-[38%] shrink-0 flex-col gap-5">
                {/* Hero Champion Card */}
                <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-white/[0.03] to-transparent p-6 shadow-2xl backdrop-blur-xl">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-400/30">
                        <Crown className="h-3.5 w-3.5" />
                        LEADER SPOTLIGHT
                      </span>
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
                        P1 PLATZIERUNG
                      </span>
                    </div>

                    {leaderEntry ? (
                      <div className="mt-5">
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white line-clamp-2">
                          {leaderEntry.fireBrigadeName}
                        </h2>
                        {leaderEntry.groupName && (
                          <p className="mt-1 font-semibold text-lg text-amber-200">
                            {isBrigadePairing ? `Gr. ${leaderEntry.groupName}` : leaderEntry.groupName}
                          </p>
                        )}
                        {isBrigadePairing && leaderEntry.secondaryGroupName && (
                          <p className="text-sm font-semibold text-amber-300/80">
                            + Gr. {leaderEntry.secondaryGroupName}
                          </p>
                        )}

                        {/* Leader Primary Time / Score Readout */}
                        <div className="mt-5 rounded-2xl bg-black/40 border border-white/10 p-5 shadow-inner">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                            {isCombined ? 'GESAMTWERTUNG (SCORE)' : 'BESTZEIT ANGRIFF'}
                          </span>
                          <div className="mt-1 flex items-baseline gap-3">
                            <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-amber-300 tabular-nums">
                              {isCombined
                                ? formatHundredthsToDisplayTime(leaderEntry.scoreHundredths)
                                : formatHundredthsToDisplayTime(leaderPrimary?.attackTimeHundredths ?? leaderEntry.scoreHundredths)}
                            </span>
                            {!isCombined && leaderAttackPenalty > 0 && (
                              <TvPenaltyTag penalties={leaderAttackPenalty} variant="nordic" />
                            )}
                          </div>
                        </div>

                        {/* Detailed Split Breakdown */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {isCombined ? (
                            <>
                              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                                <span className="text-[10px] font-bold uppercase text-slate-400">{cat1Name}</span>
                                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-white">
                                  <span>{formatHundredthsToDisplayTime(leaderPrimary?.attackTimeHundredths ?? leaderPrimary?.scoreHundredths)}</span>
                                  {leaderAttackPenalty > 0 && <TvPenaltyTag penalties={leaderAttackPenalty} variant="nordic" />}
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                                <span className="text-[10px] font-bold uppercase text-slate-400">{cat2Name}</span>
                                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-white">
                                  <span>{formatHundredthsToDisplayTime(leaderSecondary?.attackTimeHundredths ?? leaderSecondary?.scoreHundredths)}</span>
                                  {leaderSecondary?.attackTimeErrors && leaderSecondary.attackTimeErrors > 0 && (
                                    <TvPenaltyTag penalties={leaderSecondary.attackTimeErrors} variant="nordic" />
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                                <span className="text-[10px] font-bold uppercase text-slate-400">ANGRIFF (ANG)</span>
                                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-white">
                                  <span>{formatHundredthsToDisplayTime(leaderPrimary?.attackTimeHundredths)}</span>
                                  {leaderAttackPenalty > 0 && <TvPenaltyTag penalties={leaderAttackPenalty} variant="nordic" />}
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                                <span className="text-[10px] font-bold uppercase text-slate-400">STAFFELLAUF (SL)</span>
                                <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-white">
                                  <span>
                                    {leaderPrimary?.relayRaceHundredths
                                      ? formatHundredthsToDisplayTime(leaderPrimary.relayRaceHundredths)
                                      : '—'}
                                  </span>
                                  {leaderRelayPenalty > 0 && <TvPenaltyTag penalties={leaderRelayPenalty} variant="nordic" />}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-8 text-center text-slate-500">Kein Teilnehmer gewertet</div>
                    )}
                  </div>
                </div>

                {/* Category Metric Pulse Card */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      KATEGORIE STATUS
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
                      <span className="text-xs text-slate-400 font-medium">Gewertet</span>
                      <p className="mt-1 font-mono text-3xl font-black text-white">
                        {activeCategory.rankedResults?.length ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
                      <span className="text-xs text-slate-400 font-medium">Ausstehend</span>
                      <p className="mt-1 font-mono text-3xl font-black text-blue-400">
                        {activeCategory.openEntries?.length ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* RIGHT PANE: FIELD LADDER (62% width) */}
              <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-2xl">
                <table
                  aria-label={uiText.tv.ranking(activeCategory.displayName)}
                  className="grid h-full w-full grid-rows-[3.5rem_minmax(0,1fr)] text-left"
                  data-density="full"
                >
                  {/* Table Header */}
                  <thead className="grid h-full items-center border-b border-white/10 bg-white/[0.04] text-xs font-bold uppercase tracking-wider text-slate-400">
                    <tr className={`grid h-full items-center ${ladderColumns}`}>
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
                          <th className="px-4 py-2 text-right text-amber-300 font-black">GESAMT</th>
                        </>
                      ) : layoutKind === 'combined' ? (
                        <>
                          <th className="px-4 py-2 text-center">{cat1Name}</th>
                          <th className="px-4 py-2 text-center">{cat2Name}</th>
                          <th className="px-4 py-2 text-right text-amber-300 font-black">GESAMT</th>
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
                  <tbody className="grid min-h-0 grid-rows-8 divide-y divide-white/5">
                    {visibleRankingRows.length === 0 ? (
                      <tr className="flex items-center justify-center text-xl text-slate-500 font-medium">
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
                              className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-blue-500/50 bg-blue-500/5 ${ladderColumns}`}
                              data-row-kind="upcoming"
                            >
                              <td className="px-4 py-1.5 text-center">
                                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-300">
                                  OPEN
                                </span>
                              </td>
                              <td className="min-w-0 px-4 py-1.5">
                                <div className="truncate font-semibold text-slate-300">
                                  {name}
                                </div>
                              </td>
                              <td className="px-4 py-1.5 text-slate-500 text-xs font-mono" colSpan={5}>
                                Startposition #{upcoming.startOrderPosition ?? '—'}
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
                          ? 'border-l-4 border-l-amber-400 bg-amber-400/[0.06]'
                          : rank === 2
                          ? 'border-l-4 border-l-slate-300 bg-white/[0.04]'
                          : rank === 3
                          ? 'border-l-4 border-l-amber-600 bg-amber-600/[0.04]'
                          : 'border-l-4 border-l-transparent bg-white/[0.01] hover:bg-white/[0.04]';

                        return (
                          <tr
                            key={`ranked-${result.groupId}-${rank}`}
                            className={`grid min-h-0 items-center overflow-hidden ${ladderColumns} ${rowClass}`}
                            data-rank={rank ?? undefined}
                            data-row-kind="ranked"
                          >
                            {/* Rank Column */}
                            <td className="px-4 py-1.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center font-mono font-black text-lg ${
                                  isP1 ? 'text-amber-300' : 'text-slate-300'
                                }`}
                              >
                                {rank}
                              </span>
                            </td>

                            {/* Competitor Identity */}
                            <td className="min-w-0 px-4 py-1.5">
                              <div className="truncate font-bold text-white text-base sm:text-lg">
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
                                    variant="nordic"
                                  />
                                </td>
                                {/* Cat 1 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    variant="nordic"
                                  />
                                </td>
                                {/* Cat 2 Attack */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.attackTimeHundredths}
                                    errors={secondary?.attackTimeErrors}
                                    scoreHundredths={secondary?.scoreHundredths}
                                    runStatus={secondary?.runStatus}
                                    variant="nordic"
                                  />
                                </td>
                                {/* Cat 2 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.relayRaceHundredths}
                                    errors={secondary?.relayRaceErrors}
                                    runStatus={secondary?.runStatus}
                                    variant="nordic"
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className="px-4 py-1 text-right font-mono font-black text-lg text-amber-300 tabular-nums">
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
                                    variant="nordic"
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
                                    variant="nordic"
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className="px-4 py-1 text-right font-mono font-black text-lg text-amber-300 tabular-nums">
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
                                    variant="nordic"
                                  />
                                </td>
                                {/* Relay (SL) */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    variant="nordic"
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
                                  variant="nordic"
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Right Ladder Footer */}
                <div className="flex h-10 shrink-0 items-center justify-between border-t border-white/10 px-4 text-xs font-mono text-slate-400">
                  <span>
                    SEITE {rankingPageIndex + 1} / {rankingPageCount} • {rankingPresentationRowsCount} STARTS
                  </span>
                  <span>SWISS TIMING PRECISION ENGINE</span>
                </div>
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}
