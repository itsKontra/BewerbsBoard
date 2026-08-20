import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPost } from './groups/index';
import { onRequestPut, onRequestDelete } from './groups/[id]';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Groups API Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
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

  const createMockContext = (method: string, body?: any, params?: any) => {
    const request = new Request('https://example.com/api', {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (body) {
      request.json = vi.fn().mockResolvedValue(body);
    }
    return {
      request,
      env: { DB: {} },
      data: { adminUser: 'admin@test.com' },
      params: params || {},
    } as any;
  };

  it('GET /groups returns list of groups', async () => {
    mockDb.all.mockResolvedValue([{ id: '1', name: 'Gruppe 1' }]);
    const ctx = createMockContext('GET');
    
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
  });

  it('POST /groups creates a new group', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-aktiv', name: 'AKTIV' }]); // resolved class
    mockDb.limit.mockResolvedValueOnce([]); // no existing group
    const ctx = createMockContext('POST', { fireBrigadeId: 'b1', name: 'Gruppe 1', competitionClassId: 'cc-aktiv' });
    
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('POST /groups requires the competition class ID rather than its display name', async () => {
    const ctx = createMockContext('POST', { fireBrigadeId: 'b1', name: 'Gruppe 1', competitionClass: 'AKTIV' });

    const res = await onRequestPost(ctx);

    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('POST /groups resolves a custom competition class by ID', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-elite', name: 'ELITE' }]);
    mockDb.limit.mockResolvedValueOnce([]);
    const ctx = createMockContext('POST', { fireBrigadeId: 'b1', name: 'Elite 1', competitionClassId: 'cc-elite' });

    const res = await onRequestPost(ctx);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ name: 'Elite 1', competitionClassId: 'cc-elite', competitionClass: 'ELITE' });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ competitionClassId: 'cc-elite' }));
  });

  it('POST /groups fails on duplicate group', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-aktiv', name: 'AKTIV' }]); // resolved class
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing' }]); // existing group
    const ctx = createMockContext('POST', { fireBrigadeId: 'b1', name: 'Gruppe 1', competitionClassId: 'cc-aktiv' });
    
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(409);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('PUT /groups/[id] updates a group', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-jugend', name: 'JUGEND' }]); // resolved class
    mockDb.limit.mockResolvedValueOnce([{ id: '1', fireBrigadeId: 'b1', competitionClassId: 'cc-jugend' }]); // currentGroup
    mockDb.limit.mockResolvedValueOnce([]); // no conflict
    mockDb.limit.mockResolvedValueOnce([{ name: 'Brigade 1' }]); // prevFireBrigadeName
    mockDb.limit.mockResolvedValueOnce([{ name: 'JUGEND' }]); // prevCompetitionClassName
    mockDb.limit.mockResolvedValueOnce([{ name: 'Brigade 1' }]); // newFireBrigadeName
    mockDb.returning.mockResolvedValue([{ id: '1', fireBrigadeId: 'b1', competitionClassId: 'cc-jugend', name: 'Updated' }]);
    const ctx = createMockContext('PUT', { fireBrigadeId: 'b1', name: 'Updated', competitionClassId: 'cc-jugend' }, { id: '1' });
    
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('PUT /groups/[id] fails on duplicate name update', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'cc-jugend', name: 'JUGEND' }]); // resolved class
    mockDb.limit.mockResolvedValueOnce([{ id: '1', fireBrigadeId: 'b1', competitionClassId: 'cc-jugend' }]); // currentGroup
    mockDb.limit.mockResolvedValueOnce([{ id: 'conflict' }]); // conflict exists
    const ctx = createMockContext('PUT', { fireBrigadeId: 'b1', name: 'ConflictName', competitionClassId: 'cc-jugend' }, { id: '1' });
    
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(409);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DELETE /groups/[id] deletes a group', async () => {
    mockDb.returning.mockResolvedValue([{ id: '1', name: 'Gruppe 1', fireBrigadeId: 'b1', competitionClassId: 'c1' }]);
    mockDb.limit.mockResolvedValueOnce([{ name: 'Brigade 1' }]); // fireBrigadeName
    mockDb.limit.mockResolvedValueOnce([{ name: 'Class 1' }]); // competitionClassName
    const ctx = createMockContext('DELETE', null, { id: '1' });
    
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
