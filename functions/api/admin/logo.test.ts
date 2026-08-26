import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestDelete } from './logo/index';
import { onRequestPost as uploadHandler } from './logo/upload';
import { onRequestPost as fetchUrlHandler } from './logo/fetch-url';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Admin Logo Endpoints (Cloudflare Pages Functions)', () => {
  let mockKv: Record<string, string>;
  let kvBinding: any;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKv = {};

    mockDb = {
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue({}),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    };

    vi.mocked(utils.getDb).mockReturnValue(mockDb as any);

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

  describe('DELETE /api/admin/logo', () => {
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
        env: { KV: kvBinding, DB: {} },
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

  describe('POST /api/admin/logo/upload', () => {
    it('rejects invalid or empty upload', async () => {
      const context: any = {
        env: { KV: kvBinding, DB: {} },
        data: { adminUser: 'admin@feuerwehr.at' },
        request: new Request('http://localhost/api/admin/logo/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      };

      const response = await uploadHandler(context);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    it('uploads valid PNG logo via multipart form data and saves to KV and D1', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      const formData = new FormData();
      const file = new File([pngBytes], 'logo.png', { type: 'image/png' });
      formData.append('file', file);

      const context: any = {
        env: { KV: kvBinding, DB: {} },
        data: { adminUser: 'admin@feuerwehr.at' },
        request: new Request('http://localhost/api/admin/logo/upload', {
          method: 'POST',
          body: formData,
        }),
      };

      const response = await uploadHandler(context);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.logoUrl).toMatch(/^\/api\/public\/logo\?v=\d+$/);

      expect(mockKv['tv:custom-logo']).toBeDefined();
      const parsedStored = JSON.parse(mockKv['tv:custom-logo']);
      expect(parsedStored.mimeType).toBe('image/png');
      expect(parsedStored.base64Data).toBeDefined();

      expect(mockKv['tv:presentation']).toBeDefined();
      const parsedPres = JSON.parse(mockKv['tv:presentation']);
      expect(parsedPres.logoOverride).toBe(json.logoUrl);

      expect(utils.logAudit).toHaveBeenCalled();
    });

    it('uploads and sanitizes SVG logo', async () => {
      const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle cx="5" cy="5" r="5"/></svg>';
      const formData = new FormData();
      formData.append('file', new File([rawSvg], 'logo.svg', { type: 'image/svg+xml' }));

      const context: any = {
        env: { KV: kvBinding, DB: {} },
        data: { adminUser: 'admin@feuerwehr.at' },
        request: new Request('http://localhost/api/admin/logo/upload', {
          method: 'POST',
          body: formData,
        }),
      };

      const response = await uploadHandler(context);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);

      const parsedStored = JSON.parse(mockKv['tv:custom-logo']);
      expect(parsedStored.mimeType).toBe('image/svg+xml');
      const decodedSvg = atob(parsedStored.base64Data);
      expect(decodedSvg).not.toContain('onload');
      expect(decodedSvg).not.toContain('<script');
      expect(decodedSvg).toContain('<circle');
    });
  });

  describe('POST /api/admin/logo/fetch-url', () => {
    it('rejects invalid or missing URL', async () => {
      const context: any = {
        env: { KV: kvBinding, DB: {} },
        data: { adminUser: 'admin@feuerwehr.at' },
        request: new Request('http://localhost/api/admin/logo/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'ftp://example.com/logo.png' }),
        }),
      };

      const response = await fetchUrlHandler(context);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('HTTP');
    });

    it('downloads remote logo and caches it in storage', async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(pngBytes.buffer),
      } as any);

      const context: any = {
        env: { KV: kvBinding, DB: {} },
        data: { adminUser: 'admin@feuerwehr.at' },
        request: new Request('http://localhost/api/admin/logo/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://feuerwehr.at/bundeslogo.png' }),
        }),
      };

      const response = await fetchUrlHandler(context);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.logoUrl).toMatch(/^\/api\/public\/logo\?v=\d+$/);

      expect(mockKv['tv:custom-logo']).toBeDefined();
      expect(utils.logAudit).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
