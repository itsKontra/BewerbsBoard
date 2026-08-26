import { describe, it, expect } from 'vitest';
import {
  calculateEvaluationScores,
  type EvaluationDescriptor,
} from './evaluation.js';
import { type CategoryEntry, type GroupInfo } from './scoring.js';
import {
  buildCategoriesResultMap,
  type EntryDetailView,
  type EvaluationTypeView,
} from '../api-mappers/results-builder.js';

describe('calculateEvaluationScores — Domain Engine', () => {
  const defaultDescriptor: EvaluationDescriptor = {
    id: 'eval-1',
    categoryTypeId1: 'cat-1',
    categoryTypeId2: 'cat-2',
    hasRelayRace1: false,
    hasRelayRace2: false,
    excludeRelayRace: false,
    isBrigadePairing: false,
    showSingleResults: false,
  };

  const createEntry = (
    id: string,
    groupId: string,
    categoryTypeId: string,
    runStatus: 'VALID' | 'DNF' | 'OPEN',
    attackTime: number | null,
    errors = 0,
    fireBrigadeId = 'brigade-1',
  ): CategoryEntry => ({
    id,
    groupId,
    categoryTypeId,
    runStatus,
    startOrderPosition: 1,
    attackTimeHundredths: attackTime,
    attackTimeErrors: errors,
    relayRaceHundredths: null,
    relayRaceErrors: null,
    fireBrigadeId,
  });

  describe('Single Evaluation (categoryTypeId2 === null)', () => {
    const singleDescriptor: EvaluationDescriptor = {
      id: 'eval-single',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: null,
      hasRelayRace1: false,
      hasRelayRace2: false,
      excludeRelayRace: false,
      isBrigadePairing: false,
    };

    it('ranks valid entries by score and applies dense ranking', () => {
      const entries1: CategoryEntry[] = [
        createEntry('e1', 'g1', 'cat-1', 'VALID', 4500),
        createEntry('e2', 'g2', 'cat-1', 'VALID', 4000),
        createEntry('e3', 'g3', 'cat-1', 'VALID', 4000),
        createEntry('e4', 'g4', 'cat-1', 'VALID', 5000),
        createEntry('e5', 'g5', 'cat-1', 'DNF', null),
        createEntry('e6', 'g6', 'cat-1', 'OPEN', null),
      ];

      const results = calculateEvaluationScores(singleDescriptor, entries1, []);
      expect(results).toHaveLength(4);
      expect(results[0]).toMatchObject({ groupId: 'g2', combinedScoreHundredths: 4000, rank: 1 });
      expect(results[1]).toMatchObject({ groupId: 'g3', combinedScoreHundredths: 4000, rank: 1 });
      expect(results[2]).toMatchObject({ groupId: 'g1', combinedScoreHundredths: 4500, rank: 3 });
      expect(results[3]).toMatchObject({ groupId: 'g4', combinedScoreHundredths: 5000, rank: 4 });
    });
  });

  describe('Group-Combined Evaluation (isBrigadePairing === false)', () => {
    it('when showSingleResults is false, only groups with 2 VALID results or complete DNF are visible', () => {
      const desc: EvaluationDescriptor = { ...defaultDescriptor, showSingleResults: false };

      const entries1: CategoryEntry[] = [
        createEntry('e1-g1', 'g1', 'cat-1', 'VALID', 4000),
        createEntry('e1-g2', 'g2', 'cat-1', 'VALID', 4200),
        createEntry('e1-g3', 'g3', 'cat-1', 'VALID', 3900), // only run in cat-1
        createEntry('e1-g4', 'g4', 'cat-1', 'DNF', null),   // DNF + VALID
        createEntry('e1-g5', 'g5', 'cat-1', 'DNF', null),   // DNF + OPEN -> should be dropped when showSingleResults is false
        createEntry('e1-g6', 'g6', 'cat-1', 'DNF', null),   // DNF + DNF -> Tier 3
      ];

      const entries2: CategoryEntry[] = [
        createEntry('e2-g1', 'g1', 'cat-2', 'VALID', 4100), // g1 total: 8100
        createEntry('e2-g2', 'g2', 'cat-2', 'VALID', 3800), // g2 total: 8000
        createEntry('e2-g4', 'g4', 'cat-2', 'VALID', 4000), // g4 DNF in cat-1
        createEntry('e2-g5', 'g5', 'cat-2', 'OPEN', null),
        createEntry('e2-g6', 'g6', 'cat-2', 'DNF', null),
      ];

      const results = calculateEvaluationScores(desc, entries1, entries2);
      expect(results).toHaveLength(4);

      // Tier 1: 2 Valid results sorted by combined score
      expect(results[0]).toMatchObject({
        groupId: 'g2',
        score1Hundredths: 4200,
        score2Hundredths: 3800,
        combinedScoreHundredths: 8000,
        rank: 1,
      });
      expect(results[1]).toMatchObject({
        groupId: 'g1',
        score1Hundredths: 4000,
        score2Hundredths: 4100,
        combinedScoreHundredths: 8100,
        rank: 2,
      });

      // Tier 3: Completed DNF groups placed at bottom with null rank and null combined score
      expect(results[2].rank).toBeNull();
      expect(results[2].combinedScoreHundredths).toBeNull();
      expect(results[3].rank).toBeNull();
      expect(results[3].combinedScoreHundredths).toBeNull();

      const dnfGroupIds = [results[2].groupId, results[3].groupId];
      expect(dnfGroupIds).toContain('g4');
      expect(dnfGroupIds).toContain('g6');
    });

    it('when showSingleResults is true, 3 tiers are generated: 2-valid -> 1-valid -> DNF', () => {
      const desc: EvaluationDescriptor = { ...defaultDescriptor, showSingleResults: true };

      const entries1: CategoryEntry[] = [
        createEntry('e1-g1', 'g1', 'cat-1', 'VALID', 4000), // g1: 4000 + 4000 = 8000 (Tier 1)
        createEntry('e1-g2', 'g2', 'cat-1', 'VALID', 4500), // g2: 4500 + 4000 = 8500 (Tier 1)
        createEntry('e1-g3', 'g3', 'cat-1', 'VALID', 3500), // g3: 3500 + OPEN = 3500 (Tier 2, rank 3)
        createEntry('e1-g4', 'g4', 'cat-1', 'OPEN', null),   // g4: OPEN + 3700 = 3700 (Tier 2, rank 4)
        createEntry('e1-g5', 'g5', 'cat-1', 'VALID', 3700), // g5: 3700 + OPEN = 3700 (Tier 2, rank 4 - tie with g4)
        createEntry('e1-g6', 'g6', 'cat-1', 'VALID', 3900), // g6: 3900 + OPEN = 3900 (Tier 2, rank 6)
        createEntry('e1-g7', 'g7', 'cat-1', 'DNF', null),   // g7: DNF + VALID (Tier 3)
        createEntry('e1-g8', 'g8', 'cat-1', 'DNF', null),   // g8: DNF + OPEN (Tier 3)
        createEntry('e1-g9', 'g9', 'cat-1', 'OPEN', null),  // g9: OPEN + OPEN (Dropped)
      ];

      const entries2: CategoryEntry[] = [
        createEntry('e2-g1', 'g1', 'cat-2', 'VALID', 4000),
        createEntry('e2-g2', 'g2', 'cat-2', 'VALID', 4000),
        createEntry('e2-g3', 'g3', 'cat-2', 'OPEN', null),
        createEntry('e2-g4', 'g4', 'cat-2', 'VALID', 3700),
        createEntry('e2-g5', 'g5', 'cat-2', 'OPEN', null),
        // g6 not registered in cat-2 at all
        createEntry('e2-g7', 'g7', 'cat-2', 'VALID', 3600),
        createEntry('e2-g8', 'g8', 'cat-2', 'OPEN', null),
        createEntry('e2-g9', 'g9', 'cat-2', 'OPEN', null),
      ];

      const results = calculateEvaluationScores(desc, entries1, entries2);
      expect(results).toHaveLength(8);

      // --- Tier 1 (2 Valid results, sorted by combined score) ---
      expect(results[0]).toMatchObject({
        groupId: 'g1',
        combinedScoreHundredths: 8000,
        score1Hundredths: 4000,
        score2Hundredths: 4000,
        rank: 1,
      });
      expect(results[1]).toMatchObject({
        groupId: 'g2',
        combinedScoreHundredths: 8500,
        score1Hundredths: 4500,
        score2Hundredths: 4000,
        rank: 2,
      });

      // --- Tier 2 (1 Valid result, ranked continuing from Tier 1, combinedScoreHundredths is null) ---
      expect(results[2]).toMatchObject({
        groupId: 'g3',
        score1Hundredths: 3500,
        score2Hundredths: null,
        combinedScoreHundredths: null,
        rank: 3,
      });

      // g4 (single 3700) and g5 (single 3700) tie for rank 4
      expect(results[3].combinedScoreHundredths).toBeNull();
      expect(results[3].rank).toBe(4);
      expect(results[4].combinedScoreHundredths).toBeNull();
      expect(results[4].rank).toBe(4);
      const tieGroupIds = [results[3].groupId, results[4].groupId];
      expect(tieGroupIds).toContain('g4');
      expect(tieGroupIds).toContain('g5');

      // g6 follows tie at rank 6
      expect(results[5]).toMatchObject({
        groupId: 'g6',
        score1Hundredths: 3900,
        score2Hundredths: null,
        combinedScoreHundredths: null,
        rank: 6,
      });

      // --- Tier 3 (DNF items placed at bottom with null rank and null combined score) ---
      expect(results[6].rank).toBeNull();
      expect(results[6].combinedScoreHundredths).toBeNull();
      expect(results[7].rank).toBeNull();
      expect(results[7].combinedScoreHundredths).toBeNull();

      const tier3GroupIds = [results[6].groupId, results[7].groupId];
      expect(tier3GroupIds).toContain('g7');
      expect(tier3GroupIds).toContain('g8');
    });

    it('resolves fireBrigadeId from groups Map if missing on entry', () => {
      const desc: EvaluationDescriptor = { ...defaultDescriptor, showSingleResults: true };
      const entries1: CategoryEntry[] = [
        { ...createEntry('e1', 'g1', 'cat-1', 'VALID', 4000), fireBrigadeId: undefined },
      ];
      const entries2: CategoryEntry[] = [];

      const groupsMap = new Map<string, GroupInfo>([
        ['g1', { id: 'g1', fireBrigadeId: 'fb-mapped', competitionClassName: 'AKTIV' }],
      ]);

      const results = calculateEvaluationScores(desc, entries1, entries2, groupsMap);
      expect(results).toHaveLength(1);
      expect(results[0].fireBrigadeId).toBe('fb-mapped');
    });
  });

  describe('Brigade-Combined Evaluation (isBrigadePairing === true)', () => {
    const brigadeDescriptor: EvaluationDescriptor = {
      id: 'eval-brigade',
      categoryTypeId1: 'cat-aktiv',
      categoryTypeId2: 'cat-jugend',
      hasRelayRace1: false,
      hasRelayRace2: false,
      excludeRelayRace: false,
      isBrigadePairing: true,
      showSingleResults: false,
    };

    it('pairs AKTIV and JUGEND best-to-best within brigade and drops surplus when showSingleResults is false', () => {
      // Brigade A: 2 AKTIV, 1 JUGEND -> 1 pair, 1 surplus AKTIV dropped
      // Brigade B: 1 AKTIV, 2 JUGEND -> 1 pair, 1 surplus JUGEND dropped
      const entries1: CategoryEntry[] = [
        createEntry('e1-A1', 'gA1', 'cat-aktiv', 'VALID', 4200, 0, 'brigade-A'),
        createEntry('e1-A2', 'gA2', 'cat-aktiv', 'VALID', 4000, 0, 'brigade-A'), // best in A
        createEntry('e1-B1', 'gB1', 'cat-aktiv', 'VALID', 4500, 0, 'brigade-B'),
      ];

      const entries2: CategoryEntry[] = [
        createEntry('e2-A1', 'gA-J1', 'cat-jugend', 'VALID', 5000, 0, 'brigade-A'),
        createEntry('e2-B1', 'gB-J1', 'cat-jugend', 'VALID', 4800, 0, 'brigade-B'), // best in B
        createEntry('e2-B2', 'gB-J2', 'cat-jugend', 'VALID', 5200, 0, 'brigade-B'),
      ];

      const results = calculateEvaluationScores(brigadeDescriptor, entries1, entries2);
      expect(results).toHaveLength(2);

      // Brigade A pair: best AKTIV (gA2, 4000) + best JUGEND (gA-J1, 5000) = 9000
      expect(results[0]).toMatchObject({
        fireBrigadeId: 'brigade-A',
        entry1Id: 'e1-A2',
        entry2Id: 'e2-A1',
        score1Hundredths: 4000,
        score2Hundredths: 5000,
        combinedScoreHundredths: 9000,
        rank: 1,
      });

      // Brigade B pair: best AKTIV (gB1, 4500) + best JUGEND (gB-J1, 4800) = 9300
      expect(results[1]).toMatchObject({
        fireBrigadeId: 'brigade-B',
        entry1Id: 'e1-B1',
        entry2Id: 'e2-B1',
        score1Hundredths: 4500,
        score2Hundredths: 4800,
        combinedScoreHundredths: 9300,
        rank: 2,
      });
    });

    it('when showSingleResults is true, surplus brigade entries become Tier 2 (valid) or Tier 3 (DNF)', () => {
      const desc: EvaluationDescriptor = { ...brigadeDescriptor, showSingleResults: true };

      // Brigade A: 2 AKTIV (valid 4000, valid 4200), 1 JUGEND (valid 5000) -> 1 Tier 1 pair (9000), 1 Tier 2 surplus (4200)
      // Brigade B: 1 AKTIV (valid 4500), 1 JUGEND (DNF) -> 1 Tier 3 pair (DNF)
      // Brigade C: 1 AKTIV (valid 3800), 0 JUGEND -> 1 Tier 2 surplus (3800)
      // Brigade D: 1 AKTIV (DNF), 0 JUGEND -> 1 Tier 3 surplus (DNF)
      const entries1: CategoryEntry[] = [
        createEntry('e1-A1', 'gA1', 'cat-aktiv', 'VALID', 4200, 0, 'brigade-A'),
        createEntry('e1-A2', 'gA2', 'cat-aktiv', 'VALID', 4000, 0, 'brigade-A'),
        createEntry('e1-B1', 'gB1', 'cat-aktiv', 'VALID', 4500, 0, 'brigade-B'),
        createEntry('e1-C1', 'gC1', 'cat-aktiv', 'VALID', 3800, 0, 'brigade-C'),
        createEntry('e1-D1', 'gD1', 'cat-aktiv', 'DNF', null, 0, 'brigade-D'),
      ];

      const entries2: CategoryEntry[] = [
        createEntry('e2-A1', 'gA-J1', 'cat-jugend', 'VALID', 5000, 0, 'brigade-A'),
        createEntry('e2-B1', 'gB-J1', 'cat-jugend', 'DNF', null, 0, 'brigade-B'),
      ];

      const results = calculateEvaluationScores(desc, entries1, entries2);
      expect(results).toHaveLength(5);

      // --- Tier 1 ---
      // Brigade A pair: 4000 + 5000 = 9000
      expect(results[0]).toMatchObject({
        fireBrigadeId: 'brigade-A',
        entry1Id: 'e1-A2',
        entry2Id: 'e2-A1',
        combinedScoreHundredths: 9000,
        rank: 1,
      });

      // --- Tier 2 ---
      // Brigade C surplus: 3800 -> rank 2
      expect(results[1]).toMatchObject({
        fireBrigadeId: 'brigade-C',
        entry1Id: 'e1-C1',
        entry2Id: null,
        score1Hundredths: 3800,
        score2Hundredths: null,
        combinedScoreHundredths: null,
        rank: 2,
      });

      // Brigade A surplus: 4200 -> rank 3
      expect(results[2]).toMatchObject({
        fireBrigadeId: 'brigade-A',
        entry1Id: 'e1-A1',
        entry2Id: null,
        score1Hundredths: 4200,
        score2Hundredths: null,
        combinedScoreHundredths: null,
        rank: 3,
      });

      // --- Tier 3 (DNF) ---
      // Brigade B pair (has DNF) and Brigade D surplus (DNF)
      expect(results[3].rank).toBeNull();
      expect(results[3].combinedScoreHundredths).toBeNull();
      expect(results[4].rank).toBeNull();
      expect(results[4].combinedScoreHundredths).toBeNull();

      const tier3Brigades = [results[3].fireBrigadeId, results[4].fireBrigadeId];
      expect(tier3Brigades).toContain('brigade-B');
      expect(tier3Brigades).toContain('brigade-D');
    });
  });
});

describe('buildCategoriesResultMap — Integration', () => {
  const evalTypes: EvaluationTypeView[] = [
    {
      id: 'eval-combined-1',
      name: 'Kombi Wertung',
      categoryTypeId1: 'cat-1',
      categoryTypeName1: 'Bronze',
      hasRelayRace1: false,
      categoryTypeId2: 'cat-2',
      categoryTypeName2: 'Silber',
      hasRelayRace2: false,
      excludeRelayRace: false,
      isBrigadePairing: false,
      showSingleResults: true,
      public: true,
      publicTv: true,
      order: 1,
    },
  ];

  const entries: EntryDetailView[] = [
    {
      id: 'e1-g1',
      groupId: 'g1',
      categoryTypeId: 'cat-1',
      runStatus: 'VALID',
      startOrderPosition: 1,
      attackTimeHundredths: 4000,
      attackTimeErrors: 0,
      relayRaceHundredths: null,
      relayRaceErrors: null,
      groupName: 'Gruppe 1',
      fireBrigadeId: 'fb-1',
      fireBrigadeName: 'FF Eins',
    },
    {
      id: 'e2-g1',
      groupId: 'g1',
      categoryTypeId: 'cat-2',
      runStatus: 'VALID',
      startOrderPosition: 1,
      attackTimeHundredths: 4100,
      attackTimeErrors: 0,
      relayRaceHundredths: null,
      relayRaceErrors: null,
      groupName: 'Gruppe 1',
      fireBrigadeId: 'fb-1',
      fireBrigadeName: 'FF Eins',
    },
    {
      id: 'e1-g2',
      groupId: 'g2',
      categoryTypeId: 'cat-1',
      runStatus: 'VALID',
      startOrderPosition: 2,
      attackTimeHundredths: 3900,
      attackTimeErrors: 0,
      relayRaceHundredths: null,
      relayRaceErrors: null,
      groupName: 'Gruppe 2',
      fireBrigadeId: 'fb-2',
      fireBrigadeName: 'FF Zwei',
    },
    {
      id: 'e1-g3',
      groupId: 'g3',
      categoryTypeId: 'cat-1',
      runStatus: 'DNF',
      startOrderPosition: 3,
      attackTimeHundredths: null,
      attackTimeErrors: null,
      relayRaceHundredths: null,
      relayRaceErrors: null,
      groupName: 'Gruppe 3',
      fireBrigadeId: 'fb-3',
      fireBrigadeName: 'FF Drei',
    },
  ];

  it('populates showSingleResults in payload and formats 1-result and DNF rows correctly', () => {
    const resultMap = buildCategoriesResultMap(evalTypes, entries);
    const cat = resultMap['eval-combined-1'];
    expect(cat).toBeDefined();
    expect(cat.showSingleResults).toBe(true);
    expect(cat.rankedResults).toHaveLength(3);

    // Tier 1: Group 1 (2 valid results)
    expect(cat.rankedResults[0]).toMatchObject({
      groupId: 'g1',
      groupName: 'Gruppe 1',
      scoreHundredths: 8100,
      rank: 1,
    });
    expect(cat.rankedResults[0].primaryRun.scoreHundredths).toBe(4000);
    expect(cat.rankedResults[0].secondaryRun?.scoreHundredths).toBe(4100);

    // Tier 2: Group 2 (1 valid result)
    expect(cat.rankedResults[1]).toMatchObject({
      groupId: 'g2',
      groupName: 'Gruppe 2',
      scoreHundredths: null,
      rank: 2,
    });
    expect(cat.rankedResults[1].primaryRun.scoreHundredths).toBe(3900);
    expect(cat.rankedResults[1].secondaryRun?.scoreHundredths).toBeNull();

    // Tier 3: Group 3 (DNF)
    expect(cat.rankedResults[2]).toMatchObject({
      groupId: 'g3',
      groupName: 'Gruppe 3',
      scoreHundredths: null,
      rank: null,
    });
  });
});
