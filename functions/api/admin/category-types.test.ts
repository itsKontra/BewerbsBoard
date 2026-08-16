import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPost } from './category-types/index';
import { onRequestPut, onRequestDelete } from './category-types/[id]';
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

describe('Category Types API Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
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

  it('GET /category-types returns list of category types', async () => {
    mockDb.all.mockResolvedValue([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);
    const ctx = createMockContext('GET');

    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);
  });

  it('POST /category-types creates a new category type', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-aktiv' }]);
    const ctx = createMockContext('POST', { name: 'Bronze Staffel', competitionClassId: 'cc-aktiv', hasRelayRace: true });

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bronze Staffel', competitionClassId: 'cc-aktiv', hasRelayRace: true }));
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('PUT /category-types/[id] updates a category type', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv', hasRelayRace: true }]);
    mockDb.returning.mockResolvedValueOnce([{ id: 'cat-1', name: 'Bronze Aktiv Neu', hasRelayRace: false }]);

    const ctx = createMockContext('PUT', { name: 'Bronze Aktiv Neu', hasRelayRace: false }, { id: 'cat-1' });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ id: 'cat-1', name: 'Bronze Aktiv Neu', hasRelayRace: false });

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith({ name: 'Bronze Aktiv Neu', hasRelayRace: false });
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('DELETE /category-types/[id] deletes when no entries or evaluations are linked', async () => {
    // 1st limit check: categoryEntries -> []
    mockDb.limit.mockResolvedValueOnce([]);
    // 2nd limit check: evaluationTypes -> []
    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValue([{ id: 'cat-1', name: 'Bronze Staffel' }]);

    const ctx = createMockContext('DELETE', null, { id: 'cat-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('DELETE /category-types/[id] fails when entries are linked', async () => {
    // 1st limit check: categoryEntries -> [e1]
    mockDb.limit.mockResolvedValueOnce([{ id: 'e1' }]);

    const ctx = createMockContext('DELETE', null, { id: 'cat-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: 'Cannot delete category type with registered entries' });
  });

  it('DELETE /category-types/[id] fails when evaluation types are linked', async () => {
    // 1st limit check: categoryEntries -> []
    mockDb.limit.mockResolvedValueOnce([]);
    // 2nd limit check: evaluationTypes -> [eval1]
    mockDb.limit.mockResolvedValueOnce([{ id: 'eval1' }]);

    const ctx = createMockContext('DELETE', null, { id: 'cat-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: 'Cannot delete category type referenced by evaluation types' });
  });
});
