import type { TvTheme } from '../../../../shared/domain/tv-presentation';
import { uiText } from '../../../ui-text';

export interface RowStyle {
  container: string;
  rankNumber: string;
}

export interface PodiumStyle {
  height: string;
  tone: string;
  name: string;
  group: string;
  time: string;
}

export interface TvPresentationStyle {
  label: string;
  summary: string;
  frameGradient: string;
  textColor: string;
  identityRail: string;
  headerSublabel: string;
  scanText: string;
  categoryTitle: string;
  clockText: string;
  sectionBorder: string;
  tableContainer: string;
  tableHeader: string;
  tableHeaderCombinedAccent: string;
  tableDivider: string;
  rowBase: string;
  rankOtherNumber: string;
  competitorName: string;
  emptyTableMessage: string;
  upcomingBorder: string;
  winnersTitle: string;
  podiumName: string;
  podiumGroup: string;
  podiumTime: string;

  preview: {
    accent: string;
    cardBg: string;
    text: string;
  };

  score: {
    time: string;
    penalty: string;
    total: string;
  };

  announcement: {
    headline: string;
    message: string;
  };

  row(rank: number | null): RowStyle;
  podium(place: 1 | 2 | 3): PodiumStyle;
}

interface RawThemeConfig {
  label: string;
  summary: string;
  frameGradient: string;
  textColor: string;
  identityRail: string;
  headerSublabel: string;
  scanText: string;
  categoryTitle: string;
  clockText: string;
  sectionBorder: string;
  tableContainer: string;
  tableHeader: string;
  tableHeaderCombinedAccent: string;
  tableDivider: string;
  rowBase: string;
  rowRank1: string;
  rowRank2: string;
  rowRank3: string;
  rank1Number: string;
  rank2Number: string;
  rank3Number: string;
  rankOtherNumber: string;
  competitorName: string;
  timeText: string;
  penaltyText: string;
  scoreTotal: string;
  emptyTableMessage: string;
  upcomingBorder: string;
  announcementHeadline: string;
  announcementMessage: string;
  winnersTitle: string;
  podiumName: string;
  podiumGroup: string;
  podiumTime: string;
  podiumSteps: {
    1: { height: string; tone: string };
    2: { height: string; tone: string };
    3: { height: string; tone: string };
  };
  previewAccent: string;
  previewCardBg: string;
  previewText: string;
}

function createTvPresentationStyle(config: RawThemeConfig): TvPresentationStyle {
  return {
    label: config.label,
    summary: config.summary,
    frameGradient: config.frameGradient,
    textColor: config.textColor,
    identityRail: config.identityRail,
    headerSublabel: config.headerSublabel,
    scanText: config.scanText,
    categoryTitle: config.categoryTitle,
    clockText: config.clockText,
    sectionBorder: config.sectionBorder,
    tableContainer: config.tableContainer,
    tableHeader: config.tableHeader,
    tableHeaderCombinedAccent: config.tableHeaderCombinedAccent,
    tableDivider: config.tableDivider,
    rowBase: config.rowBase,
    rankOtherNumber: config.rankOtherNumber,
    competitorName: config.competitorName,
    emptyTableMessage: config.emptyTableMessage,
    upcomingBorder: config.upcomingBorder,
    winnersTitle: config.winnersTitle,
    podiumName: config.podiumName,
    podiumGroup: config.podiumGroup,
    podiumTime: config.podiumTime,

    preview: {
      accent: config.previewAccent,
      cardBg: config.previewCardBg,
      text: config.previewText,
    },

    score: {
      time: config.timeText,
      penalty: config.penaltyText,
      total: config.scoreTotal,
    },

    announcement: {
      headline: config.announcementHeadline,
      message: config.announcementMessage,
    },

    row(rank: number | null): RowStyle {
      if (rank === 1) {
        return { container: config.rowRank1, rankNumber: config.rank1Number };
      }
      if (rank === 2) {
        return { container: config.rowRank2, rankNumber: config.rank2Number };
      }
      if (rank === 3) {
        return { container: config.rowRank3, rankNumber: config.rank3Number };
      }
      return {
        container: `border-l-4 border-l-transparent ${config.rowBase}`,
        rankNumber: config.rankOtherNumber,
      };
    },

    podium(place: 1 | 2 | 3): PodiumStyle {
      const step = config.podiumSteps[place];
      return {
        height: step.height,
        tone: step.tone,
        name: config.podiumName,
        group: config.podiumGroup,
        time: config.podiumTime,
      };
    },
  };
}

export const TV_PRESENTATION_STYLES: Record<TvTheme, TvPresentationStyle> = {
  broadcast: createTvPresentationStyle({
    label: uiText.tv.themes.broadcast.label,
    summary: uiText.tv.themes.broadcast.summary,
    frameGradient: 'from-slate-950 via-slate-900 to-black',
    textColor: 'text-white',
    identityRail: 'border-white/15 bg-black/25',
    headerSublabel: 'text-sky-300',
    scanText: 'text-sky-800',
    previewAccent: 'bg-sky-400',
    previewCardBg: 'bg-white/70',
    previewText: 'bg-white/25',
    categoryTitle: 'text-white',
    clockText: 'text-neutral-300',
    sectionBorder: 'border-neutral-800',
    tableContainer: 'border-neutral-800 bg-neutral-900/50 shadow-2xl',
    tableHeader: 'border-b-2 border-neutral-800 bg-neutral-950 text-neutral-400',
    tableHeaderCombinedAccent: 'text-amber-500',
    tableDivider: 'divide-neutral-800/60',
    rowBase: 'bg-neutral-900/30',
    rowRank1: 'border-l-4 border-l-amber-400 tv-leading-bar-1 bg-neutral-900/40',
    rowRank2: 'tv-leading-bar-2 bg-neutral-900/40',
    rowRank3: 'tv-leading-bar-3 bg-neutral-900/40',
    rank1Number: 'text-amber-300 font-extrabold',
    rank2Number: 'text-slate-300 font-bold',
    rank3Number: 'text-amber-600 font-bold',
    rankOtherNumber: 'text-white/65',
    competitorName: 'text-white',
    timeText: 'text-white',
    penaltyText: 'text-red-300 bg-red-950/60 ring-1 ring-inset ring-red-900/50',
    scoreTotal: 'text-amber-300',
    emptyTableMessage: 'text-neutral-500',
    upcomingBorder: 'border-t-4 border-t-sky-600/50',
    announcementHeadline: 'text-white',
    announcementMessage: 'text-white/70',
    winnersTitle: 'text-amber-400',
    podiumName: 'text-white',
    podiumGroup: 'text-white/65',
    podiumTime: 'text-amber-200',
    podiumSteps: {
      1: { height: 'h-[32vh]', tone: 'border-amber-400 bg-amber-900 text-amber-300' },
      2: { height: 'h-[25vh]', tone: 'border-slate-400 bg-slate-800 text-slate-200' },
      3: { height: 'h-[18vh]', tone: 'border-amber-700 bg-amber-950 text-amber-600' },
    },
  }),
  ceremony: createTvPresentationStyle({
    label: uiText.tv.themes.ceremony.label,
    summary: uiText.tv.themes.ceremony.summary,
    frameGradient: 'from-stone-950 via-amber-950 to-stone-950',
    textColor: 'text-white',
    identityRail: 'border-amber-400/40 bg-amber-950/30',
    headerSublabel: 'text-amber-400',
    scanText: 'text-amber-800',
    previewAccent: 'bg-amber-400',
    previewCardBg: 'bg-amber-100/70',
    previewText: 'bg-amber-200/25',
    categoryTitle: 'text-amber-100',
    clockText: 'text-amber-200/80',
    sectionBorder: 'border-amber-900/60',
    tableContainer: 'border-amber-900/50 bg-stone-900/50 shadow-2xl',
    tableHeader: 'border-b-2 border-amber-900 bg-stone-950 text-amber-200/70',
    tableHeaderCombinedAccent: 'text-amber-400',
    tableDivider: 'divide-amber-950/60',
    rowBase: 'bg-stone-900/30',
    rowRank1: 'border-l-4 border-l-amber-400 tv-leading-bar-1 bg-stone-900/40',
    rowRank2: 'tv-leading-bar-2 bg-stone-900/40',
    rowRank3: 'tv-leading-bar-3 bg-stone-900/40',
    rank1Number: 'text-amber-300 font-extrabold',
    rank2Number: 'text-stone-300 font-bold',
    rank3Number: 'text-amber-600 font-bold',
    rankOtherNumber: 'text-white/65',
    competitorName: 'text-white',
    timeText: 'text-white',
    penaltyText: 'text-red-300 bg-red-950/50 ring-1 ring-inset ring-red-900/40',
    scoreTotal: 'text-amber-300',
    emptyTableMessage: 'text-amber-700/60',
    upcomingBorder: 'border-t-4 border-t-amber-600/50',
    announcementHeadline: 'text-amber-100',
    announcementMessage: 'text-amber-200/80',
    winnersTitle: 'text-amber-400',
    podiumName: 'text-amber-50',
    podiumGroup: 'text-amber-200/70',
    podiumTime: 'text-amber-300',
    podiumSteps: {
      1: { height: 'h-[32vh]', tone: 'border-amber-400 bg-amber-900/80 text-amber-200' },
      2: { height: 'h-[25vh]', tone: 'border-stone-400 bg-stone-800 text-stone-200' },
      3: { height: 'h-[18vh]', tone: 'border-amber-800 bg-stone-900 text-amber-600' },
    },
  }),
  outdoor: createTvPresentationStyle({
    label: uiText.tv.themes.outdoor.label,
    summary: uiText.tv.themes.outdoor.summary,
    frameGradient: 'from-slate-100 via-slate-50 to-zinc-200',
    textColor: 'text-slate-950',
    identityRail: 'border-slate-300 bg-white/90 shadow-sm',
    headerSublabel: 'text-sky-700',
    scanText: 'text-slate-900',
    previewAccent: 'bg-amber-500',
    previewCardBg: 'bg-slate-800/70',
    previewText: 'bg-slate-300/40',
    categoryTitle: 'text-slate-950',
    clockText: 'text-slate-700',
    sectionBorder: 'border-slate-300',
    tableContainer: 'border-slate-300 bg-white shadow-xl',
    tableHeader: 'border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold',
    tableHeaderCombinedAccent: 'text-amber-800',
    tableDivider: 'divide-slate-200',
    rowBase: 'bg-slate-50/60',
    rowRank1: 'border-l-4 border-l-amber-500 tv-leading-bar-1 bg-slate-50/80',
    rowRank2: 'tv-leading-bar-2 bg-slate-50/80',
    rowRank3: 'tv-leading-bar-3 bg-slate-50/80',
    rank1Number: 'text-amber-950 font-black',
    rank2Number: 'text-slate-800 font-bold',
    rank3Number: 'text-amber-900 font-bold',
    rankOtherNumber: 'text-slate-600 font-bold',
    competitorName: 'text-slate-950',
    timeText: 'text-slate-950',
    penaltyText: 'text-red-700 bg-red-100 ring-1 ring-inset ring-red-200',
    scoreTotal: 'text-amber-800',
    emptyTableMessage: 'text-slate-500',
    upcomingBorder: 'border-t-4 border-t-sky-500',
    announcementHeadline: 'text-slate-950',
    announcementMessage: 'text-slate-700',
    winnersTitle: 'text-amber-700',
    podiumName: 'text-slate-950',
    podiumGroup: 'text-slate-600',
    podiumTime: 'text-amber-900',
    podiumSteps: {
      1: { height: 'h-[32vh]', tone: 'border-amber-500 bg-amber-200 text-amber-950 shadow-md' },
      2: { height: 'h-[25vh]', tone: 'border-slate-400 bg-slate-200 text-slate-900 shadow-md' },
      3: { height: 'h-[18vh]', tone: 'border-amber-700 bg-amber-100 text-amber-900 shadow-md' },
    },
  }),
};
