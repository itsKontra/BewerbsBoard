import { useEffect, useMemo, useState } from 'react';
import type { CategoryResultData, PublicResultsApiResponse } from '../../public/types';
import type { RankingPresentationRow } from '../components/canvases/RankingCanvas';
import { RANKING_PAGE_SIZE } from '../utils/presentation-constants';
import type { TvCategoryConfig, TvStateApiResponse } from './useTvDataFeed';

const MAX_UPCOMING_ENTRIES = 8;
const DEFAULT_RANKING_PAGE_DURATION_MS = 8000;

export interface TvCategoryRotationEntry {
  categoryKey: string;
  durationSeconds: number;
}

export function rankingPresentationRowsForCategory(
  category: CategoryResultData | undefined,
  maxUpcomingEntries: number = MAX_UPCOMING_ENTRIES,
): RankingPresentationRow[] {
  if (!category) return [];

  const rankedResults = Array.isArray(category.rankedResults) ? category.rankedResults : [];
  const upcomingEntries = category.type === 'standard' && Array.isArray(category.openEntries)
    ? category.openEntries.slice(0, maxUpcomingEntries)
    : [];

  return [
    ...rankedResults.map((entry) => ({ kind: 'ranked' as const, entry })),
    ...upcomingEntries.map((entry) => ({ kind: 'upcoming' as const, entry })),
  ];
}

export function categoryRotationSignature(categoriesConfig?: Record<string, TvCategoryConfig>): string {
  if (!categoriesConfig) return '[]';

  return JSON.stringify(
    Object.keys(categoriesConfig)
      .filter((categoryKey) => categoriesConfig[categoryKey].tvEnabled)
      .sort((a, b) => categoriesConfig[a].order - categoriesConfig[b].order)
      .map((categoryKey): TvCategoryRotationEntry => ({
        categoryKey,
        durationSeconds: categoriesConfig[categoryKey].displayDuration || 10,
      })),
  );
}

export interface UseRankingPagerOptions {
  maxUpcomingEntries?: number;
  pageSize?: number;
}

export interface UseRankingPagerResult {
  activeCategory: CategoryResultData | undefined;
  activeCategoryKey: string | null;
  activeRankedResults: CategoryResultData['rankedResults'];
  rankingPresentationRows: RankingPresentationRow[];
  visibleRankingRows: RankingPresentationRow[];
  rankingPresentationRowsCount: number;
  rankingPageCount: number;
  rankingPageIndex: number;
}

export function useRankingPager(
  tvState: TvStateApiResponse | null,
  resultsData: PublicResultsApiResponse | null,
  options?: UseRankingPagerOptions,
): UseRankingPagerResult {
  const maxUpcoming = options?.maxUpcomingEntries ?? MAX_UPCOMING_ENTRIES;
  const pageSize = options?.pageSize ?? RANKING_PAGE_SIZE;

  const [rotationIndex, setRotationIndex] = useState(0);
  const [rankingPage, setRankingPage] = useState({ categoryKey: null as string | null, index: 0 });

  const rotationSignature = categoryRotationSignature(tvState?.categoriesConfig);
  const categoryRotationSchedule = useMemo<TvCategoryRotationEntry[]>(
    () => JSON.parse(rotationSignature),
    [rotationSignature],
  );

  useEffect(() => {
    if (tvState?.mode !== 'ROTATION' || categoryRotationSchedule.length === 0) return;

    const currentCategory = categoryRotationSchedule[rotationIndex % categoryRotationSchedule.length];
    const timer = setTimeout(() => {
      setRotationIndex((current) => (current + 1) % categoryRotationSchedule.length);
    }, currentCategory.durationSeconds * 1000);

    return () => clearTimeout(timer);
  }, [tvState?.mode, categoryRotationSchedule, rotationIndex]);

  const activeCategoryKey = tvState?.mode === 'ROTATION'
    ? categoryRotationSchedule[rotationIndex % categoryRotationSchedule.length]?.categoryKey ?? null
    : tvState?.mode === 'FIXED' || tvState?.mode === 'WINNERS'
      ? tvState.selectedCategoryId
      : null;

  const activeCategory = activeCategoryKey && resultsData
    ? resultsData.categories[activeCategoryKey]
    : undefined;

  const activeRankedResults = Array.isArray(activeCategory?.rankedResults)
    ? activeCategory.rankedResults
    : [];

  const rankingPresentationRows = rankingPresentationRowsForCategory(activeCategory, maxUpcoming);

  const rankingPageCount = Math.max(
    1,
    Math.ceil(rankingPresentationRows.length / pageSize),
  );

  const rankingPageIndex = rankingPage.categoryKey === activeCategoryKey
    && rankingPage.index < rankingPageCount
    ? rankingPage.index
    : 0;

  useEffect(() => {
    setRankingPage((current) => {
      if (current.categoryKey === activeCategoryKey && current.index < rankingPageCount) {
        return current;
      }
      return { categoryKey: activeCategoryKey, index: 0 };
    });
  }, [activeCategoryKey, rankingPageCount]);

  useEffect(() => {
    const isRankingMode = tvState?.mode === 'ROTATION' || tvState?.mode === 'FIXED';
    if (!isRankingMode || !activeCategoryKey || rankingPageCount <= 1) return;

    const timer = setTimeout(() => {
      setRankingPage({
        categoryKey: activeCategoryKey,
        index: (rankingPageIndex + 1) % rankingPageCount,
      });
    }, tvState?.rankingPageDurationMs ?? DEFAULT_RANKING_PAGE_DURATION_MS);

    return () => clearTimeout(timer);
  }, [tvState?.mode, tvState?.rankingPageDurationMs, activeCategoryKey, rankingPageCount, rankingPageIndex]);

  const isLastPage = rankingPageCount > 1 && rankingPageIndex === rankingPageCount - 1;
  const hasRemainder = rankingPresentationRows.length % pageSize !== 0;
  const pageStartIndex = (isLastPage && hasRemainder)
    ? Math.max(0, rankingPresentationRows.length - pageSize)
    : rankingPageIndex * pageSize;

  const visibleRankingRows = rankingPresentationRows.slice(
    pageStartIndex,
    pageStartIndex + pageSize,
  );

  return {
    activeCategory,
    activeCategoryKey,
    activeRankedResults,
    rankingPresentationRows,
    visibleRankingRows,
    rankingPresentationRowsCount: rankingPresentationRows.length,
    rankingPageCount,
    rankingPageIndex,
  };
}
