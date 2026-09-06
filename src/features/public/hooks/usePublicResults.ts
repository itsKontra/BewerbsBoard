import { useCallback, useEffect, useRef, useState } from 'react';
import { uiText } from '../../../ui-text';
import type { PublicResultsApiResponse } from '../types';

export function usePublicResults() {
  const [data, setData] = useState<PublicResultsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const latestRequestRef = useRef(0);
  const pendingRef = useRef(false);
  const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';

  const refresh = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const requestId = ++latestRequestRef.current;
    const controller = controllerRef.current;
    try {
      let result: PublicResultsApiResponse;
      if (isDemo) {
        const { DEMO_RESULTS_DATA } = await import('../../../mock/demo-scoreboard-data');
        result = DEMO_RESULTS_DATA as PublicResultsApiResponse;
      } else {
        const response = await fetch('/api/public/results', { signal: controller?.signal });
        if (!response.ok) throw new Error(uiText.publicScoreboard.resultsLoadError(response.status));
        result = await response.json();
      }
      if (controller?.signal.aborted || requestId !== latestRequestRef.current) return;
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (controller?.signal.aborted || requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : uiText.publicScoreboard.resultsCouldNotBeLoaded);
    } finally {
      if (!controller?.signal.aborted && requestId === latestRequestRef.current) {
        pendingRef.current = false;
        setLoading(false);
      }
    }
  }, [isDemo]);

  useEffect(() => {
    controllerRef.current = new AbortController();
    pendingRef.current = false;
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => {
      controllerRef.current?.abort();
      clearInterval(interval);
    };
  }, [refresh]);

  return { data, loading, error, lastUpdated, refresh, isDemo };
}
