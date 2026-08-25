import { parseThemeParam } from '../../shared/domain/tv-presentation.js';
import { createDemoData } from '../../shared/seed/seed-data.js';

const demo = createDemoData();

export function getDemoTvState(searchParams?: string) {
  let locationSearch = '';
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const location = (globalThis as { location?: { search?: string } }).location;
    if (location?.search) locationSearch = location.search;
  }

  const rawQuery = searchParams ?? locationSearch;
  const queryString = rawQuery.includes('?') ? rawQuery.slice(rawQuery.indexOf('?') + 1) : rawQuery;
  const params = new URLSearchParams(queryString);
  const overrideTheme = parseThemeParam(params.get('theme'));
  if (!overrideTheme) return demo.publicTvState;

  return {
    ...demo.publicTvState,
    tvPresentation: {
      ...demo.publicTvState.tvPresentation,
      theme: overrideTheme,
    },
  };
}

export const DEMO_RESULTS_DATA = demo.publicResults;
