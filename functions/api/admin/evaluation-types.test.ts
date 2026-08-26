import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPost } from './evaluation-types/index';
import { onRequestPut, onRequestDelete } from './evaluation-types/[id]';
import * as utils from './utils';

// Mock getDb and logAudit
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Evaluation Types API Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      all: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      delete: vi.fn().mockReturnThis(),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb);
  });

  const createMockContext = (method: string, body?: any, params?: any, kv?: any) => {
    const request = new Request('https://example.com/api', {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (body) {
      request.json = vi.fn().mockResolvedValue(body);
    }
    return {
      request,
      env: { DB: {}, KV: kv },
      data: { adminUser: 'admin@test.com' },
      params: params || {},
    } as any;
  };

  it('GET /evaluation-types returns list of evaluation types', async () => {
    // 1st all(): evaluationTypes
    mockDb.all.mockResolvedValueOnce([
      {
        id: 'eval-1',
        name: 'Gesamtwertung',
        categoryTypeId1: 'cat-1',
        categoryTypeId2: 'cat-2',
        showSingleResults: true,
        displayDurationSeconds: 12,
        order: 1,
      },
    ]);
    // 2nd all(): categoryTypes
    mockDb.all.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true },
      { id: 'cat-2', name: 'Silber Aktiv', hasRelayRace: true },
    ]);

    const ctx = createMockContext('GET');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([
      expect.objectContaining({
        id: 'eval-1',
        name: 'Gesamtwertung',
        categoryTypeId1: 'cat-1',
        categoryTypeName1: 'Bronze Aktiv',
        hasRelayRace1: true,
        categoryTypeId2: 'cat-2',
        showSingleResults: true,
        displayDurationSeconds: 12,
        order: 1,
      }),
    ]);
  });

  it('POST /evaluation-types creates a new evaluation type', async () => {
    // categoryTypeId1 lookup
    mockDb.limit.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);

    const ctx = createMockContext('POST', {
      name: 'Bronze Wertung Neu',
      categoryTypeId1: 'cat-1',
      isBrigadePairing: true, // Should be forced to false because categoryTypeId2 is not set
      showSingleResults: true,
      displayDurationSeconds: 15,
      order: 3,
    });

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Bronze Wertung Neu',
      categoryTypeId1: 'cat-1',
      isBrigadePairing: false,
      showSingleResults: false,
      displayDurationSeconds: 15,
      order: 3,
    }));
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('POST /evaluation-types creates combination evaluation with isBrigadePairing true when categoryTypeId2 is present', async () => {
    // categoryTypeId1 lookup
    mockDb.limit.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);
    // categoryTypeId2 lookup
    mockDb.limit.mockResolvedValueOnce([{ id: 'cat-2', name: 'Bronze Jugend', hasRelayRace: false }]);

    const ctx = createMockContext('POST', {
      name: 'Gesamt Wehrwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: 'cat-2',
      isBrigadePairing: true,
      showSingleResults: true,
      displayDurationSeconds: 10,
    });

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Gesamt Wehrwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: 'cat-2',
      isBrigadePairing: true,
      showSingleResults: true,
    }));
  });

  it('PUT /evaluation-types/[id] updates an evaluation type without altering isBrigadePairing', async () => {
    // existing check
    mockDb.limit.mockResolvedValueOnce([{ id: 'eval-1' }]);
    // returning() on update
    mockDb.returning.mockResolvedValueOnce([{
      id: 'eval-1',
      name: 'Bronze Wertung Updated',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: null,
      excludeRelayRace: false,
      isBrigadePairing: false,
      public: true,
      public_tv: false,
      displayDurationSeconds: 20,
      order: 1,
    }]);
    // category types lookup for full response mapping
    mockDb.all.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);

    const ctx = createMockContext('PUT', { displayDurationSeconds: 20, publicTv: false, isBrigadePairing: true }, { id: 'eval-1' });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.not.objectContaining({
      isBrigadePairing: true,
    }));
    const data = await res.json();
    expect(data).toMatchObject({
      id: 'eval-1',
      displayDurationSeconds: 20,
      publicTv: false,
    });
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it.each([true, false])('PUT /evaluation-types/[id] persists showSingleResults=%s for a combined evaluation', async (showSingleResults) => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'eval-1',
      name: 'Gesamtwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: 'cat-2',
      showSingleResults: !showSingleResults,
    }]);
    mockDb.returning.mockResolvedValueOnce([{
      id: 'eval-1',
      name: 'Gesamtwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: 'cat-2',
      excludeRelayRace: false,
      isBrigadePairing: false,
      showSingleResults,
      public: true,
      public_tv: true,
      displayDurationSeconds: 10,
      order: 1,
    }]);
    mockDb.all.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true },
      { id: 'cat-2', name: 'Silber Aktiv', hasRelayRace: true },
    ]);

    const ctx = createMockContext('PUT', { showSingleResults }, { id: 'eval-1' });
    const res = await onRequestPut(ctx);

    expect(res.status).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ showSingleResults }));
    await expect(res.json()).resolves.toMatchObject({
      categoryTypeId2: 'cat-2',
      showSingleResults,
    });
  });

  it('PUT /evaluation-types/[id] clears Show Single Results when the second discipline is removed', async () => {
    mockDb.limit.mockResolvedValueOnce([{
      id: 'eval-1',
      name: 'Gesamtwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: 'cat-2',
      showSingleResults: true,
    }]);
    mockDb.returning.mockResolvedValueOnce([{
      id: 'eval-1',
      name: 'Gesamtwertung',
      categoryTypeId1: 'cat-1',
      categoryTypeId2: null,
      excludeRelayRace: false,
      isBrigadePairing: false,
      showSingleResults: false,
      public: true,
      public_tv: true,
      displayDurationSeconds: 10,
      order: 1,
    }]);
    mockDb.all.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);

    const ctx = createMockContext('PUT', {
      categoryTypeId2: null,
      showSingleResults: true,
    }, { id: 'eval-1' });
    const res = await onRequestPut(ctx);

    expect(res.status).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
      categoryTypeId2: null,
      showSingleResults: false,
    }));
    await expect(res.json()).resolves.toMatchObject({
      categoryTypeId2: null,
      showSingleResults: false,
    });
  });

  it('DELETE /evaluation-types/[id] deletes an evaluation type', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 'eval-1', name: 'Bronze Wertung' }]);
    const ctx = createMockContext('DELETE', null, { id: 'eval-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(utils.logAudit).toHaveBeenCalled();
  });
});
