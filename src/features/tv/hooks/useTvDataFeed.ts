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

export interface TvDataFeedAdapter {
  fetchTvState: () => Promise<TvStateApiResponse>;
  fetchResultsData: () => Promise<PublicResultsApiResponse>;
}

export const httpTvDataFeedAdapter: TvDataFeedAdapter = {
  fetchTvState: async (): Promise<TvStateApiResponse> => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const response = await fetch('/api/public/tv-state' + search);
    if (!response.ok) {
      throw new Error(`Failed to fetch tv state: ${response.status}`);
    }
    return response.json();
  },
  fetchResultsData: async (): Promise<PublicResultsApiResponse> => {
    const response = await fetch('/api/public/results');
    if (!response.ok) {
      throw new Error(`Failed to fetch results: ${response.status}`);
    }
    return response.json();
  },
};

export const demoTvDataFeedAdapter: TvDataFeedAdapter = {
  fetchTvState: async (): Promise<TvStateApiResponse> => {
    const { getDemoTvState } = await import('../../../mock/demo-scoreboard-data');
    return getDemoTvState(typeof window !== 'undefined' ? window.location.search : '');
  },
  fetchResultsData: async (): Promise<PublicResultsApiResponse> => {
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
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    const adapter = customAdapter ?? (isDemoMode ? demoTvDataFeedAdapter : httpTvDataFeedAdapter);

    const fetchState = async () => {
      try {
        const data = await adapter.fetchTvState();
        setTvState(data);
        setIsStateDisconnected(false);
      } catch {
        // Retain last known state on screen upon network/server disconnect
        setIsStateDisconnected(true);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, stateIntervalMs);
    return () => clearInterval(interval);
  }, [customAdapter, stateIntervalMs]);

  useEffect(() => {
    const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
    const adapter = customAdapter ?? (isDemoMode ? demoTvDataFeedAdapter : httpTvDataFeedAdapter);

    const fetchResults = async () => {
      try {
        const data = await adapter.fetchResultsData();
        setResultsData(data);
        setIsResultsDisconnected(false);
      } catch {
        // Retain last known results on screen upon network/server disconnect
        setIsResultsDisconnected(true);
      }
    };

    fetchResults();
    const interval = setInterval(fetchResults, resultsIntervalMs);
    return () => clearInterval(interval);
  }, [customAdapter, resultsIntervalMs]);

  const isDisconnected = isStateDisconnected || isResultsDisconnected;

  return {
    tvState,
    resultsData,
    isDisconnected,
  };
}
