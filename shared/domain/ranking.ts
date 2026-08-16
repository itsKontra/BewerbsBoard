import { type CategoryEntry } from './scoring.js';

// ---------------------------------------------------------------------------
// Shared dense-rank primitive
// ---------------------------------------------------------------------------

interface Rankable {
  rank?: number | null;
}

/**
 * Applies standard competition ranking (1, 2, 2, 4) in-place to an array of
 * items that are already sorted ascending by score.
 *
 * Mutates the `rank` field of each item. Returns the same array for chaining.
 */
export function applyDenseRank<T extends Rankable>(
  items: T[],
  getScore: (item: T) => number,
): T[] {
  let currentRank = 1;
  let previousScore: number | null = null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = getScore(item);
    if (previousScore !== null && score === previousScore) {
      item.rank = currentRank;
    } else {
      currentRank = i + 1;
      item.rank = currentRank;
      previousScore = score;
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Entry-level ranking
// ---------------------------------------------------------------------------

/**
 * Ranks VALID entries using standard competition ranking (1, 2, 2, 4).
 * Entries must have `scoreHundredths` already set.
 * Non-VALID entries and entries without a score are excluded from the output.
 * Returns a new array with cloned objects containing the updated ranks.
 */
export function rankEntries(entries: CategoryEntry[]): CategoryEntry[] {
  const validEntries = entries
    .filter((e) => e.runStatus === 'VALID' && e.scoreHundredths != null)
    .map(e => ({ ...e })); // clone to avoid mutating input

  validEntries.sort((a, b) => a.scoreHundredths! - b.scoreHundredths!);

  return applyDenseRank(validEntries, (e) => e.scoreHundredths!) as CategoryEntry[];
}

// ---------------------------------------------------------------------------
// Start-order compaction
// ---------------------------------------------------------------------------

/**
 * Compacts the start order of OPEN entries so they are contiguous from 1.
 * Caller is responsible for passing only OPEN entries; non-OPEN entries are
 * renumbered without warning if accidentally included.
 */
export function compactStartOrder(openEntries: CategoryEntry[]): CategoryEntry[] {
  return [...openEntries]
    .sort((a, b) => (a.startOrderPosition ?? Infinity) - (b.startOrderPosition ?? Infinity))
    .map((entry, index) => ({ ...entry, startOrderPosition: index + 1 }));
}

