import { type CategoryEntry, type ScoreDescriptor, type GroupInfo, computeEntryScore } from './scoring.js';
import { applyDenseRank } from './ranking.js';

export interface EvaluationDescriptor {
  id: string;
  categoryTypeId1: string;
  categoryTypeId2: string | null;
  hasRelayRace1: boolean;
  hasRelayRace2: boolean;
  excludeRelayRace: boolean;
  /**
   * When true, selects Brigade-Combined Evaluation mode:
   * entries from the two disciplines are paired best-to-best within each fire
   * brigade (AKTIV vs JUGEND). When false, Group-Combined mode is used
   * (same-group pairing across disciplines).
   * Ignored when categoryTypeId2 is null (Single Evaluation mode).
   */
  isBrigadePairing: boolean;
}

export interface EvaluationResult {
  groupId: string;
  fireBrigadeId?: string;
  entry1Id: string;
  entry2Id: string | null;
  score1Hundredths: number;
  score2Hundredths: number | null;
  combinedScoreHundredths: number;
  rank?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ScoredEntry = { entry: CategoryEntry; score: number };

function collectValid(
  entries: CategoryEntry[],
  descriptor: ScoreDescriptor,
): ScoredEntry[] {
  const result: ScoredEntry[] = [];
  for (const entry of entries) {
    if (entry.runStatus !== 'VALID') continue;
    const score = computeEntryScore(entry, descriptor);
    if (score !== null) {
      result.push({ entry, score });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Branch: Single Evaluation
//
// One discipline only. Each valid group is ranked by its own score.
// ---------------------------------------------------------------------------

function buildSingleResults(
  entries1: CategoryEntry[],
  descriptor1: ScoreDescriptor,
  resolveBrigadeId: (entry: CategoryEntry) => string | undefined,
): EvaluationResult[] {
  const results: EvaluationResult[] = [];
  for (const entry of entries1) {
    if (entry.runStatus !== 'VALID') continue;
    const score = computeEntryScore(entry, descriptor1);
    if (score !== null) {
      results.push({
        groupId: entry.groupId,
        fireBrigadeId: resolveBrigadeId(entry),
        entry1Id: entry.id,
        entry2Id: null,
        score1Hundredths: score,
        score2Hundredths: null,
        combinedScoreHundredths: score,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Branch: Group-Combined Evaluation
//
// Two disciplines, same-group pairing. The group must have a VALID result in
// both disciplines to appear in the output. Combined score = sum of both.
// ---------------------------------------------------------------------------

function buildGroupCombinedResults(
  entries1: CategoryEntry[],
  entries2: CategoryEntry[],
  descriptor1: ScoreDescriptor,
  descriptor2: ScoreDescriptor,
  resolveBrigadeId: (entry: CategoryEntry) => string | undefined,
): EvaluationResult[] {
  const scored1 = new Map<string, ScoredEntry>();
  for (const item of collectValid(entries1, descriptor1)) {
    scored1.set(item.entry.groupId, item);
  }

  const scored2 = new Map<string, ScoredEntry>();
  for (const item of collectValid(entries2, descriptor2)) {
    scored2.set(item.entry.groupId, item);
  }

  const results: EvaluationResult[] = [];
  for (const [groupId, s1] of scored1.entries()) {
    const s2 = scored2.get(groupId);
    if (!s2) continue;
    results.push({
      groupId,
      fireBrigadeId: resolveBrigadeId(s1.entry) ?? resolveBrigadeId(s2.entry),
      entry1Id: s1.entry.id,
      entry2Id: s2.entry.id,
      score1Hundredths: s1.score,
      score2Hundredths: s2.score,
      combinedScoreHundredths: s1.score + s2.score,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Branch: Brigade-Combined Evaluation
//
// Two disciplines paired across brigades. Within each fire brigade, entries
// from discipline 1 are sorted ascending (best first) and paired positionally
// with discipline 2 entries sorted the same way. This pairs the best AKTIV
// group with the best JUGEND group, the second-best with the second-best, etc.
//
// If a brigade has more entries in one discipline than the other, surplus
// entries are dropped (remainders are not included in the output).
// ---------------------------------------------------------------------------

function buildBrigadeCombinedResults(
  entries1: CategoryEntry[],
  entries2: CategoryEntry[],
  descriptor1: ScoreDescriptor,
  descriptor2: ScoreDescriptor,
  resolveBrigadeId: (entry: CategoryEntry) => string | undefined,
): EvaluationResult[] {
  const groupByBrigade = (scored: ScoredEntry[]): Map<string, ScoredEntry[]> => {
    const byBrigade = new Map<string, ScoredEntry[]>();
    for (const item of scored) {
      const brigadeId = resolveBrigadeId(item.entry);
      if (!brigadeId) continue;
      const list = byBrigade.get(brigadeId) ?? [];
      list.push(item);
      byBrigade.set(brigadeId, list);
    }
    return byBrigade;
  };

  const scoredList1 = collectValid(entries1, descriptor1).sort((a, b) => a.score - b.score);
  const scoredList2 = collectValid(entries2, descriptor2).sort((a, b) => a.score - b.score);

  const byBrigade1 = groupByBrigade(scoredList1);
  const byBrigade2 = groupByBrigade(scoredList2);

  const results: EvaluationResult[] = [];
  for (const [brigadeId, list1] of byBrigade1.entries()) {
    const list2 = byBrigade2.get(brigadeId);
    if (!list2) continue;
    const pairsCount = Math.min(list1.length, list2.length);
    for (let i = 0; i < pairsCount; i++) {
      const item1 = list1[i];
      const item2 = list2[i];
      results.push({
        groupId: item1.entry.groupId,
        fireBrigadeId: brigadeId,
        entry1Id: item1.entry.id,
        entry2Id: item2.entry.id,
        score1Hundredths: item1.score,
        score2Hundredths: item2.score,
        combinedScoreHundredths: item1.score + item2.score,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates scored and ranked results for one evaluation.
 *
 * Three modes are selected by the descriptor (see CONTEXT.md — Evaluation Modes):
 *  - Single Evaluation:          categoryTypeId2 === null
 *  - Group-Combined Evaluation:  categoryTypeId2 !== null, isBrigadePairing === false
 *  - Brigade-Combined Evaluation: categoryTypeId2 !== null, isBrigadePairing === true
 *
 * @param groups Pre-built map of GroupInfo keyed by group ID. Used to resolve
 *               fireBrigadeId when it is not directly on the CategoryEntry.
 */
export function calculateEvaluationScores(
  descriptor: EvaluationDescriptor,
  entries1: CategoryEntry[],
  entries2: CategoryEntry[],
  groups?: Map<string, GroupInfo>,
): EvaluationResult[] {
  const descriptor1: ScoreDescriptor = {
    hasRelayRace: descriptor.hasRelayRace1,
    excludeRelayRace: descriptor.excludeRelayRace,
  };
  const descriptor2: ScoreDescriptor = {
    hasRelayRace: descriptor.hasRelayRace2,
    excludeRelayRace: descriptor.excludeRelayRace,
  };

  const resolveBrigadeId = (entry: CategoryEntry): string | undefined => {
    if (entry.fireBrigadeId) return entry.fireBrigadeId;
    return groups?.get(entry.groupId)?.fireBrigadeId;
  };

  const isCombined = descriptor.categoryTypeId2 !== null;

  let combined: EvaluationResult[];

  if (!isCombined) {
    combined = buildSingleResults(entries1, descriptor1, resolveBrigadeId);
  } else if (!descriptor.isBrigadePairing) {
    combined = buildGroupCombinedResults(entries1, entries2, descriptor1, descriptor2, resolveBrigadeId);
  } else {
    combined = buildBrigadeCombinedResults(entries1, entries2, descriptor1, descriptor2, resolveBrigadeId);
  }

  combined.sort((a, b) => a.combinedScoreHundredths - b.combinedScoreHundredths);
  return applyDenseRank(combined, (r) => r.combinedScoreHundredths);
}

