import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './audit-logs';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Audit Logs API Endpoint (/api/admin/audit-logs)', () => {
  let mockLogs: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogs = [
      {
        id: 'log-1',
        timestamp: 1700000000000,
        user: 'admin@feuerwehr.at',
        action: 'UPDATE',
        details: JSON.stringify({ entity: 'CONFIG' }),
      },
      {
        id: 'log-2',
        timestamp: 1700000100000,
        user: 'user2@feuerwehr.at',
        action: 'DATABASE_CLEAR',
        details: JSON.stringify({ preClearCounts: { fireBrigadesCount: 2 } }),
      },
      {
        id: 'log-3',
        timestamp: 1700000200000,
        user: 'admin@feuerwehr.at',
        action: 'DELETE_CATEGORY_ENTRY',
        details: JSON.stringify({ entryId: 'e-1' }),
      },
    ];

    const mockDb = {
      select: vi.fn().mockImplementation((arg) => {
        const isCount = arg && typeof arg === 'object' && 'count' in arg;
        const chain: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          offset: vi.fn().mockImplementation(() => Promise.resolve(mockLogs)),
          then: (resolve: any) => resolve(isCount ? [{ count: mockLogs.length }] : mockLogs),
        };
        return chain;
      }),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb as any);
  });

  const createMockContext = (url: string) => {
    const request = new Request(url, { method: 'GET' });
    return {
      request,
      env: { DB: {} },
      data: { adminUser: 'admin@feuerwehr.at' },
      params: {},
    } as any;
  };

  it('GET returns paginated audit log entries with metadata', async () => {
    const ctx = createMockContext('https://example.com/api/admin/audit-logs?page=1&limit=2');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('logs');
    expect(data).toHaveProperty('total', 3);
    expect(data).toHaveProperty('page', 1);
    expect(data).toHaveProperty('limit', 2);
  });

  it('GET defaults to page 1 and limit 20 when parameters are omitted', async () => {
    const ctx = createMockContext('https://example.com/api/admin/audit-logs');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.page).toBe(1);
    expect(data.limit).toBe(20);
  });
});
