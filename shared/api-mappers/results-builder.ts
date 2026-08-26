import {
  calculateEvaluationScores,
  type EvaluationDescriptor,
} from '../domain/evaluation.js';
import { compactStartOrder } from '../domain/ranking.js';
import { type CategoryEntry as DomainEntry } from '../domain/scoring.js';

export interface EvaluationTypeView {
  id: string;
  name: string;
  // _1 fields are always required — the primary discipline
  categoryTypeId1: string;
  categoryTypeName1?: string;
  hasRelayRace1: boolean;
  competitionClassId1?: string | null;
  // _2 fields are nullable — null means this is a single-discipline (standard) evaluation
  categoryTypeId2: string | null;
  categoryTypeName2: string | null; // nullable, not optional — matches categoryTypeId2's contract
  hasRelayRace2: boolean;           // always required; callers must provide false for standard evals
  competitionClassId2?: string | null;
  excludeRelayRace: boolean;
  /** Selects Brigade-Combined Evaluation mode. See CONTEXT.md. */
  isBrigadePairing: boolean;
  /** When true, allows partial (1-result) and DNF competitors to be displayed in combined evaluations. */
  showSingleResults?: boolean;
  public?: boolean;
  publicTv?: boolean;
  displayDurationSeconds?: number;
  order?: number;
}

export interface EntryDetailView {
  id: string;
  groupId: string;
  categoryTypeId?: string;
  runStatus: 'OPEN' | 'VALID' | 'DNF' | string;
  startOrderPosition: number | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  groupName: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
  competitionClassId?: string;
  categoryTypeName?: string;
  hasRelayRace?: boolean;
}

export interface RunResultPayload {
  entryId: string;
  runStatus: EntryDetailView['runStatus'] | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  scoreHundredths: number | null;
}

export interface RankedResultPayload {
  rank: number | null;
  groupId: string;
  groupName: string;
  secondaryGroupName?: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
  scoreHundredths: number | null;
  primaryRun: RunResultPayload;
  secondaryRun?: RunResultPayload | null;
}

export interface OpenEntryPayload {
  id: string;
  groupId: string;
  groupName: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
  startOrderPosition: number | null;
}

export interface DnfEntryPayload {
  id: string;
  groupId: string;
  groupName: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
}

export interface CategoryResultPayload {
  id: string;
  displayName: string;
  publicEnabled: boolean;
  tvEnabled: boolean;
  order: number;
  type: 'standard' | 'combined';
  isBrigadePairing: boolean;
  showSingleResults?: boolean;
  hasRelayRace1: boolean;
  hasRelayRace2: boolean;
  excludeRelayRace: boolean;
  categoryTypeName1: string;
  categoryTypeName2: string | null;
  rankedResults: RankedResultPayload[];
  openEntries: OpenEntryPayload[];
  dnfEntries: DnfEntryPayload[];
}

/**
 * Pure domain function to assemble the public evaluation categories payload.
 */
export function buildCategoriesResultMap(
  evaluationTypes: EvaluationTypeView[],
  allEntries: EntryDetailView[],
): Record<string, CategoryResultPayload> {
  const byEntryId = new Map(allEntries.map((e) => [e.id, e]));
  const categories: Record<string, CategoryResultPayload> = {};
  // Hoisted: does not depend on the current evalType.
  const getCatTypeId = (e: EntryDetailView) => e.categoryTypeId || '';

  for (const evalType of evaluationTypes) {
    const entries1 = allEntries.filter(
      (e) => getCatTypeId(e) === evalType.categoryTypeId1,
    );
    const entries2 = evalType.categoryTypeId2
      ? allEntries.filter((e) => getCatTypeId(e) === evalType.categoryTypeId2)
      : [];

    const hasRelayRace1 = evalType.hasRelayRace1;
    const hasRelayRace2 = evalType.hasRelayRace2;
    const excludeRelayRace = evalType.excludeRelayRace;

    const descriptor: EvaluationDescriptor = {
      id: evalType.id,
      categoryTypeId1: evalType.categoryTypeId1,
      categoryTypeId2: evalType.categoryTypeId2,
      hasRelayRace1,
      hasRelayRace2,
      excludeRelayRace,
      isBrigadePairing: evalType.isBrigadePairing ?? false,
      showSingleResults: evalType.showSingleResults ?? false,
    };

    // Maps view entries to the domain shape. scoreHundredths is intentionally omitted:
    // calculateEvaluationScores() recomputes scores internally using the full descriptor
    // (including excludeRelayRace), so pre-computing here would be both redundant and
    // potentially wrong (it would duplicate the descriptor logic).
    const toDomain = (
      entries: EntryDetailView[],
      hasRelay: boolean,
    ): DomainEntry[] =>
      entries.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        categoryTypeId: e.categoryTypeId || '',
        runStatus: e.runStatus as DomainEntry['runStatus'],
        startOrderPosition: e.startOrderPosition,
        attackTimeHundredths: e.attackTimeHundredths,
        attackTimeErrors: e.attackTimeErrors ?? 0,
        relayRaceHundredths: hasRelay ? e.relayRaceHundredths : null,
        relayRaceErrors: hasRelay ? (e.relayRaceErrors ?? 0) : null,
        fireBrigadeId: e.fireBrigadeId,
      }));

    const domain1 = toDomain(entries1, hasRelayRace1);
    const domain2 = toDomain(entries2, hasRelayRace2);

    const evalResults = calculateEvaluationScores(descriptor, domain1, domain2);
    const isCombined = evalType.categoryTypeId2 !== null;

    const rankedResults: RankedResultPayload[] = [];
    for (const result of evalResults) {
      const e1 = result.entry1Id ? byEntryId.get(result.entry1Id) : undefined;
      const e2 = result.entry2Id ? byEntryId.get(result.entry2Id) : undefined;
      if (!e1 && !e2) {
        // Should never happen if allEntries is consistent with what was passed to toDomain.
        console.error(`[results-builder] entry not found in map: id1=${result.entry1Id} id2=${result.entry2Id} eval=${evalType.id}`);
        continue;
      }

      const primaryRun: RunResultPayload = {
        entryId: result.entry1Id ?? '',
        runStatus: e1?.runStatus ?? null,
        attackTimeHundredths: e1?.attackTimeHundredths ?? null,
        attackTimeErrors: e1?.attackTimeErrors ?? null,
        relayRaceHundredths: e1?.relayRaceHundredths ?? null,
        relayRaceErrors: e1?.relayRaceErrors ?? null,
        scoreHundredths: result.score1Hundredths,
      };

      let secondaryRun: RunResultPayload | null = null;
      if (isCombined) {
        secondaryRun = {
          entryId: result.entry2Id ?? '',
          runStatus: e2?.runStatus ?? null,
          attackTimeHundredths: e2?.attackTimeHundredths ?? null,
          attackTimeErrors: e2?.attackTimeErrors ?? null,
          relayRaceHundredths: e2?.relayRaceHundredths ?? null,
          relayRaceErrors: e2?.relayRaceErrors ?? null,
          scoreHundredths: result.score2Hundredths,
        };
      }

      rankedResults.push({
        rank: result.rank ?? null,
        groupId: result.groupId,
        groupName: e1?.groupName || e2?.groupName || '',
        ...(evalType.isBrigadePairing && e2
          ? { secondaryGroupName: e2.groupName }
          : {}),
        // fireBrigadeId is resolved by the evaluation engine (handles brigade-level pairing);
        // fall back to the view entry only if the engine did not resolve one.
        fireBrigadeId: result.fireBrigadeId || e1?.fireBrigadeId || e2?.fireBrigadeId || '',
        // fireBrigadeName is not part of the domain model — always read from the view layer.
        fireBrigadeName: e1?.fireBrigadeName || e2?.fireBrigadeName || '',
        scoreHundredths: result.combinedScoreHundredths,
        primaryRun,
        secondaryRun,
      });
    }

    const openDomain1 = domain1.filter((e: DomainEntry) => e.runStatus === 'OPEN');
    // Combined evaluations aggregate two disciplines into a single ranked list.
    // There is no meaningful per-discipline start order or DNF list to surface,
    // so both are intentionally empty for combined types.
    const openEntries: OpenEntryPayload[] = isCombined
      ? []
      : compactStartOrder(openDomain1).map((e: DomainEntry) => {
        const detail = byEntryId.get(e.id);
        return {
          id: e.id,
          groupId: e.groupId,
          groupName: detail?.groupName || '',
          fireBrigadeId: detail?.fireBrigadeId || '',
          fireBrigadeName: detail?.fireBrigadeName || '',
          startOrderPosition: e.startOrderPosition,
        };
      });

    const dnfEntries: DnfEntryPayload[] = isCombined
      ? []
      : entries1
        .filter((e) => e.runStatus === 'DNF')
        .map((e) => ({
          id: e.id,
          groupId: e.groupId,
          groupName: e.groupName,
          fireBrigadeId: e.fireBrigadeId,
          fireBrigadeName: e.fireBrigadeName,
        }));

    categories[evalType.id] = {
      id: evalType.id,
      displayName: evalType.name,
      publicEnabled: evalType.public ?? true,
      tvEnabled: evalType.publicTv ?? true,
      order: evalType.order ?? 99,
      type: isCombined ? 'combined' : 'standard',
      isBrigadePairing: evalType.isBrigadePairing,
      showSingleResults: evalType.showSingleResults ?? false,
      hasRelayRace1,
      hasRelayRace2,
      excludeRelayRace,
      categoryTypeName1: evalType.categoryTypeName1 || 'Disziplin 1',
      categoryTypeName2: evalType.categoryTypeName2 ?? null,
      rankedResults,
      openEntries,
      dnfEntries,
    };
  }

  return categories;
}
