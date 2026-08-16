import { describe, it, expect, vi } from 'vitest';
import { onRequest } from './_middleware';

describe('nginx proxy identity middleware', () => {
  const createMockContext = (headers: Record<string, string>) => {
    const reqHeaders = new Headers(headers);
    const request = new Request('https://example.com/api/admin/test', {
      headers: reqHeaders,
    });

    const nextResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const next = vi.fn().mockResolvedValue(nextResponse);

    return {
      context: {
        request,
        env: {},
        data: {} as Record<string, unknown>,
        next,
        functionPath: '/api/admin/test',
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        params: {},
      },
      next,
    };
  };

  it('ignores forged legacy identity and leaves authorization to nginx', async () => {
    const { context, next } = createMockContext({
      'Cf-Access-Authenticated-User-Email': 'admin@feuerwehr.at',
      'Cf-Access-Jwt-Assertion': 'fake-jwt-token',
    });

    const res = await onRequest(context as any);

    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalled();
    expect(context.data.adminUser).toBeUndefined();
  });

  it('uses the normalized nginx proxy identity as the audit actor when admin role is present', async () => {
    const { context, next } = createMockContext({
      'X-Auth-Request-Email': 'ADMIN@feuerwehr.at ',
      'X-Auth-Request-Roles': 'admin',
    });

    const res = await onRequest(context as any);

    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalled();
    expect(context.data.adminUser).toBe('admin@feuerwehr.at');
  });

  it('rejects with 403 Forbidden when identity is present but admin role is missing', async () => {
    const { context, next } = createMockContext({
      'X-Auth-Request-Email': 'user@feuerwehr.at',
      'X-Auth-Request-Roles': 'viewer',
    });

    const res = await onRequest(context as any);

    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden: admin role required' });
  });
});
