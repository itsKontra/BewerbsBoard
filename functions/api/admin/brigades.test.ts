import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPost } from './brigades/index';
import { onRequestPut, onRequestDelete } from './brigades/[id]';
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

describe('Brigades API Endpoints', () => {
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

  const createMockContext = (method: string, body?: any, params?: any) => {
    const request = new Request('https://example.com/api', {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    // mock json method
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

  it('GET /brigades returns list of brigades', async () => {
    mockDb.all.mockResolvedValue([{ id: '1', name: 'Brigade 1' }]);
    const ctx = createMockContext('GET');
    
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([{ id: '1', name: 'Brigade 1' }]);
  });

  it('POST /brigades creates a new brigade', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const ctx = createMockContext('POST', { name: 'New Brigade' });
    
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);
    
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Brigade' }));
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('POST /brigades rejects a case-insensitive duplicate after trimming', async () => {
    mockDb.all.mockResolvedValueOnce([{ id: '1', name: 'FF Musterstadt' }]);
    const ctx = createMockContext('POST', { name: '  ff musterSTADT  ' });

    const res = await onRequestPost(ctx);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('POST /brigades maps a concurrent unique-constraint conflict to the duplicate response', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.values.mockRejectedValueOnce(new Error('UNIQUE constraint failed: fire_brigades.name'));
    const ctx = createMockContext('POST', { name: 'FF Musterstadt' });

    const res = await onRequestPost(ctx);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' });
  });

  it('PUT /brigades/[id] updates a brigade', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValue([{ id: '1', name: 'Updated' }]);
    const ctx = createMockContext('PUT', { name: 'Updated' }, { id: '1' });
    
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith({ name: 'Updated' });
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('PUT /brigades/[id] rejects renaming to another normalized brigade name', async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: '1', name: 'FF Altstadt' },
      { id: '2', name: 'FF Neustadt' },
    ]);
    const ctx = createMockContext('PUT', { name: ' ff NEUSTADT ' }, { id: '1' });

    const res = await onRequestPut(ctx);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PUT /brigades/[id] maps a concurrent unique-constraint conflict to the duplicate response', async () => {
    mockDb.all.mockResolvedValueOnce([]);
    mockDb.returning.mockRejectedValueOnce(new Error('UNIQUE constraint failed: fire_brigades.name'));
    const ctx = createMockContext('PUT', { name: 'FF Neustadt' }, { id: '1' });

    const res = await onRequestPut(ctx);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' });
  });

  it('DELETE /brigades/[id] deletes a brigade when no groups are linked', async () => {
    // linkedGroups check returns empty
    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValue([{ id: '1', name: 'Brigade 1' }]);

    const ctx = createMockContext('DELETE', null, { id: '1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);
    
    expect(mockDb.delete).toHaveBeenCalled();
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('DELETE /brigades/[id] fails when groups are linked', async () => {
    // linkedGroups check returns a group
    mockDb.limit.mockResolvedValueOnce([{ id: 'g1' }]);

    const ctx = createMockContext('DELETE', null, { id: '1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(400);
    
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
