import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestGet } from './logo';
import * as utils from '../admin/utils';

vi.mock('../admin/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../admin/utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Public Logo Function (GET /api/public/logo)', () => {
  let mockKv: Record<string, string>;
  let kvBinding: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKv = {};

    vi.mocked(utils.getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
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

  it('returns 404 Not Found when no custom logo is stored in KV or D1', async () => {
    const context: any = {
      env: { KV: kvBinding },
      request: new Request('http://localhost/api/public/logo'),
    };
    const response = await onRequestGet(context);
    expect(response.status).toBe(404);
  });

  it('returns binary image and headers when custom logo is stored in KV', async () => {
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    mockKv['tv:custom-logo'] = JSON.stringify({
      mimeType: 'image/png',
      base64Data: samplePngBase64,
      updatedAt: 1700000000000,
    });

    const context: any = {
      env: { KV: kvBinding },
      request: new Request('http://localhost/api/public/logo'),
    };
    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('serves SVG custom logo with CSP and nosniff headers', async () => {
    const sampleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>';
    const sampleSvgBase64 = btoa(sampleSvg);
    mockKv['tv:custom-logo'] = JSON.stringify({
      mimeType: 'image/svg+xml',
      base64Data: sampleSvgBase64,
      updatedAt: 1700000000000,
    });

    const context: any = {
      env: { KV: kvBinding },
      request: new Request('http://localhost/api/public/logo'),
    };
    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const text = await response.text();
    expect(text).toContain('<circle');
  });
});
