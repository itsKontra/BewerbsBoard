import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet as exportHandler } from './export';
import { onRequestPost as preflightHandler } from './import/preflight';
import { onRequestPost as importHandler } from './import/index';
import * as utils from '../utils';

vi.mock('../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Cloudflare Pages Data Management API', () => {
  let mockBatchCalls: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCalls = [];

    const mockDb = {
      select: vi.fn().mockImplementation((_fields) => ({
        from: vi.fn().mockImplementation((_table) => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve([
            { id: '1', name: 'Entity 1' },
          ])),
          then: (resolve: any) => resolve([{ id: '1', name: 'Entity 1', key: 'event:name' }]),
        })),
      })),
      insert: vi.fn().mockImplementation((_table) => ({
        values: vi.fn().mockImplementation((_vals) => ({
          onConflictDoUpdate: vi.fn().mockImplementation(() => ({
            op: 'upsert',
          })),
        })),
      })),
      batch: vi.fn().mockImplementation(async (batchOps: any[]) => {
        mockBatchCalls.push(batchOps);
        return [];
      }),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb as any);
  });

  const createMockContext = (method: string, body?: any) => {
    const request = new Request('https://example.com/api/admin/data', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (body) {
      request.json = vi.fn().mockResolvedValue(body);
    }
    return {
      request,
      env: { DB: {} },
      data: { adminUser: 'admin@feuerwehr.at' },
      params: {},
    } as any;
  };

  it('exportHandler exports full envelope and sets attachment header', async () => {
    const ctx = createMockContext('GET');
    const res = await exportHandler(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="bewerbsboard-export-');
    const json = await res.json() as any;
    expect(json.version).toBe(1);
    expect(json.data).toBeDefined();
    expect(utils.logAudit).toHaveBeenCalledWith(expect.anything(), 'admin@feuerwehr.at', 'DATA_EXPORT', expect.anything());
  });

  it('preflightHandler validates payload and counts updates', async () => {
    const ctx = createMockContext('POST', {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        appConfig: [],
        competitionClasses: [{ id: '1', name: 'Class 1' }],
        fireBrigades: [{ id: 'fb-new', name: 'New Brigade' }],
        categoryTypes: [],
        evaluationTypes: [],
        groups: [],
        categoryEntries: [],
      },
    });
    const res = await preflightHandler(ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.isValid).toBe(true);
    expect(json.summary.competitionClasses.toUpdate).toBe(1);
    expect(json.summary.fireBrigades.toInsert).toBe(1);
  });

  it('importHandler batches upserts and completes successfully', async () => {
    const ctx = createMockContext('POST', {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        appConfig: [{ key: 'event:name', valueJson: '"Title"', updatedAt: 12345 }],
        competitionClasses: [{ id: 'cc-1', name: 'Aktiv' }],
        fireBrigades: [{ id: 'fb-1', name: 'FF' }],
        categoryTypes: [{ id: 'ct-1', name: 'Bronze', competitionClassId: 'cc-1', hasRelayRace: true }],
        evaluationTypes: [{
          id: 'et-1',
          name: 'Gesamt',
          categoryTypeId1: 'ct-1',
          categoryTypeId2: null,
          excludeRelayRace: false,
          isBrigadePairing: false,
          public: true,
          publicTv: true,
          displayDurationSeconds: 10,
          order: 1,
        }],
        groups: [{ id: 'g-1', fireBrigadeId: 'fb-1', competitionClassId: 'cc-1', name: 'Gruppe 1' }],
        categoryEntries: [{
          id: 'ce-1',
          groupId: 'g-1',
          categoryTypeId: 'ct-1',
          runStatus: 'VALID',
          startOrderPosition: 1,
          attackTimeHundredths: 5000,
          attackTimeErrors: 0,
          relayRaceHundredths: null,
          relayRaceErrors: null,
        }],
      },
    });

    const res = await importHandler(ctx);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.message).toContain('erfolgreich');
    expect(mockBatchCalls).toHaveLength(1);
  });
});
