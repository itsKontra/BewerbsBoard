import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestDelete } from './logo';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Admin Logo Endpoint (DELETE /api/admin/logo)', () => {
  let mockKv: Record<string, string>;
  let kvBinding: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKv = {};

    vi.mocked(utils.getDb).mockReturnValue({
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    kvBinding = {
      get: vi.fn().mockImplementation(async (key: string) => mockKv[key] ?? null),
      put: vi.fn().mockImplementation(async (key: string, val: string) => {
        mockKv[key] = val;
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        delete mockKv[key];
      }),
    };
  });

  it('deletes custom logo and clears logoOverride if pointing to /api/public/logo', async () => {
    mockKv['tv:custom-logo'] = JSON.stringify({
      mimeType: 'image/png',
      base64Data: 'sample',
      updatedAt: 1700000000000,
    });
    mockKv['tv:presentation'] = JSON.stringify({
      theme: 'broadcast',
      logoOverride: '/api/public/logo?v=1700000000000',
    });

    const context: any = {
      env: { KV: kvBinding },
      data: { adminUser: 'admin@feuerwehr.at' },
      request: new Request('http://localhost/api/admin/logo', { method: 'DELETE' }),
    };

    const response = await onRequestDelete(context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    expect(mockKv['tv:custom-logo']).toBeUndefined();
    expect(JSON.parse(mockKv['tv:presentation']).logoOverride).toBe('');
    expect(utils.logAudit).toHaveBeenCalled();
  });
});
