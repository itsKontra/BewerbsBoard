import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet, onRequestPut } from './tv-state';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('TV State API Endpoints (/api/admin/tv-state)', () => {
  let mockTvState: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTvState = { id: 'default', mode: 'ROTATION', selectedCategoryId: null, updatedAt: 1723100000000 };

    // Build chainable query mock
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue([mockTvState]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    // Chain: db.update().set().where()
    mockDb.set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDb.update = vi.fn().mockReturnValue({ set: mockDb.set });
    // Chain: db.select().from().where().all()
    const allFn = vi.fn().mockResolvedValue([mockTvState]);
    const whereFn = vi.fn().mockReturnValue({ all: allFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    mockDb.select = vi.fn().mockReturnValue({ from: fromFn });
    mockDb.all = allFn;

    vi.mocked(utils.getDb).mockReturnValue(mockDb as any);
  });

  const createMockContext = (method: string, body?: any) => {
    const request = new Request('https://example.com/api/admin/tv-state', {
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

  it('GET returns current tv state', async () => {
    const ctx = createMockContext('GET');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mode).toBe('ROTATION');
    expect(data.selectedCategoryId).toBeNull();
  });

  it('PUT transitions mode to FIXED with valid categoryId', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'FIXED',
      selectedCategoryId: 'bronze-aktiv',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mode).toBe('FIXED');
    expect(data.selectedCategoryId).toBe('bronze-aktiv');
    expect(data.updatedAt).toBeDefined();

    // Verify audit was logged
    expect(utils.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      'admin@feuerwehr.at',
      'UPDATE_TV_STATE',
      expect.objectContaining({
        operation: 'UPDATE',
      })
    );
  });

  it('PUT rejects invalid mode', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'INVALID_MODE',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Invalid mode');
  });

  it('PUT rejects FIXED mode without selectedCategoryId', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'FIXED',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('selectedCategoryId is required');
  });

  it('PUT rejects WINNERS mode without selectedCategoryId', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'WINNERS',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('selectedCategoryId is required');
  });

  it('PUT allows ROTATION mode without selectedCategoryId', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'ROTATION',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mode).toBe('ROTATION');
    expect(data.selectedCategoryId).toBeNull();
  });

  it('PUT allows MESSAGE mode without selectedCategoryId', async () => {
    const ctx = createMockContext('PUT', {
      mode: 'MESSAGE',
    });
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mode).toBe('MESSAGE');
  });
});
