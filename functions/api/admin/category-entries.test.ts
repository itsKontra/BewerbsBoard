import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from './category-entries/index';
import { onRequestPost as onReorderPost } from './category-entries/reorder';
import { onRequestDelete, onRequestPut } from './category-entries/[id]';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Category Entries API Endpoints', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      all: vi.fn(),
      get: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      delete: vi.fn().mockReturnThis(),
      batch: vi.fn().mockResolvedValue([]),
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

  describe('POST /category-entries', () => {
    it('requires the category type ID rather than its display name', async () => {
      const ctx = createMockContext('POST', { groupId: 'g1', categoryType: 'Bronze Aktiv' });

      const res = await onRequestPost(ctx);

      expect(res.status).toBe(400);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('creates a new category entry', async () => {
      // Mock getting the group info
      mockDb.limit.mockResolvedValueOnce([{ id: 'g1', competitionClassId: 'cc-aktiv' }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 'cat-bronze-aktiv', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: false }]);
      // Mock checking for duplicate entry (returns empty)
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock getting the max start_order_position
      mockDb.get.mockResolvedValueOnce({ maxPos: 5 });

      const ctx = createMockContext('POST', { groupId: 'g1', categoryTypeId: 'cat-bronze-aktiv' });

      const res = await onRequestPost(ctx);
      expect(res.status).toBe(201);

      // Should have used db.batch for atomic insert + audit log
      expect(mockDb.batch).toHaveBeenCalled();

      const responseData: any = await res.json();
      expect(responseData.message).toBe('Category entry added successfully');
    });

    it('fails if group does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const ctx = createMockContext('POST', { groupId: 'invalid', categoryTypeId: 'cat-bronze-aktiv' });
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(404);
    });

    it('rejects incompatible group type', async () => {
      // Group is JUGEND, but category is bronze-aktiv
      mockDb.limit.mockResolvedValueOnce([{ id: 'g1', competitionClassId: 'cc-jugend' }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 'cat-bronze-aktiv', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: false }]);

      const ctx = createMockContext('POST', { groupId: 'g1', categoryTypeId: 'cat-bronze-aktiv' });
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain('Incompatible');
    });

    it('rejects duplicate entry for the same group and category', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'g1', competitionClassId: 'cc-aktiv' }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 'cat-bronze-aktiv', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: false }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing-entry' }]);

      const ctx = createMockContext('POST', { groupId: 'g1', categoryTypeId: 'cat-bronze-aktiv' });
      const res = await onRequestPost(ctx);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /category-entries/reorder', () => {
    it('reorders open entries sequentially', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 'entry2', categoryTypeId: 'bronze-aktiv', runStatus: 'OPEN' },
        { id: 'entry1', categoryTypeId: 'bronze-aktiv', runStatus: 'OPEN' },
        { id: 'entry3', categoryTypeId: 'bronze-aktiv', runStatus: 'OPEN' },
      ]);

      const ctx = createMockContext('POST', {
        categoryTypeId: 'bronze-aktiv',
        orderedIds: ['entry2', 'entry1', 'entry3'],
      });

      const res = await onReorderPost(ctx);
      expect(res.status).toBe(200);
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('fails if not all ordered IDs exist in the category', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 'entry1', categoryTypeId: 'bronze-aktiv', runStatus: 'OPEN' },
        // entry2 is missing
      ]);

      const ctx = createMockContext('POST', {
        categoryTypeId: 'bronze-aktiv',
        orderedIds: ['entry1', 'entry2'],
      });

      const res = await onReorderPost(ctx);
      expect(res.status).toBe(400);
    });

    it('fails if some entries are not OPEN', async () => {
      mockDb.all.mockResolvedValueOnce([
        { id: 'entry1', categoryTypeId: 'bronze-aktiv', runStatus: 'VALID' },
      ]);

      const ctx = createMockContext('POST', {
        categoryTypeId: 'bronze-aktiv',
        orderedIds: ['entry1'],
      });

      const res = await onReorderPost(ctx);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /category-entries/[id]', () => {
    it('parses German decimal time and auto-transitions OPEN to VALID with compaction and audit log', async () => {
      // Previous entry state: OPEN at pos 1
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'entry1',
          groupId: 'g1',
          categoryTypeId: 'cat-bronze-aktiv',
          runStatus: 'OPEN',
          startOrderPosition: 1,
          attackTimeHundredths: null,
          errors: null,
          scoreHundredths: null,
        },
      ]);
      // Remaining OPEN entries for compaction
      mockDb.all.mockResolvedValueOnce([
        { id: 'entry2', startOrderPosition: 2 },
        { id: 'entry3', startOrderPosition: 3 },
      ]);

      const ctx = createMockContext(
        'PUT',
        { attackTimeStr: '42,38', errors: 0 },
        { id: 'entry1' }
      );

      const res = await onRequestPut(ctx);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.entry.runStatus).toBe('VALID');
      expect(body.entry.attackTimeHundredths).toBe(4238);
      expect(body.entry.errors).toBe(0);
      expect(body.entry.scoreHundredths).toBe(4238);
      expect(body.entry.startOrderPosition).toBeNull();

      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('keeps OPEN status when entering time with blank errors', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'entry1',
          groupId: 'g1',
          categoryTypeId: 'cat-bronze-aktiv',
          runStatus: 'OPEN',
          startOrderPosition: 1,
          attackTimeHundredths: null,
          errors: null,
          scoreHundredths: null,
        },
      ]);

      const ctx = createMockContext(
        'PUT',
        { attackTimeStr: '42,38', errors: null },
        { id: 'entry1' }
      );

      const res = await onRequestPut(ctx);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.entry.runStatus).toBe('OPEN');
      expect(body.entry.attackTimeHundredths).toBe(4238);
      expect(body.entry.errors).toBeNull();
      expect(body.entry.startOrderPosition).toBe(1);
    });

    it('sets DNF status manually and compacts remaining OPEN entries', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'entry1',
          groupId: 'g1',
          categoryTypeId: 'cat-bronze-aktiv',
          runStatus: 'OPEN',
          startOrderPosition: 1,
          attackTimeHundredths: null,
          errors: null,
          scoreHundredths: null,
        },
      ]);
      mockDb.all.mockResolvedValueOnce([{ id: 'entry2', startOrderPosition: 2 }]);

      const ctx = createMockContext(
        'PUT',
        { runStatus: 'DNF' },
        { id: 'entry1' }
      );

      const res = await onRequestPut(ctx);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.entry.runStatus).toBe('DNF');
      expect(body.entry.startOrderPosition).toBeNull();
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('reverts VALID entry to OPEN, retaining recorded time/errors and assigning N + 1 start position', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'entry1',
          groupId: 'g1',
          categoryTypeId: 'cat-bronze-aktiv',
          runStatus: 'VALID',
          startOrderPosition: null,
          attackTimeHundredths: 4238,
          errors: 5,
          scoreHundredths: 4738,
        },
      ]);
      // Mock max startOrderPosition for existing OPEN entries = 4
      mockDb.get.mockResolvedValueOnce({ maxPos: 4 });

      const ctx = createMockContext(
        'PUT',
        { runStatus: 'OPEN' },
        { id: 'entry1' }
      );

      const res = await onRequestPut(ctx);
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.entry.runStatus).toBe('OPEN');
      expect(body.entry.attackTimeHundredths).toBe(4238);
      expect(body.entry.errors).toBe(5);
      expect(body.entry.startOrderPosition).toBe(5);
    });

    it('rejects invalid German decimal time format', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'entry1',
          groupId: 'g1',
          categoryTypeId: 'cat-bronze-aktiv',
          runStatus: 'OPEN',
          startOrderPosition: 1,
        },
      ]);

      const ctx = createMockContext(
        'PUT',
        { attackTimeStr: 'abc' },
        { id: 'entry1' }
      );

      const res = await onRequestPut(ctx);
      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain('Invalid German decimal time format');
    });
  });

  describe('DELETE /category-entries/[id]', () => {
    const createDeleteContext = (entryId: string) =>
      ({
        request: new Request('https://example.com/api', { method: 'DELETE' }),
        env: { DB: {} },
        data: { adminUser: 'admin@test.com' },
        params: { id: entryId },
      } as any);

    it('removes an OPEN entry and compacts start order', async () => {
      // Entry to delete
      mockDb.limit.mockResolvedValueOnce([
        { id: 'entry1', runStatus: 'OPEN', categoryTypeId: 'bronze-aktiv', groupId: 'g1' },
      ]);
      // Remaining OPEN entries after deletion
      mockDb.all.mockResolvedValueOnce([
        { id: 'entry2', startOrderPosition: 2 },
        { id: 'entry3', startOrderPosition: 3 },
      ]);

      const ctx = createDeleteContext('entry1');
      const res = await onRequestDelete(ctx);

      expect(res.status).toBe(200);
      // batch should include delete + 2 compaction updates + audit
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('returns 404 when entry is not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const ctx = createDeleteContext('nonexistent');
      const res = await onRequestDelete(ctx);
      expect(res.status).toBe(404);
    });

    it('rejects deletion of non-OPEN entries', async () => {
      mockDb.limit.mockResolvedValueOnce([
        { id: 'entry1', runStatus: 'VALID', categoryTypeId: 'bronze-aktiv', groupId: 'g1' },
      ]);

      const ctx = createDeleteContext('entry1');
      const res = await onRequestDelete(ctx);
      expect(res.status).toBe(400);
    });
  });
});
