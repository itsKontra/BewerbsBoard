// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTvDataFeed, httpTvDataFeedAdapter, demoTvDataFeedAdapter } from './useTvDataFeed';

const mockState = {
  mode: 'ROTATION' as const,
  selectedCategoryId: null,
  updatedAt: 1000,
  categoriesConfig: {},
  eventTitle: 'Test Event',
};

const mockResults = {
  eventTitle: 'Test Event',
  publicUrl: 'https://example.com',
  timestamp: 1000,
  categories: {},
};

describe('useTvDataFeed Hook and Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.pushState({}, '', '/tv');
  });

  describe('Adapters', () => {
    it('httpTvDataFeedAdapter fetches state and results from public API endpoints', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/public/tv-state') {
          return { ok: true, json: async () => mockState } as Response;
        }
        if (url === '/api/public/results') {
          return { ok: true, json: async () => mockResults } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const state = await httpTvDataFeedAdapter.fetchTvState();
      const results = await httpTvDataFeedAdapter.fetchResultsData();

      expect(state).toEqual(mockState);
      expect(results).toEqual(mockResults);
    });

    it('httpTvDataFeedAdapter throws on HTTP failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

      await expect(httpTvDataFeedAdapter.fetchTvState()).rejects.toThrow();
      await expect(httpTvDataFeedAdapter.fetchResultsData()).rejects.toThrow();
    });

    it('demoTvDataFeedAdapter returns demo data', async () => {
      const state = await demoTvDataFeedAdapter.fetchTvState();
      const results = await demoTvDataFeedAdapter.fetchResultsData();

      expect(state.eventTitle).toBe('BFLB FREIWILLIGE FEUERWEHR');
      expect(results.eventTitle).toBe('BFLB FREIWILLIGE FEUERWEHR');
    });
  });

  describe('useTvDataFeed Hook', () => {
    it('fetches data using HTTP adapter by default and polls on interval', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/public/tv-state') {
          return { ok: true, json: async () => mockState } as Response;
        }
        if (url === '/api/public/results') {
          return { ok: true, json: async () => mockResults } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const { result } = renderHook(() => useTvDataFeed());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(result.current.tvState).toEqual(mockState);
      expect(result.current.resultsData).toEqual(mockResults);
      expect(result.current.isDisconnected).toBe(false);

      // Verify polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/public/tv-state', {
        signal: expect.any(AbortSignal),
      });
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/public/results', {
        signal: expect.any(AbortSignal),
      });
    });

    it('uses DemoAdapter when ?demo=true parameter is present', async () => {
      window.history.pushState({}, '', '/tv?demo=true');

      const { result } = renderHook(() => useTvDataFeed());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(result.current.tvState?.eventTitle).toBe('BFLB FREIWILLIGE FEUERWEHR');
      expect(result.current.resultsData?.eventTitle).toBe('BFLB FREIWILLIGE FEUERWEHR');
      expect(result.current.isDisconnected).toBe(false);
    });

    it('allows injecting a custom TvDataFeedAdapter', async () => {
      const customAdapter = {
        fetchTvState: vi.fn().mockResolvedValue(mockState),
        fetchResultsData: vi.fn().mockResolvedValue(mockResults),
      };

      const { result } = renderHook(() => useTvDataFeed(customAdapter));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(result.current.tvState).toEqual(mockState);
      expect(result.current.resultsData).toEqual(mockResults);
      expect(customAdapter.fetchTvState).toHaveBeenCalledWith(expect.any(AbortSignal));
      expect(customAdapter.fetchResultsData).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it('sets isDisconnected to true when fetches fail', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTvDataFeed());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(result.current.isDisconnected).toBe(true);
    });

    it('aborts signals and suppresses errors on unmount', async () => {
      let stateSignal: AbortSignal | undefined;
      let resultsSignal: AbortSignal | undefined;

      const customAdapter = {
        fetchTvState: vi.fn().mockImplementation((signal?: AbortSignal) => {
          stateSignal = signal;
          return new Promise((_, reject) => {
            signal?.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          });
        }),
        fetchResultsData: vi.fn().mockImplementation((signal?: AbortSignal) => {
          resultsSignal = signal;
          return new Promise((_, reject) => {
            signal?.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          });
        }),
      };

      const { unmount, result } = renderHook(() => useTvDataFeed(customAdapter));

      expect(stateSignal).toBeDefined();
      expect(resultsSignal).toBeDefined();
      expect(stateSignal?.aborted).toBe(false);
      expect(resultsSignal?.aborted).toBe(false);

      act(() => {
        unmount();
      });

      expect(stateSignal?.aborted).toBe(true);
      expect(resultsSignal?.aborted).toBe(true);
      // isDisconnected should NOT be flipped to true by unmount AbortError
      expect(result.current.isDisconnected).toBe(false);
    });

    it('ignores older out-of-order responses when a newer poll finishes first', async () => {
      let resolveFirstState!: (value: any) => void;
      let resolveSecondState!: (value: any) => void;

      let callCount = 0;
      const customAdapter = {
        fetchTvState: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return new Promise((resolve) => {
              resolveFirstState = resolve;
            });
          }
          return new Promise((resolve) => {
            resolveSecondState = resolve;
          });
        }),
        fetchResultsData: vi.fn().mockResolvedValue(mockResults),
      };

      const { result } = renderHook(() =>
        useTvDataFeed(customAdapter, { stateIntervalMs: 1000, resultsIntervalMs: 1000 }),
      );

      // Trigger second poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(callCount).toBe(2);

      // Newer response resolves first
      await act(async () => {
        resolveSecondState({ ...mockState, eventTitle: 'Newer Event' });
      });

      expect(result.current.tvState?.eventTitle).toBe('Newer Event');

      // Older response resolves later
      await act(async () => {
        resolveFirstState({ ...mockState, eventTitle: 'Older Event' });
      });

      // State must retain the newer update and not be overwritten by the stale one
      expect(result.current.tvState?.eventTitle).toBe('Newer Event');
    });
  });
});
