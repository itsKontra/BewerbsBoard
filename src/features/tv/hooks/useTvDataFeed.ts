import { useEffect, useState } from 'react';
import type { PublicResultsApiResponse } from '../../public/components/PublicScoreboard';
import type { TvTheme } from '../../../../shared/domain/tv-presentation';

export type TvMode = 'ROTATION' | 'FIXED' | 'MESSAGE' | 'WINNERS';

export interface TvCategoryConfig {
  tvEnabled: boolean;
  order: number;
  displayDuration?: number;
}

export interface ServerNetworkInfo {
  serverIp: string;
  serverPort: number;
  adminUrl: string;
  availableIps: Array<{ interfaceName: string; ip: string }>;
}

export interface TvStateApiResponse {
  mode: TvMode;
  selectedCategoryId: string | null;
  updatedAt: number | null;
  tvAnnouncement?: { headline?: string; message?: string } | null;
  categoriesConfig: Record<string, TvCategoryConfig>;
  rankingPageDurationMs?: number;
  eventTitle: string;
  serverInfo?: ServerNetworkInfo;
  tvPresentation?: {
    theme: TvTheme;
    logoUrl: string;
    headerLabel?: string;
    qrCodeEnabled?: boolean;
    qrCodeAlwaysVisible?: boolean;
    qrCodeIntervalSeconds?: number;
    qrCodeDurationSeconds?: number;
    adminSplashEnabled?: boolean;
  };
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError')
  );
}

export interface TvDataFeedAdapter {
  fetchTvState: (signal?: AbortSignal) => Promise<TvStateApiResponse>;
  fetchResultsData: (signal?: AbortSignal) => Promise<PublicResultsApiResponse>;
}

export const httpTvDataFeedAdapter: TvDataFeedAdapter = {
  fetchTvState: async (signal?: AbortSignal): Promise<TvStateApiResponse> => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const response = await fetch('/api/public/tv-state' + search, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`Failed to fetch tv state: ${response.status}`);
    }
    return response.json();
  },
  fetchResultsData: async (signal?: AbortSignal): Promise<PublicResultsApiResponse> => {
    const response = await fetch('/api/public/results', signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`Failed to fetch results: ${response.status}`);
    }
    return response.json();
  },
};

export const demoTvDataFeedAdapter: TvDataFeedAdapter = {
  fetchTvState: async (_signal?: AbortSignal): Promise<TvStateApiResponse> => {
    const { getDemoTvState } = await import('../../../mock/demo-scoreboard-data');
    return getDemoTvState(typeof window !== 'undefined' ? window.location.search : '');
  },
  fetchResultsData: async (_signal?: AbortSignal): Promise<PublicResultsApiResponse> => {
    const { DEMO_RESULTS_DATA } = await import('../../../mock/demo-scoreboard-data');
    return DEMO_RESULTS_DATA;
  },
};

export interface UseTvDataFeedOptions {
  stateIntervalMs?: number;
  resultsIntervalMs?: number;
}

export function useTvDataFeed(
  customAdapter?: TvDataFeedAdapter,
  options?: UseTvDataFeedOptions,
) {
  const [tvState, setTvState] = useState<TvStateApiResponse | null>(null);
  const [resultsData, setResultsData] = useState<PublicResultsApiResponse | null>(null);
  const [isStateDisconnected, setIsStateDisconnected] = useState(false);
  const [isResultsDisconnected, setIsResultsDisconnected] = useState(false);

  const stateIntervalMs = options?.stateIntervalMs ?? 3000;
  const resultsIntervalMs = options?.resultsIntervalMs ?? 5000;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    let latestRequestId = 0;
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    const adapter = customAdapter ?? (isDemoMode ? demoTvDataFeedAdapter : httpTvDataFeedAdapter);

    const fetchState = async () => {
      const requestId = ++latestRequestId;
      try {
        const data = await adapter.fetchTvState(controller.signal);
        if (!isMounted || controller.signal.aborted || requestId !== latestRequestId) return;
        setTvState(data);
        setIsStateDisconnected(false);
      } catch (err: unknown) {
        if (!isMounted || controller.signal.aborted || isAbortError(err)) return;
        if (requestId === latestRequestId) {
          // Retain last known state on screen upon network/server disconnect
          setIsStateDisconnected(true);
        }
      }
    };

    fetchState();
    const interval = setInterval(fetchState, stateIntervalMs);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [customAdapter, stateIntervalMs]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    let latestRequestId = 0;
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    const adapter = customAdapter ?? (isDemoMode ? demoTvDataFeedAdapter : httpTvDataFeedAdapter);

    const fetchResults = async () => {
      const requestId = ++latestRequestId;
      try {
        const data = await adapter.fetchResultsData(controller.signal);
        if (!isMounted || controller.signal.aborted || requestId !== latestRequestId) return;
        setResultsData(data);
        setIsResultsDisconnected(false);
      } catch (err: unknown) {
        if (!isMounted || controller.signal.aborted || isAbortError(err)) return;
        if (requestId === latestRequestId) {
          // Retain last known results on screen upon network/server disconnect
          setIsResultsDisconnected(true);
        }
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, resultsIntervalMs);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [customAdapter, resultsIntervalMs]);

  const isDisconnected = isStateDisconnected || isResultsDisconnected;

  return {
    tvState,
    resultsData,
    isDisconnected,
  };
}
