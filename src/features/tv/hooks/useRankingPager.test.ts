// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PublicResultsApiResponse } from '../../public/components/PublicScoreboard';
import type { TvStateApiResponse } from './useTvDataFeed';
import {
  useRankingPager,
  categoryRotationSignature,
  rankingPresentationRowsForCategory,
} from './useRankingPager';

const mockTvState: TvStateApiResponse = {
  mode: 'ROTATION',
  selectedCategoryId: null,
  updatedAt: 1000,
  eventTitle: 'TEST EVENT',
  rankingPageDurationMs: 5000,
  categoriesConfig: {
    'bronze-aktiv': { tvEnabled: true, order: 1, displayDuration: 10 },
    'silber-aktiv': { tvEnabled: true, order: 2, displayDuration: 20 },
    'disabled-cat': { tvEnabled: false, order: 3, displayDuration: 10 },
  },
};

const mockResultsData: PublicResultsApiResponse = {
  eventTitle: 'TEST EVENT',
  publicUrl: 'https://test.at',
  timestamp: 1000,
  categories: {
    'bronze-aktiv': {
      id: 'bronze-aktiv',
      displayName: 'Bronze Aktiv',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      rankedResults: Array.from({ length: 12 }, (_, i) => ({
        rank: i + 1,
        groupId: `g-bronze-${i + 1}`,
        fireBrigadeId: `fb-bronze-${i + 1}`,
        fireBrigadeName: `FF Bronze ${i + 1}`,
        groupName: `Gr ${i + 1}`,
        scoreHundredths: 4000 + i * 10,
        primaryRun: {
          entryId: `e-bronze-${i + 1}`,
          attackTimeHundredths: 4000 + i * 10,
          attackTimeErrors: 0,
          relayRaceHundredths: null,
          relayRaceErrors: null,
          scoreHundredths: 4000 + i * 10,
        },
      })),
      openEntries: [
        { startOrderPosition: 1, fireBrigadeName: 'FF Upcoming 1', groupName: 'Gr 1' },
      ],
      dnfEntries: [],
    },
    'silber-aktiv': {
      id: 'silber-aktiv',
      displayName: 'Silber Aktiv',
      publicEnabled: true,
      order: 2,
      type: 'combined',
      rankedResults: Array.from({ length: 3 }, (_, i) => ({
        rank: i + 1,
        groupId: `g-silber-${i + 1}`,
        fireBrigadeId: `fb-silber-${i + 1}`,
        fireBrigadeName: `FF Silber ${i + 1}`,
        groupName: `Gr ${i + 1}`,
        scoreHundredths: 3000 + i * 10,
        primaryRun: {
          entryId: `e-silber-${i + 1}`,
          attackTimeHundredths: 3000 + i * 10,
          attackTimeErrors: 0,
          relayRaceHundredths: null,
          relayRaceErrors: null,
          scoreHundredths: 3000 + i * 10,
        },
      })),
      openEntries: [
        { startOrderPosition: 1, fireBrigadeName: 'FF Should Not Show', groupName: 'Gr 1' },
      ],
      dnfEntries: [],
    },
  },
};

describe('useRankingPager helpers', () => {
  it('categoryRotationSignature filters disabled categories and sorts by order', () => {
    const signature = categoryRotationSignature(mockTvState.categoriesConfig);
    const parsed = JSON.parse(signature);

    expect(parsed).toEqual([
      { categoryKey: 'bronze-aktiv', durationSeconds: 10 },
      { categoryKey: 'silber-aktiv', durationSeconds: 20 },
    ]);
  });

  it('rankingPresentationRowsForCategory includes openEntries for standard type and excludes for combined', () => {
    const standardRows = rankingPresentationRowsForCategory(
      mockResultsData.categories['bronze-aktiv'],
      5,
    );
    expect(standardRows).toHaveLength(13); // 12 ranked + 1 upcoming
    expect(standardRows[12]).toEqual({
      kind: 'upcoming',
      entry: { startOrderPosition: 1, fireBrigadeName: 'FF Upcoming 1', groupName: 'Gr 1' },
    });

    const combinedRows = rankingPresentationRowsForCategory(
      mockResultsData.categories['silber-aktiv'],
      5,
    );
    expect(combinedRows).toHaveLength(3); // only 3 ranked, openEntries ignored for combined
  });
});

describe('useRankingPager hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty defaults when tvState or resultsData is null', () => {
    const { result } = renderHook(() => useRankingPager(null, null));

    expect(result.current.activeCategory).toBeUndefined();
    expect(result.current.activeCategoryKey).toBeNull();
    expect(result.current.activeRankedResults).toEqual([]);
    expect(result.current.visibleRankingRows).toEqual([]);
    expect(result.current.rankingPageCount).toBe(1);
    expect(result.current.rankingPageIndex).toBe(0);
  });

  it('rotates categories according to displayDuration schedule', async () => {
    const { result } = renderHook(() => useRankingPager(mockTvState, mockResultsData));

    // Initially bronze-aktiv (order 1)
    expect(result.current.activeCategoryKey).toBe('bronze-aktiv');
    expect(result.current.activeCategory?.displayName).toBe('Bronze Aktiv');

    // Advance by 10s (bronze-aktiv displayDuration)
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.activeCategoryKey).toBe('silber-aktiv');
    expect(result.current.activeCategory?.displayName).toBe('Silber Aktiv');

    // Advance by 20s (silber-aktiv displayDuration)
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // Wraps back to bronze-aktiv
    expect(result.current.activeCategoryKey).toBe('bronze-aktiv');
  });

  it('handles FIXED mode category selection', () => {
    const fixedState: TvStateApiResponse = {
      ...mockTvState,
      mode: 'FIXED',
      selectedCategoryId: 'silber-aktiv',
    };

    const { result } = renderHook(() => useRankingPager(fixedState, mockResultsData));

    expect(result.current.activeCategoryKey).toBe('silber-aktiv');
    expect(result.current.activeCategory?.displayName).toBe('Silber Aktiv');
  });

  it('pages through ranking rows and advances page index timer', async () => {
    const fixedState: TvStateApiResponse = {
      ...mockTvState,
      mode: 'FIXED',
      selectedCategoryId: 'bronze-aktiv',
      rankingPageDurationMs: 5000,
    };

    const { result } = renderHook(() => useRankingPager(fixedState, mockResultsData));

    // 12 ranked + 1 upcoming = 13 presentation rows. With pageSize=8, pageCount is 2.
    expect(result.current.rankingPresentationRowsCount).toBe(13);
    expect(result.current.rankingPageCount).toBe(2);
    expect(result.current.rankingPageIndex).toBe(0);
    expect(result.current.visibleRankingRows).toHaveLength(8);
    expect((result.current.visibleRankingRows[0] as any).entry.fireBrigadeName).toBe('FF Bronze 1');

    // Advance page duration
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.rankingPageIndex).toBe(1);
    // Page 2 shows remaining 8 rows (last page remainder logic: items 5-12)
    expect(result.current.visibleRankingRows).toHaveLength(8);

    // Advance again -> wraps to page 0
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.rankingPageIndex).toBe(0);
  });

  it('resets page index when category changes', async () => {
    const { result, rerender } = renderHook(
      ({ tvState }) => useRankingPager(tvState, mockResultsData),
      { initialProps: { tvState: { ...mockTvState, mode: 'FIXED' as const, selectedCategoryId: 'bronze-aktiv' } } },
    );

    // Advance to page 1
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.rankingPageIndex).toBe(1);

    // Switch to silber-aktiv
    rerender({
      tvState: { ...mockTvState, mode: 'FIXED' as const, selectedCategoryId: 'silber-aktiv' },
    });

    expect(result.current.activeCategoryKey).toBe('silber-aktiv');
    expect(result.current.rankingPageIndex).toBe(0);
  });
});
