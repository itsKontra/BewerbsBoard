export type TvIterationId = 1 | 2 | 3;

export interface TvIterationInfo {
  id: TvIterationId;
  name: string;
  tagline: string;
  badge: string;
  path: string;
  accentColor: string;
}

export const TV_ITERATIONS: Record<TvIterationId, TvIterationInfo> = {
  1: {
    id: 1,
    name: 'Telemetry Arena',
    tagline: 'Sports Broadcast Overlay • Live Timing & Deltas',
    badge: 'BROADCAST',
    path: '/tv/1',
    accentColor: '#00e5ff',
  },
  2: {
    id: 2,
    name: 'Tactical Iron',
    tagline: 'Alpine Industrial • High-Vis Firehouse Safety',
    badge: 'INDUSTRIAL',
    path: '/tv/2',
    accentColor: '#e2f802',
  },
  3: {
    id: 3,
    name: 'Precision Studio',
    tagline: 'Nordic Dual-Pane • Leader Spotlight & Ladder',
    badge: 'STUDIO',
    path: '/tv/3',
    accentColor: '#f6d89e',
  },
};
