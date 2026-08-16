export const RANKING_PAGE_SIZE = 8;

export const RANKING_DENSITY_PRESENTATION = {
  sparse: {
    identity: 'text-[clamp(1.5rem,3vw,3.5rem)]',
    rank: 'text-[clamp(1.75rem,3.5vw,4rem)]',
    score: 'text-[clamp(2rem,4vw,4.25rem)]',
  },
  balanced: {
    identity: 'text-[clamp(1.35rem,2.4vw,2.75rem)]',
    rank: 'text-[clamp(1.5rem,2.6vw,3rem)]',
    score: 'text-[clamp(1.75rem,3vw,3.5rem)]',
  },
  full: {
    identity: 'text-[clamp(1.15rem,2vw,2.25rem)]',
    rank: 'text-[clamp(1.25rem,2.1vw,2.4rem)]',
    score: 'text-[clamp(1.4rem,2.5vw,2.75rem)]',
  },
} as const;
