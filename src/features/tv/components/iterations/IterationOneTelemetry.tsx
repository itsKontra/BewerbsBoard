import type { TvStateApiResponse } from '../../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../../public/components/PublicScoreboard';
import type { RankingPresentationRow } from '../canvases/RankingCanvas';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { participantLabel } from '../../utils/tv-competitor-helpers';
import { TvQrPopupCard } from '../ui/TvQrPopupCard';
import { AdminAccessSplashCanvas } from '../canvases/AdminAccessSplashCanvas';
import { TvRunScoreCell } from '../ui/TvRunScoreCell';
import { Trophy, Activity, Flame, Sparkles } from 'lucide-react';
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
  theme?: TvTheme;
}

interface TelemetryThemeTokens {
  frameClasses: string;
  gridOverlayStyle: React.CSSProperties;
  gridOverlayClasses: string;
  ambientTopClasses: string;
  ambientBottomClasses: string;
  headerClasses: string;
  headerLogoDropShadow: string;
  headerDividerClasses: string;
  badgeContainerClasses: string;
  badgeDotPingClasses: string;
  badgeDotClasses: string;
  badgeText: string;
  headerSublabelClasses: string;
  titleClasses: string;
  categoryContainerClasses: string;
  categoryIcon: 'flame' | 'sparkles' | 'sun';
  categoryIconColor: string;
  categoryTitleClasses: string;
  tableContainerClasses: string;
  theadClasses: string;
  gesamtThClasses: string;
  rowDividerClasses: string;
  upcomingRowClasses: string;
  upcomingBadgeClasses: string;
  upcomingNameClasses: string;
  upcomingMetaClasses: string;
  rowLeadingClassP1: string;
  rowLeadingClassP2: string;
  rowLeadingClassP3: string;
  rowLeadingClassDefault: string;
  rank1NumberClasses: string;
  rank2NumberClasses: string;
  rank3NumberClasses: string;
  rankOtherNumberClasses: string;
  leaderBadgeClasses: string;
  competitorNameClasses: string;
  timeClass: string;
  combinedScoreClasses: string;
  footerContainerClasses: string;
  footerPageClasses: string;
  footerBulletClasses: string;
  footerMetaClasses: string;
  footerEngineClasses: string;
  emptyCategoryClasses: string;
  noResultsClasses: string;
  messageCardClasses: string;
  messageBadgeClasses: string;
  messageHeadlineClasses: string;
  messageBodyClasses: string;
  winnersBadgeClasses: string;
  winnersTitleClasses: string;
  winnersP1CardClasses: string;
  winnersP1StepClasses: string;
  winnersP1ScoreClasses: string;
  winnersP2CardClasses: string;
  winnersP2StepClasses: string;
  winnersP2ScoreClasses: string;
  winnersP3CardClasses: string;
  winnersP3StepClasses: string;
  winnersP3ScoreClasses: string;
}

const TELEMETRY_THEME_TOKENS: Record<TvTheme, TelemetryThemeTokens> = {
  broadcast: {
    frameClasses: 'fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-[#070b14] text-white font-sans',
    gridOverlayStyle: {
      backgroundImage:
        'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    },
    gridOverlayClasses: 'pointer-events-none absolute inset-0 opacity-[0.04]',
    ambientTopClasses: 'pointer-events-none absolute -top-40 left-1/4 h-80 w-1/2 rounded-full bg-cyan-500/10 blur-[120px]',
    ambientBottomClasses: 'pointer-events-none absolute -bottom-40 right-1/4 h-80 w-1/2 rounded-full bg-amber-500/5 blur-[120px]',
    headerClasses: 'relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-cyan-500/20 bg-slate-950/90 px-6 sm:px-8 backdrop-blur-xl',
    headerLogoDropShadow: 'drop-shadow-[0_0_12px_rgba(0,229,255,0.3)]',
    headerDividerClasses: 'bg-gradient-to-b from-transparent via-cyan-500/40 to-transparent',
    badgeContainerClasses: 'border border-cyan-500/40 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,229,255,0.2)]',
    badgeDotPingClasses: 'bg-cyan-400',
    badgeDotClasses: 'bg-cyan-400',
    badgeText: 'LIVE TELEMETRY',
    headerSublabelClasses: 'text-slate-400',
    titleClasses: 'text-white',
    categoryContainerClasses: 'border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 shadow-[0_0_15px_rgba(0,229,255,0.15)]',
    categoryIcon: 'flame',
    categoryIconColor: 'text-cyan-400',
    categoryTitleClasses: 'text-cyan-200',
    tableContainerClasses: 'border border-cyan-500/25 bg-slate-950/70 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl',
    theadClasses: 'border-b-2 border-cyan-500/30 bg-slate-900/90 text-cyan-300/90',
    gesamtThClasses: 'text-amber-400 font-black',
    rowDividerClasses: 'divide-white/5',
    upcomingRowClasses: 'bg-cyan-950/10',
    upcomingBadgeClasses: 'border border-cyan-500/30 bg-cyan-950/40 text-cyan-300',
    upcomingNameClasses: 'text-cyan-100/90',
    upcomingMetaClasses: 'text-slate-500',
    rowLeadingClassP1: 'border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-500/15 via-slate-900/50 to-transparent',
    rowLeadingClassP2: 'border-l-4 border-l-slate-300 bg-gradient-to-r from-slate-400/10 via-slate-900/40 to-transparent',
    rowLeadingClassP3: 'border-l-4 border-l-amber-600 bg-gradient-to-r from-amber-700/10 via-slate-900/40 to-transparent',
    rowLeadingClassDefault: 'border-l-4 border-l-transparent bg-slate-900/20',
    rank1NumberClasses: 'text-amber-300 font-extrabold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    rank2NumberClasses: 'text-slate-200',
    rank3NumberClasses: 'text-amber-500',
    rankOtherNumberClasses: 'text-white/70',
    leaderBadgeClasses: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    competitorNameClasses: 'text-white',
    timeClass: 'text-white',
    combinedScoreClasses: 'text-amber-300',
    footerContainerClasses: 'text-slate-400',
    footerPageClasses: 'text-cyan-400',
    footerBulletClasses: 'text-slate-600',
    footerMetaClasses: 'text-slate-400',
    footerEngineClasses: 'text-cyan-300/80',
    emptyCategoryClasses: 'text-slate-500',
    noResultsClasses: 'text-slate-500',
    messageCardClasses: 'border border-cyan-500/30 bg-slate-950/80 shadow-[0_0_50px_rgba(0,229,255,0.1)]',
    messageBadgeClasses: 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300',
    messageHeadlineClasses: 'text-white',
    messageBodyClasses: 'text-slate-300',
    winnersBadgeClasses: 'border border-amber-500/40 bg-amber-950/40 text-amber-300',
    winnersTitleClasses: 'text-white',
    winnersP1CardClasses: 'border border-amber-400/50 bg-amber-950/60 shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    winnersP1StepClasses: 'border-t-4 border-amber-400 bg-gradient-to-b from-amber-600/80 to-amber-950/90 text-amber-300 shadow-[0_0_40px_rgba(245,158,11,0.3)]',
    winnersP1ScoreClasses: 'text-amber-300',
    winnersP2CardClasses: 'border border-slate-400/30 bg-slate-900/80',
    winnersP2StepClasses: 'border-t-4 border-slate-300 bg-gradient-to-b from-slate-700/80 to-slate-900/90 text-slate-300 shadow-2xl',
    winnersP2ScoreClasses: 'text-slate-200',
    winnersP3CardClasses: 'border border-amber-700/40 bg-slate-900/80',
    winnersP3StepClasses: 'border-t-4 border-amber-700 bg-gradient-to-b from-amber-900/80 to-stone-950/90 text-amber-600 shadow-2xl',
    winnersP3ScoreClasses: 'text-amber-500',
  },
  ceremony: {
    frameClasses: 'fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-[#0a070e] text-[#fffbeb] font-sans',
    gridOverlayStyle: {
      backgroundImage:
        'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.12) 0%, transparent 60%)',
      backgroundSize: '100% 100%',
    },
    gridOverlayClasses: 'pointer-events-none absolute inset-0 opacity-80',
    ambientTopClasses: 'pointer-events-none absolute -top-40 left-1/3 h-96 w-1/2 rounded-full bg-amber-500/15 blur-[130px]',
    ambientBottomClasses: 'pointer-events-none absolute -bottom-40 right-1/4 h-96 w-1/2 rounded-full bg-rose-950/25 blur-[140px]',
    headerClasses: 'relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-amber-500/30 bg-[#130d17]/95 px-6 sm:px-8 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.7)]',
    headerLogoDropShadow: 'drop-shadow-[0_0_14px_rgba(245,158,11,0.4)]',
    headerDividerClasses: 'bg-gradient-to-b from-transparent via-amber-500/40 to-transparent',
    badgeContainerClasses: 'border border-amber-500/50 bg-amber-950/90 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]',
    badgeDotPingClasses: 'bg-amber-400',
    badgeDotClasses: 'bg-amber-400',
    badgeText: 'FESTGALA & SIEGEREHRUNG',
    headerSublabelClasses: 'text-amber-300/80',
    titleClasses: 'text-[#fffbeb]',
    categoryContainerClasses: 'border border-amber-500/50 bg-gradient-to-r from-amber-950/90 to-[#1c1224]/90 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    categoryIcon: 'sparkles',
    categoryIconColor: 'text-amber-400',
    categoryTitleClasses: 'text-amber-200',
    tableContainerClasses: 'border border-amber-500/30 bg-[#120d18]/85 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-xl',
    theadClasses: 'border-b-2 border-amber-500/40 bg-[#1a1220]/95 text-amber-200/90',
    gesamtThClasses: 'text-amber-300 font-black drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    rowDividerClasses: 'divide-amber-500/10',
    upcomingRowClasses: 'bg-amber-950/15',
    upcomingBadgeClasses: 'border border-amber-500/30 bg-amber-950/40 text-amber-300',
    upcomingNameClasses: 'text-amber-100/90',
    upcomingMetaClasses: 'text-amber-300/60',
    rowLeadingClassP1: 'border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-500/25 via-amber-950/50 to-transparent shadow-[inset_0_0_20px_rgba(245,158,11,0.08)]',
    rowLeadingClassP2: 'border-l-4 border-l-stone-300 bg-gradient-to-r from-stone-400/15 via-stone-900/40 to-transparent',
    rowLeadingClassP3: 'border-l-4 border-l-amber-700 bg-gradient-to-r from-amber-800/15 via-stone-900/40 to-transparent',
    rowLeadingClassDefault: 'border-l-4 border-l-transparent bg-[#17101e]/30',
    rank1NumberClasses: 'text-amber-300 font-extrabold drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    rank2NumberClasses: 'text-stone-200 font-bold',
    rank3NumberClasses: 'text-amber-500 font-bold',
    rankOtherNumberClasses: 'text-amber-100/70',
    leaderBadgeClasses: 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    competitorNameClasses: 'text-[#fffbeb]',
    timeClass: 'text-amber-100',
    combinedScoreClasses: 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    footerContainerClasses: 'text-amber-300/60',
    footerPageClasses: 'text-amber-400 font-mono font-bold',
    footerBulletClasses: 'text-amber-600/50',
    footerMetaClasses: 'text-amber-200/70',
    footerEngineClasses: 'text-amber-300/80 font-mono',
    emptyCategoryClasses: 'text-amber-500/60',
    noResultsClasses: 'text-amber-500/60',
    messageCardClasses: 'border border-amber-500/40 bg-[#160f1e]/90 shadow-[0_0_50px_rgba(245,158,11,0.15)]',
    messageBadgeClasses: 'border border-amber-500/50 bg-amber-950/70 text-amber-300',
    messageHeadlineClasses: 'text-amber-100',
    messageBodyClasses: 'text-amber-200/90',
    winnersBadgeClasses: 'border border-amber-400/60 bg-amber-950/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    winnersTitleClasses: 'text-amber-100',
    winnersP1CardClasses: 'border-2 border-amber-400/60 bg-gradient-to-b from-amber-950/80 to-stone-950/95 shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    winnersP1StepClasses: 'border-t-4 border-amber-400 bg-gradient-to-b from-amber-500/90 via-amber-700/80 to-amber-950/95 text-amber-200 shadow-[0_0_50px_rgba(245,158,11,0.4)]',
    winnersP1ScoreClasses: 'text-amber-300',
    winnersP2CardClasses: 'border border-stone-300/40 bg-[#181220]/90',
    winnersP2StepClasses: 'border-t-4 border-stone-300 bg-gradient-to-b from-stone-600/90 to-stone-900/95 text-stone-200 shadow-2xl',
    winnersP2ScoreClasses: 'text-stone-200',
    winnersP3CardClasses: 'border border-amber-700/50 bg-[#181220]/90',
    winnersP3StepClasses: 'border-t-4 border-amber-700 bg-gradient-to-b from-amber-800/90 to-stone-950/95 text-amber-500 shadow-2xl',
    winnersP3ScoreClasses: 'text-amber-500',
  },
  outdoor: {
    frameClasses: 'fixed inset-0 flex h-screen h-dvh w-screen w-full flex-col overflow-hidden select-none bg-slate-100 text-slate-950 font-sans',
    gridOverlayStyle: {
      backgroundImage:
        'linear-gradient(to right, rgba(15, 23, 42, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.05) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    },
    gridOverlayClasses: 'pointer-events-none absolute inset-0 opacity-100',
    ambientTopClasses: 'pointer-events-none absolute -top-40 left-1/4 h-80 w-1/2 rounded-full bg-orange-400/10 blur-[120px]',
    ambientBottomClasses: 'pointer-events-none absolute -bottom-40 right-1/4 h-80 w-1/2 rounded-full bg-amber-400/10 blur-[120px]',
    headerClasses: 'relative z-10 flex h-20 shrink-0 items-center justify-between border-b-2 border-orange-500 bg-slate-900 px-6 sm:px-8 text-white shadow-xl',
    headerLogoDropShadow: 'drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]',
    headerDividerClasses: 'bg-slate-700',
    badgeContainerClasses: 'border border-orange-500/50 bg-orange-500/20 text-orange-400 shadow-sm',
    badgeDotPingClasses: 'bg-orange-400',
    badgeDotClasses: 'bg-orange-500',
    badgeText: 'TAGESLICHT STADION',
    headerSublabelClasses: 'text-slate-300 font-bold',
    titleClasses: 'text-white font-black',
    categoryContainerClasses: 'border-2 border-orange-500 bg-gradient-to-r from-orange-600 to-amber-600 shadow-lg text-white',
    categoryIcon: 'flame',
    categoryIconColor: 'text-white',
    categoryTitleClasses: 'text-white font-black',
    tableContainerClasses: 'border-2 border-slate-300 bg-white shadow-2xl overflow-hidden rounded-2xl',
    theadClasses: 'border-b-2 border-slate-900 bg-slate-900 text-white',
    gesamtThClasses: 'text-orange-400 font-black',
    rowDividerClasses: 'divide-slate-200',
    upcomingRowClasses: 'bg-slate-100/90',
    upcomingBadgeClasses: 'border border-slate-400 bg-slate-200 text-slate-900 font-bold',
    upcomingNameClasses: 'text-slate-950 font-black',
    upcomingMetaClasses: 'text-slate-700 font-bold',
    rowLeadingClassP1: 'border-l-4 border-l-amber-500 bg-amber-50/90 shadow-sm',
    rowLeadingClassP2: 'border-l-4 border-l-slate-400 bg-slate-100/70',
    rowLeadingClassP3: 'border-l-4 border-l-amber-700 bg-amber-50/40',
    rowLeadingClassDefault: 'border-l-4 border-l-transparent bg-white even:bg-slate-50/70',
    rank1NumberClasses: 'text-amber-950 font-black',
    rank2NumberClasses: 'text-slate-900 font-black',
    rank3NumberClasses: 'text-amber-900 font-black',
    rankOtherNumberClasses: 'text-slate-900 font-black',
    leaderBadgeClasses: 'bg-amber-500 text-slate-950 font-black border border-amber-600 shadow-sm',
    competitorNameClasses: 'text-slate-950 font-black',
    timeClass: 'text-slate-950 font-black',
    combinedScoreClasses: 'text-orange-600 font-black',
    footerContainerClasses: 'text-slate-700 font-bold',
    footerPageClasses: 'text-orange-600 font-mono font-black',
    footerBulletClasses: 'text-slate-400',
    footerMetaClasses: 'text-slate-700 font-bold',
    footerEngineClasses: 'text-slate-600 font-mono font-bold',
    emptyCategoryClasses: 'text-slate-600 font-bold',
    noResultsClasses: 'text-slate-600 font-bold',
    messageCardClasses: 'border-2 border-slate-300 bg-white shadow-2xl',
    messageBadgeClasses: 'border border-orange-500/40 bg-orange-100 text-orange-800 font-black',
    messageHeadlineClasses: 'text-slate-950 font-black',
    messageBodyClasses: 'text-slate-800 font-bold',
    winnersBadgeClasses: 'border border-orange-500/40 bg-orange-100 text-orange-800 font-black',
    winnersTitleClasses: 'text-slate-950 font-black',
    winnersP1CardClasses: 'border-2 border-amber-500 bg-amber-50 shadow-xl',
    winnersP1StepClasses: 'border-t-4 border-amber-500 bg-gradient-to-b from-amber-400 to-amber-500 text-amber-950 shadow-xl',
    winnersP1ScoreClasses: 'text-amber-950 font-black',
    winnersP2CardClasses: 'border-2 border-slate-300 bg-slate-100 shadow-lg',
    winnersP2StepClasses: 'border-t-4 border-slate-400 bg-gradient-to-b from-slate-300 to-slate-400 text-slate-900 shadow-lg',
    winnersP2ScoreClasses: 'text-slate-900 font-black',
    winnersP3CardClasses: 'border-2 border-amber-700 bg-amber-50 shadow-lg',
    winnersP3StepClasses: 'border-t-4 border-amber-700 bg-gradient-to-b from-amber-600 to-amber-700 text-amber-100 shadow-lg',
    winnersP3ScoreClasses: 'text-amber-950 font-black',
  },
};

export function IterationOneTelemetry({
  tvState,
  resultsData,
  activeCategory,
  visibleRankingRows,
  rankingPresentationRowsCount,
  rankingPageIndex,
  rankingPageCount,
  isDisconnected,
  theme: customTheme,
}: IterationOneTelemetryProps) {
  const { eventTitle, mode } = tvState;
  const announcementHeadline = tvState.tvAnnouncement?.headline?.trim() ?? '';
  const announcementMessage = tvState.tvAnnouncement?.message?.trim() ?? '';

  const activeTheme: TvTheme =
    customTheme ||
    (tvState.tvPresentation?.theme && ['broadcast', 'ceremony', 'outdoor'].includes(tvState.tvPresentation.theme)
      ? tvState.tvPresentation.theme
      : 'broadcast');

  const tokens = TELEMETRY_THEME_TOKENS[activeTheme] || TELEMETRY_THEME_TOKENS.broadcast;

  const tvPresentation = tvState.tvPresentation ?? {
    theme: activeTheme,
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
      className={tokens.frameClasses}
      data-theme={activeTheme}
      data-testid="tv-shared-frame"
    >
      {/* Background technical telemetry grid / ambient glow */}
      <div
        className={tokens.gridOverlayClasses}
        style={tokens.gridOverlayStyle}
      />
      <div className={tokens.ambientTopClasses} />
      <div className={tokens.ambientBottomClasses} />

      {/* Floating QR Popup */}
      {!isAdminSplashActive && (
        <TvQrPopupCard
          publicUrl={resultsData.publicUrl}
          theme={activeTheme}
          enabled={tvPresentation.qrCodeEnabled ?? true}
          alwaysVisible={tvPresentation.qrCodeAlwaysVisible ?? false}
          intervalSeconds={tvPresentation.qrCodeIntervalSeconds ?? 30}
          durationSeconds={tvPresentation.qrCodeDurationSeconds ?? 10}
        />
      )}

      {/* TOP BROADCAST RIBBON */}
      <header
        aria-label="Broadcast Identity Header"
        className={tokens.headerClasses}
      >
        <div className="flex items-center gap-6 min-w-0">
          <img
            key={tvPresentation.logoUrl || '/logo.png'}
            data-testid="tv-header-logo"
            alt={uiText.tv.eventLogoAlt}
            className={`max-h-12 w-auto max-w-36 shrink-0 object-contain ${tokens.headerLogoDropShadow}`}
            src={tvPresentation.logoUrl || '/logo.png'}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.png';
            }}
          />

          <div className={`h-10 w-[1px] ${tokens.headerDividerClasses}`} />

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] ${tokens.badgeContainerClasses}`}>
                <span className={`h-1.5 w-1.5 rounded-full animate-ping ${tokens.badgeDotPingClasses}`} />
                <span>{tokens.badgeText}</span>
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${tokens.headerSublabelClasses}`}>
                {tvPresentation.headerLabel || 'BewerbsBoard Engine'}
              </span>
            </div>
            <h1 className={`mt-0.5 truncate font-barlow-condensed text-2xl sm:text-3xl font-black uppercase tracking-wider ${tokens.titleClasses}`}>
              {eventTitle}
            </h1>
          </div>
        </div>

        {/* Current Board Title with substantial margin-right so the QR overlay popup never hides the title */}
        <div className="flex items-center gap-4 shrink-0 mr-80 lg:mr-[380px] xl:mr-[420px]">
          {activeCategory && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2 ${tokens.categoryContainerClasses}`}>
              {tokens.categoryIcon === 'sparkles' ? (
                <Sparkles className={`h-4 w-4 animate-pulse ${tokens.categoryIconColor}`} />
              ) : (
                <Flame className={`h-4 w-4 animate-pulse ${tokens.categoryIconColor}`} />
              )}
              <span className={`font-barlow-condensed text-xl sm:text-2xl font-black uppercase tracking-wide ${tokens.categoryTitleClasses}`}>
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
          theme={activeTheme}
          serverInfo={tvState.serverInfo}
        />
      ) : mode === 'MESSAGE' ? (
        <div className="relative flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="tv-mode-canvas">
          <div className={`max-w-4xl rounded-3xl p-12 backdrop-blur-2xl ${tokens.messageCardClasses}`}>
            <div className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.25em] ${tokens.messageBadgeClasses}`}>
              <Activity className="h-3.5 w-3.5 animate-spin" />
              OFFIZIELLE DURCHSAGE
            </div>
            <h2 className={`font-barlow-condensed text-5xl sm:text-6xl font-black uppercase tracking-wide ${tokens.messageHeadlineClasses}`}>
              {announcementHeadline || uiText.tv.noAnnouncement}
            </h2>
            {announcementMessage && (
              <p className={`mt-6 text-xl sm:text-2xl leading-relaxed ${tokens.messageBodyClasses}`}>
                {announcementMessage}
              </p>
            )}
          </div>
        </div>
      ) : mode === 'WINNERS' ? (
        <div className="flex flex-1 flex-col px-8 pb-6 text-center" data-testid="tv-mode-canvas">
          <div className="mb-4">
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-black uppercase tracking-[0.25em] ${tokens.winnersBadgeClasses}`}>
              <Trophy className="h-3.5 w-3.5" />
              {uiText.tv.winnersTitle}
            </span>
            <h2 className={`mt-1 font-barlow-condensed text-4xl sm:text-5xl font-black uppercase tracking-wider ${tokens.winnersTitleClasses}`}>
              {activeCategory?.displayName ?? ''}
            </h2>
          </div>

          {rankedWinners.length === 0 ? (
            <div className={`flex flex-1 items-center justify-center font-barlow-condensed text-2xl uppercase tracking-widest ${tokens.noResultsClasses}`}>
              {uiText.tv.noResults}
            </div>
          ) : (
            <div className="flex flex-1 items-end justify-center gap-8 max-w-6xl mx-auto w-full pb-8">
              {/* P2: Silver */}
              {rankedWinners[1] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className={`mb-2 rounded-xl px-4 py-2 text-center w-full ${tokens.winnersP2CardClasses}`}>
                    <span className="font-mono text-xs font-black uppercase text-slate-400">2. PLATZ</span>
                    <h3 className={`truncate font-barlow-condensed text-2xl font-black ${tokens.titleClasses}`}>
                      {rankedWinners[1].fireBrigadeName}
                    </h3>
                    {rankedWinners[1].groupName && (
                      <p className="text-sm font-semibold opacity-70">{rankedWinners[1].groupName}</p>
                    )}
                    <p className={`mt-1 font-mono text-[clamp(1.4rem,2.5vw,2.75rem)] font-black tabular-nums ${tokens.winnersP2ScoreClasses}`}>
                      {formatHundredthsToDisplayTime(rankedWinners[1].scoreHundredths)}
                    </p>
                  </div>
                  <div className={`h-[24vh] w-full rounded-t-2xl flex items-center justify-center font-barlow-condensed text-6xl font-black ${tokens.winnersP2StepClasses}`}>
                    2
                  </div>
                </div>
              )}

              {/* P1: Gold */}
              {rankedWinners[0] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className={`mb-2 rounded-xl px-5 py-3 text-center w-full ${tokens.winnersP1CardClasses}`}>
                    <div className="inline-flex items-center gap-1 text-xs font-black uppercase text-amber-300">
                      <Trophy className="h-3.5 w-3.5" />
                      SIEGER / 1. PLATZ
                    </div>
                    <h3 className={`truncate font-barlow-condensed text-3xl font-black ${tokens.titleClasses}`}>
                      {rankedWinners[0].fireBrigadeName}
                    </h3>
                    {rankedWinners[0].groupName && (
                      <p className="text-base font-bold text-amber-200">{rankedWinners[0].groupName}</p>
                    )}
                    <p className={`mt-1 font-mono text-[clamp(1.6rem,2.8vw,3rem)] font-black tabular-nums ${tokens.winnersP1ScoreClasses}`}>
                      {formatHundredthsToDisplayTime(rankedWinners[0].scoreHundredths)}
                    </p>
                  </div>
                  <div className={`h-[32vh] w-full rounded-t-2xl flex items-center justify-center font-barlow-condensed text-8xl font-black ${tokens.winnersP1StepClasses}`}>
                    1
                  </div>
                </div>
              )}

              {/* P3: Bronze */}
              {rankedWinners[2] && (
                <div className="flex w-1/3 flex-col items-center">
                  <div className={`mb-2 rounded-xl px-4 py-2 text-center w-full ${tokens.winnersP3CardClasses}`}>
                    <span className="font-mono text-xs font-black uppercase text-amber-600">3. PLATZ</span>
                    <h3 className={`truncate font-barlow-condensed text-2xl font-black ${tokens.titleClasses}`}>
                      {rankedWinners[2].fireBrigadeName}
                    </h3>
                    {rankedWinners[2].groupName && (
                      <p className="text-sm font-semibold opacity-70">{rankedWinners[2].groupName}</p>
                    )}
                    <p className={`mt-1 font-mono text-[clamp(1.4rem,2.5vw,2.75rem)] font-black tabular-nums ${tokens.winnersP3ScoreClasses}`}>
                      {formatHundredthsToDisplayTime(rankedWinners[2].scoreHundredths)}
                    </p>
                  </div>
                  <div className={`h-[18vh] w-full rounded-t-2xl flex items-center justify-center font-barlow-condensed text-5xl font-black ${tokens.winnersP3StepClasses}`}>
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
            <div className={`flex flex-1 items-center justify-center font-barlow-condensed text-3xl tracking-widest ${tokens.emptyCategoryClasses}`}>
              {uiText.tv.noActiveCategory}
            </div>
          ) : (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <div className={`flex-1 overflow-hidden rounded-2xl ${tokens.tableContainerClasses}`}>
                <table
                  aria-label={uiText.tv.ranking(activeCategory.displayName)}
                  className="grid h-full w-full grid-rows-[3.5rem_minmax(0,1fr)] text-left"
                  data-density="full"
                >
                  {/* Table Header:
                      - Single results: "Angriff" and "Staffellauf"
                      - Combined results: "ANG" and "SL" */}
                  <thead className={`grid h-full items-center font-barlow-condensed text-base sm:text-lg uppercase tracking-wider ${tokens.theadClasses}`}>
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
                          <th className={`px-4 py-2 text-right ${tokens.gesamtThClasses}`}>GESAMT</th>
                        </>
                      ) : layoutKind === 'combined' ? (
                        <>
                          <th className="px-4 py-2 text-center">{cat1Name}</th>
                          <th className="px-4 py-2 text-center">{cat2Name}</th>
                          <th className={`px-4 py-2 text-right ${tokens.gesamtThClasses}`}>GESAMT</th>
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
                  <tbody className={`grid min-h-0 grid-rows-8 divide-y ${tokens.rowDividerClasses}`}>
                    {visibleRankingRows.length === 0 ? (
                      <tr className={`flex items-center justify-center font-barlow-condensed text-2xl uppercase tracking-widest ${tokens.noResultsClasses}`}>
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
                              className={`grid min-h-0 items-center overflow-hidden border-l-4 border-l-transparent ${tokens.upcomingRowClasses} ${gridColumns}`}
                              data-row-kind="upcoming"
                            >
                              <td className="px-4 py-1.5 text-center">
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-bold ${tokens.upcomingBadgeClasses}`}>
                                  BEREIT
                                </span>
                              </td>
                              <td className="min-w-0 px-4 py-1.5">
                                <div className={`truncate font-barlow-condensed text-xl sm:text-2xl font-black tracking-wide ${tokens.upcomingNameClasses}`}>
                                  {name}
                                </div>
                              </td>
                              <td className={`px-4 py-1.5 text-sm font-mono ${tokens.upcomingMetaClasses}`} colSpan={5}>
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
                          ? tokens.rowLeadingClassP1
                          : isP2
                          ? tokens.rowLeadingClassP2
                          : isP3
                          ? tokens.rowLeadingClassP3
                          : tokens.rowLeadingClassDefault;

                        const rankNumberClass = isP1
                          ? tokens.rank1NumberClasses
                          : isP2
                          ? tokens.rank2NumberClasses
                          : isP3
                          ? tokens.rank3NumberClasses
                          : tokens.rankOtherNumberClasses;

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
                                className={`inline-flex items-center justify-center font-barlow-condensed font-black text-[clamp(1.25rem,2.1vw,2.4rem)] ${rankNumberClass}`}
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
                                    className={`hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${tokens.leaderBadgeClasses}`}
                                  >
                                    LEADER
                                  </span>
                                )}
                                <span
                                  className={`truncate whitespace-nowrap font-barlow-condensed text-[clamp(1.2rem,2.2vw,2.3rem)] font-black uppercase tracking-wide ${tokens.competitorNameClasses}`}
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
                                    timeClass={tokens.timeClass}
                                  />
                                </td>
                                {/* Cat 1 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    timeClass={tokens.timeClass}
                                  />
                                </td>
                                {/* Cat 2 Attack */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.attackTimeHundredths}
                                    errors={secondary?.attackTimeErrors}
                                    scoreHundredths={secondary?.scoreHundredths}
                                    runStatus={secondary?.runStatus}
                                    timeClass={tokens.timeClass}
                                  />
                                </td>
                                {/* Cat 2 Relay */}
                                <td className="px-2 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={secondary?.relayRaceHundredths}
                                    errors={secondary?.relayRaceErrors}
                                    runStatus={secondary?.runStatus}
                                    timeClass={tokens.timeClass}
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className={`px-4 py-1 text-right font-mono font-black text-[clamp(1.4rem,2.5vw,2.75rem)] tabular-nums ${tokens.combinedScoreClasses}`}>
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
                                    timeClass={tokens.timeClass}
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
                                    timeClass={tokens.timeClass}
                                    groupLabel={isBrigadePairing && result.secondaryGroupName ? `Gr. ${result.secondaryGroupName}` : undefined}
                                  />
                                </td>
                                {/* Combined Score */}
                                <td className={`px-4 py-1 text-right font-mono font-black text-[clamp(1.4rem,2.5vw,2.75rem)] tabular-nums ${tokens.combinedScoreClasses}`}>
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
                                    timeClass={tokens.timeClass}
                                  />
                                </td>
                                {/* Staffellauf */}
                                <td className="px-4 py-1 text-center">
                                  <TvRunScoreCell
                                    rawTimeHundredths={primary?.relayRaceHundredths}
                                    errors={primary?.relayRaceErrors}
                                    runStatus={primary?.runStatus}
                                    timeClass={tokens.timeClass}
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
                                  timeClass={tokens.timeClass}
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
              <footer className={`mt-3 flex shrink-0 items-center justify-between px-2 text-xs font-semibold ${tokens.footerContainerClasses}`}>
                <div className="flex items-center gap-4">
                  <span className={tokens.footerPageClasses}>
                    SEITE {rankingPageIndex + 1} / {rankingPageCount}
                  </span>
                  <span className={tokens.footerBulletClasses}>•</span>
                  <span>{rankingPresentationRowsCount} TEILNEHMER IN DIESER KATEGORIE</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[11px] ${tokens.footerEngineClasses}`}>
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
