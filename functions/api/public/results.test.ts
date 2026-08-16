import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './results';
import * as utils from '../admin/utils';

vi.mock('../admin/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../admin/utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Public Results API Endpoint (/api/public/results)', () => {
  let mockDb: any;
  let mockKv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      all: vi.fn(),
    };

    mockKv = {
      get: vi.fn(),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb);
  });

  const createMockContext = (kvData: Record<string, string> = {}) => {
    mockKv.get.mockImplementation(async (key: string) => kvData[key] || null);

    return {
      request: new Request('https://example.com/api/public/results', { method: 'GET' }),
      env: {
        DB: {},
        KV: mockKv,
      },
      data: {},
      params: {},
    } as any;
  };

  it('delivers calculated standings for standard categories and combined categories', async () => {
    // Mock DB queries:
    // First query: select categoryEntries joined with groups & fireBrigades
    const entriesData = [
      // Bronze Aktiv VALID tie
      {
        id: 'e1',
        groupId: 'g1',
        categoryTypeId: 'bronze-aktiv',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'VALID',
        startOrderPosition: null,
        scoreHundredths: 4500,
        attackTimeErrors: 2,
        attackTimeHundredths: 4300,
        relayRaceHundredths: 0,
        relayRaceErrors: 0,
        groupName: 'Gruppe 1',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb1',
        fireBrigadeName: 'FF Oberndorf',
      },
      {
        id: 'e2',
        groupId: 'g2',
        categoryTypeId: 'bronze-aktiv',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'VALID',
        startOrderPosition: null,
        scoreHundredths: 4500,
        attackTimeErrors: 5,
        attackTimeHundredths: 4000,
        relayRaceHundredths: 0,
        relayRaceErrors: 0,
        groupName: 'Gruppe 2',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb2',
        fireBrigadeName: 'FF Unterndorf',
      },
      {
        id: 'e3',
        groupId: 'g3',
        categoryTypeId: 'bronze-aktiv',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'VALID',
        startOrderPosition: null,
        scoreHundredths: 5000,
        attackTimeErrors: 0,
        attackTimeHundredths: 5000,
        relayRaceHundredths: 0,
        relayRaceErrors: 0,
        groupName: 'Gruppe 3',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb3',
        fireBrigadeName: 'FF Neustadt',
      },
      // Bronze Aktiv OPEN
      {
        id: 'e4',
        groupId: 'g4',
        categoryTypeId: 'bronze-aktiv',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'OPEN',
        startOrderPosition: 3,
        scoreHundredths: null,
        attackTimeErrors: null,
        attackTimeHundredths: null,
        relayRaceHundredths: 0,
        relayRaceErrors: 0,
        groupName: 'Gruppe 4',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb1',
        fireBrigadeName: 'FF Oberndorf',
      },
      // Bronze Aktiv DNF
      {
        id: 'e5',
        groupId: 'g5',
        categoryTypeId: 'bronze-aktiv',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'DNF',
        startOrderPosition: null,
        scoreHundredths: null,
        attackTimeErrors: null,
        attackTimeHundredths: null,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        groupName: 'Gruppe 5',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb2',
        fireBrigadeName: 'FF Unterndorf',
      },
      // Silber Aktiv VALID for g1
      {
        id: 'e6',
        groupId: 'g1',
        categoryTypeId: 'silber-aktiv',
        categoryTypeName: 'Silber Aktiv',
        runStatus: 'VALID',
        startOrderPosition: null,
        scoreHundredths: 4800,
        attackTimeErrors: 0,
        attackTimeHundredths: 4800,
        relayRaceHundredths: 0,
        relayRaceErrors: 0,
        groupName: 'Gruppe 1',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'fb1',
        fireBrigadeName: 'FF Oberndorf',
      },
      // Bronze Jugend VALID for g6 (FB1)
      {
        id: 'e7',
        groupId: 'g6',
        categoryTypeId: 'bronze-jugend',
        categoryTypeName: 'Bronze Jugend',
        runStatus: 'VALID',
        startOrderPosition: null,
        scoreHundredths: 4200,
        attackTimeErrors: 1,
        attackTimeHundredths: 4100,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        groupName: 'Jugend 1',
        competitionClass: 'JUGEND',
        fireBrigadeId: 'fb1',
        fireBrigadeName: 'FF Oberndorf',
      },
    ];

    // Second query: select all groups
    const groupsData = [
      { id: 'g1', fireBrigadeId: 'fb1', competitionClass: 'AKTIV', name: 'Gruppe 1' },
      { id: 'g2', fireBrigadeId: 'fb2', competitionClass: 'AKTIV', name: 'Gruppe 2' },
      { id: 'g3', fireBrigadeId: 'fb3', competitionClass: 'AKTIV', name: 'Gruppe 3' },
      { id: 'g4', fireBrigadeId: 'fb1', competitionClass: 'AKTIV', name: 'Gruppe 4' },
      { id: 'g5', fireBrigadeId: 'fb2', competitionClass: 'AKTIV', name: 'Gruppe 5' },
      { id: 'g6', fireBrigadeId: 'fb1', competitionClass: 'JUGEND', name: 'Jugend 1' },
    ];

    mockDb.all.mockResolvedValueOnce(entriesData).mockResolvedValueOnce(groupsData);

    const ctx = createMockContext();
    const res = await onRequestGet(ctx);

    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.eventTitle).toBe('Feuerwehr Leistungsbewerb');
    expect(data.categories).toBeDefined();

    // 1. Bronze Aktiv
    const bronzeAktiv = data.categories['bronze-aktiv'];
    expect(bronzeAktiv).toBeDefined();
    expect(bronzeAktiv.isBrigadePairing).toBe(false);
    // Verify tie ranking: e1 (4500) & e2 (4500) should both be rank 1, e3 (5000) rank 3
    expect(bronzeAktiv.rankedResults).toHaveLength(3);
    expect(bronzeAktiv.rankedResults[0].rank).toBe(1);
    expect(bronzeAktiv.rankedResults[1].rank).toBe(1);
    expect(bronzeAktiv.rankedResults[2].rank).toBe(3);

    // Verify OPEN entries compacted
    expect(bronzeAktiv.openEntries).toHaveLength(1);
    expect(bronzeAktiv.openEntries[0].startOrderPosition).toBe(1);

    // Verify DNF entries
    expect(bronzeAktiv.dnfEntries).toHaveLength(1);
    expect(bronzeAktiv.dnfEntries[0].groupId).toBe('g5');

    // 2. Gesamt Aktiv (g1 has both Bronze 4500 & Silber 4800 = 9300)
    const gesamtAktiv = data.categories['gesamt-aktiv'];
    expect(gesamtAktiv).toBeDefined();
    expect(gesamtAktiv.isBrigadePairing).toBe(false);
    expect(gesamtAktiv.rankedResults).toHaveLength(1);
    expect(gesamtAktiv.rankedResults[0].groupId).toBe('g1');
    expect(gesamtAktiv.rankedResults[0].scoreHundredths).toBe(9300);
    expect(gesamtAktiv.rankedResults[0]).not.toHaveProperty('secondaryGroupName');

    // 3. Gesamt Feuerwehr (fb1 has Aktiv g1 4500 + Jugend g6 4200 = 8700)
    const gesamtFeuerwehr = data.categories['gesamt-feuerwehr'];
    expect(gesamtFeuerwehr).toBeDefined();
    expect(gesamtFeuerwehr.isBrigadePairing).toBe(true);
    expect(gesamtFeuerwehr.rankedResults).toHaveLength(1);
    expect(gesamtFeuerwehr.rankedResults[0].fireBrigadeId).toBe('fb1');
    expect(gesamtFeuerwehr.rankedResults[0]).toMatchObject({
      scoreHundredths: 8700,
      secondaryGroupName: 'Jugend 1',
      primaryRun: {
        attackTimeHundredths: 4300,
        attackTimeErrors: 2,
        scoreHundredths: 4500,
      },
      secondaryRun: {
        attackTimeHundredths: 4100,
        attackTimeErrors: 1,
        scoreHundredths: 4200,
      },
    });
  });

  it('uses KV for event metadata but Evaluation Types for category visibility', async () => {
    mockDb.all.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const kvData = {
      'event:name': 'Bezirksfeuerwehrleistungsbewerb 2026',
      'public:url': 'https://custom-domain.at',
    };

    const ctx = createMockContext(kvData);
    const res = await onRequestGet(ctx);

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.eventTitle).toBe('Bezirksfeuerwehrleistungsbewerb 2026');
    expect(data.publicUrl).toBe('https://custom-domain.at');
    expect(data.categories['bronze-aktiv'].displayName).toBe('Bronze Aktiv');
    expect(data.categories['bronze-aktiv'].publicEnabled).toBe(true);
    expect(data.categories['silber-aktiv'].displayName).toBe('Silber Aktiv');
    expect(data.categories['silber-aktiv'].publicEnabled).toBe(true);
  });

  it('builds a cross-class combined evaluation from database-backed evaluation rows', async () => {
    const entriesData = [
      {
        id: 'active-entry', groupId: 'active-group', categoryTypeId: 'active-category',
        runStatus: 'VALID', startOrderPosition: null,
        attackTimeHundredths: 4300, attackTimeErrors: 2,
        relayRaceHundredths: null, relayRaceErrors: null,
        groupName: 'Active 1', competitionClass: 'ACTIVE',
        fireBrigadeId: 'brigade-1', fireBrigadeName: 'FF Example',
      },
      {
        id: 'youth-entry', groupId: 'youth-group', categoryTypeId: 'youth-category',
        runStatus: 'VALID', startOrderPosition: null,
        attackTimeHundredths: 4100, attackTimeErrors: 1,
        relayRaceHundredths: null, relayRaceErrors: null,
        groupName: 'Youth 1', competitionClass: 'YOUTH',
        fireBrigadeId: 'brigade-1', fireBrigadeName: 'FF Example',
      },
    ];
    const evaluationTypes = [{
      id: 'overall-brigade', name: 'Overall Brigade',
      categoryTypeId1: 'active-category', categoryTypeId2: 'youth-category',
      excludeRelayRace: false, isBrigadePairing: true, is_brigade_pairing: 1, public: true, publicTv: true,
      displayDurationSeconds: 10, order: 1,
    }];
    const categoryTypes = [
      { id: 'active-category', name: 'Active', competitionClassId: 'class-active', hasRelayRace: false },
      { id: 'youth-category', name: 'Youth', competitionClassId: 'class-youth', hasRelayRace: false },
    ];
    mockDb.all
      .mockResolvedValueOnce(entriesData)
      .mockResolvedValueOnce(evaluationTypes)
      .mockResolvedValueOnce(categoryTypes);

    const response = await onRequestGet(createMockContext());
    const data: any = await response.json();

    expect(data.categories['overall-brigade'].type).toBe('combined');
    expect(data.categories['overall-brigade'].rankedResults).toEqual([
      expect.objectContaining({
        rank: 1,
        fireBrigadeId: 'brigade-1',
        primaryRun: expect.objectContaining({
          entryId: 'active-entry',
        }),
        secondaryRun: expect.objectContaining({
          entryId: 'youth-entry',
        }),
        scoreHundredths: 8700,
      }),
    ]);
  });
});
