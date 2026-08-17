import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from './reset';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Database Reset API Endpoint (/api/admin/reset)', () => {
  let mockBatchCalls: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCalls = [];

    const mockDb = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => Promise.resolve([
          { id: '1', name: 'Brigade 1' }
        ])),
      })),
      delete: vi.fn().mockImplementation((table) => ({
        table,
        op: 'delete',
      })),
      update: vi.fn().mockImplementation((table) => ({
        set: vi.fn().mockImplementation((setValues) => ({
          where: vi.fn().mockImplementation((whereCond) => ({
            table,
            setValues,
            whereCond,
            op: 'update',
          })),
        })),
      })),
      insert: vi.fn().mockImplementation((table) => ({
        values: vi.fn().mockImplementation((values) => ({
          table,
          values,
          op: 'insert',
        })),
      })),
      batch: vi.fn().mockImplementation(async (batchOps: any[]) => {
        mockBatchCalls.push(batchOps);
        return [];
      }),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb as any);
  });

  const createMockContext = (body?: any) => {
    const request = new Request('https://example.com/api/admin/reset', {
      method: 'POST',
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

  it('rejects request with 400 if confirmation keyword is missing or incorrect', async () => {
    const ctx1 = createMockContext({ confirmationKeyword: 'wrong' });
    const res1 = await onRequestPost(ctx1);
    expect(res1.status).toBe(400);

    const ctx2 = createMockContext({ confirmationKeyword: 'loeschen' }); // lowercase
    const res2 = await onRequestPost(ctx2);
    expect(res2.status).toBe(400);

    const ctx3 = createMockContext({});
    const res3 = await onRequestPost(ctx3);
    expect(res3.status).toBe(400);
  });

  it('executes atomic batch reset when confirmation keyword is "LÖSCHEN"', async () => {
    const ctx = createMockContext({ confirmationKeyword: 'LÖSCHEN' });
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.message).toContain('erfolgreich zurückgesetzt');

    // Batch should contain deletes, TV state reset, and audit log insert
    expect(mockBatchCalls).toHaveLength(1);
    const ops = mockBatchCalls[0];
    expect(ops.length).toBeGreaterThanOrEqual(5); // delete entries, groups, brigades, update tv, insert audit
  });

  it('handles selective scopes with dependency cascading', async () => {
    const ctx = createMockContext({
      confirmationKeyword: 'LÖSCHEN',
      scopes: { categoryEntries: true, groups: false, fireBrigades: false },
    });
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.message).toContain('erfolgreich zurückgesetzt');
    expect(json.summary.categoryEntriesCount).toBeDefined();
    expect(json.summary.groupsCount).toBeUndefined();

    expect(mockBatchCalls).toHaveLength(1);
    const ops = mockBatchCalls[0];
    // 1 delete (categoryEntries) + 1 tvReset + 1 auditInsert = 3 ops
    expect(ops).toHaveLength(3);
  });
});
