import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPost } from './competition-classes/index';
import { onRequestDelete } from './competition-classes/[id]';
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

describe('Competition Classes API Endpoints', () => {
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

  it('GET /competition-classes returns list of competition classes', async () => {
    mockDb.all.mockResolvedValue([{ id: 'cc-1', name: 'AKTIV' }]);
    const ctx = createMockContext('GET');

    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([{ id: 'cc-1', name: 'AKTIV' }]);
  });

  it('POST /competition-classes creates a new competition class', async () => {
    const ctx = createMockContext('POST', { name: 'SENIOREN' });

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(201);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ name: 'SENIOREN' }));
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('POST /competition-classes rejects missing name', async () => {
    const ctx = createMockContext('POST', { name: '' });

    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it('DELETE /competition-classes/[id] deletes when no groups are linked', async () => {
    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.returning.mockResolvedValue([{ id: 'cc-1', name: 'SENIOREN' }]);

    const ctx = createMockContext('DELETE', null, { id: 'cc-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(200);

    expect(mockDb.delete).toHaveBeenCalled();
    expect(utils.logAudit).toHaveBeenCalled();
  });

  it('DELETE /competition-classes/[id] fails when groups are linked', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'g1' }]);

    const ctx = createMockContext('DELETE', null, { id: 'cc-1' });
    const res = await onRequestDelete(ctx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: 'Cannot delete competition class assigned to groups' });

    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
