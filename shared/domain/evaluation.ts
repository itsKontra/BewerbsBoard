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
  /**
   * When true, allows partial (1-result) competitors and DNF competitors to be
   * displayed after complete (2-result) competitors.
   * Ignored when categoryTypeId2 is null (Single Evaluation mode).
   */
  showSingleResults?: boolean;
}

export function normalizeShowSingleResults(
  categoryTypeId2: string | null | undefined,
  showSingleResults: unknown,
): boolean {
  return Boolean(categoryTypeId2 && showSingleResults);
}

export interface EvaluationResult {
  groupId: string;
  fireBrigadeId?: string;
  entry1Id: string | null;
  entry2Id: string | null;
  score1Hundredths: number | null;
  score2Hundredths: number | null;
  combinedScoreHundredths: number | null;
  rank?: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type EvaluatedEntry = {
  entry: CategoryEntry;
  score: number | null;
  status: 'VALID' | 'DNF' | 'OPEN';
};

type InternalResult = {
  tier: 1 | 2 | 3;
  groupId: string;
  fireBrigadeId?: string;
  entry1Id: string | null;
  entry2Id: string | null;
  score1Hundredths: number | null;
  score2Hundredths: number | null;
  combinedScoreHundredths: number | null;
  singleScoreHundredths?: number;
  rank?: number | null;
};

function evaluateEntry(entry: CategoryEntry, descriptor: ScoreDescriptor): EvaluatedEntry {
  if (entry.runStatus === 'VALID') {
    const score = computeEntryScore(entry, descriptor);
    if (score !== null) {
      return { entry, score, status: 'VALID' };
    }
    return { entry, score: null, status: 'OPEN' };
  }
  if (entry.runStatus === 'DNF') {
    return { entry, score: null, status: 'DNF' };
  }
  return { entry, score: null, status: 'OPEN' };
}

function classifyCombinedPair(
  entry1: EvaluatedEntry | undefined,
  entry2: EvaluatedEntry | undefined,
  fireBrigadeId: string | undefined,
  showSingleResults: boolean,
): InternalResult | null {
  const score1 = entry1?.status === 'VALID' ? entry1.score : null;
  const score2 = entry2?.status === 'VALID' ? entry2.score : null;
  const isValid1 = score1 !== null;
  const isValid2 = score2 !== null;
  const isDnf1 = entry1?.status === 'DNF';
  const isDnf2 = entry2?.status === 'DNF';

  const sharedResult = {
    fireBrigadeId,
    entry1Id: entry1?.entry.id ?? null,
    entry2Id: entry2?.entry.id ?? null,
    score1Hundredths: score1 ?? null,
    score2Hundredths: score2 ?? null,
  };

  if (isValid1 && isValid2) {
    return {
      ...sharedResult,
      tier: 1,
      groupId: entry1!.entry.groupId,
      combinedScoreHundredths: score1 + score2,
    };
  }

  if (isDnf1 || isDnf2) {
    const hasResult1 = isValid1 || isDnf1;
    const hasResult2 = isValid2 || isDnf2;
    if (!showSingleResults && !(hasResult1 && hasResult2)) return null;

    return {
      ...sharedResult,
      tier: 3,
      groupId: entry1?.entry.groupId ?? entry2!.entry.groupId,
      combinedScoreHundredths: null,
      rank: null,
    };
  }

  if (!showSingleResults || (!isValid1 && !isValid2)) return null;

  const validEntry = isValid1 ? entry1 : entry2!;
  return {
    ...sharedResult,
    tier: 2,
    groupId: validEntry!.entry.groupId,
    combinedScoreHundredths: null,
    singleScoreHundredths: isValid1 ? score1 : score2!,
  };
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
// Two disciplines, same-group pairing.
// Tier 1: 2 VALID results -> sum of both, ranked by combined score.
// Tier 2: 1 VALID result (if showSingleResults === true) -> ranked by single score.
// Tier 3: >= 1 DNF -> rank null, combined score null.
// ---------------------------------------------------------------------------

function buildGroupCombinedResults(
  entries1: CategoryEntry[],
  entries2: CategoryEntry[],
  descriptor1: ScoreDescriptor,
  descriptor2: ScoreDescriptor,
  showSingleResults: boolean,
  resolveBrigadeId: (entry: CategoryEntry) => string | undefined,
  groups?: Map<string, GroupInfo>,
): InternalResult[] {
  const evaluated1 = new Map<string, EvaluatedEntry>();
  for (const e of entries1) {
    evaluated1.set(e.groupId, evaluateEntry(e, descriptor1));
  }

  const evaluated2 = new Map<string, EvaluatedEntry>();
  for (const e of entries2) {
    evaluated2.set(e.groupId, evaluateEntry(e, descriptor2));
  }

  const allGroupIds = new Set<string>([...evaluated1.keys(), ...evaluated2.keys()]);
  const results: InternalResult[] = [];

  for (const groupId of allGroupIds) {
    const ev1 = evaluated1.get(groupId);
    const ev2 = evaluated2.get(groupId);

    const fireBrigadeId =
      (ev1?.entry ? resolveBrigadeId(ev1.entry) : undefined) ??
      (ev2?.entry ? resolveBrigadeId(ev2.entry) : undefined) ??
      groups?.get(groupId)?.fireBrigadeId;

    const result = classifyCombinedPair(ev1, ev2, fireBrigadeId, showSingleResults);
    if (result) results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Branch: Brigade-Combined Evaluation
//
// Two disciplines paired across brigades. Within each fire brigade, entries
// from discipline 1 are sorted ascending (best first) and paired positionally
// with discipline 2 entries sorted the same way.
//
// When showSingleResults is false: surplus entries are dropped.
// When showSingleResults is true: surplus entries participate in Tier 2 (valid)
// or Tier 3 (DNF).
// ---------------------------------------------------------------------------

function buildBrigadeCombinedResults(
  entries1: CategoryEntry[],
  entries2: CategoryEntry[],
  descriptor1: ScoreDescriptor,
  descriptor2: ScoreDescriptor,
  showSingleResults: boolean,
  resolveBrigadeId: (entry: CategoryEntry) => string | undefined,
  groups?: Map<string, GroupInfo>,
): InternalResult[] {
  const evaluatedList1 = entries1.map((e) => evaluateEntry(e, descriptor1));
  const evaluatedList2 = entries2.map((e) => evaluateEntry(e, descriptor2));

  const sortEntries = (list: EvaluatedEntry[]) => {
    return [...list].sort((a, b) => {
      const rankOrder = (x: EvaluatedEntry) => {
        if (x.status === 'VALID' && x.score !== null) return 1;
        if (x.status === 'DNF') return 2;
        return 3;
      };
      const orderA = rankOrder(a);
      const orderB = rankOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      if (orderA === 1) return a.score! - b.score!;
      return (a.entry.startOrderPosition ?? 0) - (b.entry.startOrderPosition ?? 0);
    });
  };

  const groupByBrigade = (list: EvaluatedEntry[]): Map<string, EvaluatedEntry[]> => {
    const map = new Map<string, EvaluatedEntry[]>();
    for (const item of list) {
      const brigadeId = resolveBrigadeId(item.entry) ?? groups?.get(item.entry.groupId)?.fireBrigadeId;
      if (!brigadeId) continue;
      const arr = map.get(brigadeId) ?? [];
      arr.push(item);
      map.set(brigadeId, arr);
    }
    for (const [brigadeId, arr] of map.entries()) {
      map.set(brigadeId, sortEntries(arr));
    }
    return map;
  };

  const byBrigade1 = groupByBrigade(evaluatedList1);
  const byBrigade2 = groupByBrigade(evaluatedList2);

  const allBrigadeIds = new Set<string>([...byBrigade1.keys(), ...byBrigade2.keys()]);
  const results: InternalResult[] = [];

  for (const brigadeId of allBrigadeIds) {
    const list1 = byBrigade1.get(brigadeId) ?? [];
    const list2 = byBrigade2.get(brigadeId) ?? [];
    const maxLen = Math.max(list1.length, list2.length);

    for (let i = 0; i < maxLen; i++) {
      const item1 = list1[i];
      const item2 = list2[i];

      const result = classifyCombinedPair(item1, item2, brigadeId, showSingleResults);
      if (result) results.push(result);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Multi-Tier Ranking Engine
// ---------------------------------------------------------------------------

function rankTiers(results: InternalResult[]): EvaluationResult[] {
  const tier1 = results.filter((r) => r.tier === 1);
  const tier2 = results.filter((r) => r.tier === 2);
  const tier3 = results.filter((r) => r.tier === 3);

  rankTier(tier1, (item) => item.combinedScoreHundredths!, 1);
  rankTier(tier2, (item) => item.singleScoreHundredths!, tier1.length + 1);

  // 3. Tier 3 (DNF) receives null rank
  for (const item of tier3) {
    item.rank = null;
  }

  // Concatenate tiers: Tier 1 -> Tier 2 -> Tier 3
  return [...tier1, ...tier2, ...tier3].map((r) => ({
    groupId: r.groupId,
    fireBrigadeId: r.fireBrigadeId,
    entry1Id: r.entry1Id,
    entry2Id: r.entry2Id,
    score1Hundredths: r.score1Hundredths,
    score2Hundredths: r.score2Hundredths,
    combinedScoreHundredths: r.combinedScoreHundredths,
    rank: r.rank,
  }));
}

function rankTier(
  results: InternalResult[],
  getScore: (result: InternalResult) => number,
  startingRank: number,
): void {
  results.sort((a, b) => getScore(a) - getScore(b));

  let currentRank = startingRank;
  let previousScore: number | null = null;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const score = getScore(result);
    if (previousScore !== null && score === previousScore) {
      result.rank = currentRank;
    } else {
      currentRank = startingRank + i;
      result.rank = currentRank;
      previousScore = score;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates scored and ranked results for one evaluation.
 *
 * Three modes are selected by the descriptor (see CONTEXT.md — Evaluation Modes):
 *  - Single Evaluation:           categoryTypeId2 === null
 *  - Group-Combined Evaluation:   categoryTypeId2 !== null, isBrigadePairing === false
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

  if (!isCombined) {
    const singleResults = buildSingleResults(entries1, descriptor1, resolveBrigadeId);
    singleResults.sort((a, b) => (a.combinedScoreHundredths ?? 0) - (b.combinedScoreHundredths ?? 0));
    return applyDenseRank(singleResults, (r) => r.combinedScoreHundredths!);
  }

  const showSingle = Boolean(descriptor.showSingleResults);

  let rawResults: InternalResult[];
  if (!descriptor.isBrigadePairing) {
    rawResults = buildGroupCombinedResults(
      entries1,
      entries2,
      descriptor1,
      descriptor2,
      showSingle,
      resolveBrigadeId,
      groups,
    );
  } else {
    rawResults = buildBrigadeCombinedResults(
      entries1,
      entries2,
      descriptor1,
      descriptor2,
      showSingle,
      resolveBrigadeId,
      groups,
    );
  }

  return rankTiers(rawResults);
}
