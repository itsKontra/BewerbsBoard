import { describe, it, expect, vi } from 'vitest';
import { onRequest, type EventContext } from './_middleware';

describe('Admin HTML nginx proxy identity middleware', () => {
  const createMockContext = (
    headers: Record<string, string> = {}
  ): EventContext => {
    const reqHeaders = new Headers(headers);
    const mockNext = vi.fn().mockResolvedValue(new Response('Admin Page HTML', { status: 200 }));

    return {
      request: new Request('https://scoreboard.pages.dev/admin', { headers: reqHeaders }),
      functionPath: '/admin',
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      next: mockNext,
      env: {},
      params: {},
      data: {},
    };
  };

  it('ignores forged legacy identity and leaves authorization to nginx', async () => {
    const ctx = createMockContext({
      'Cf-Access-Authenticated-User-Email': 'admin@feuerwehr.at',
      'Cf-Access-Jwt-Assertion': 'fake-jwt-token',
    });
    const res = await onRequest(ctx);
    expect(res.status).toBe(200);
    expect(ctx.next).toHaveBeenCalled();
    expect(ctx.data.adminUser).toBeUndefined();
  });

  it('uses the normalized nginx proxy identity as the audit actor', async () => {
    const ctx = createMockContext({
      'X-Auth-Request-Email': ' ADMIN@Feuerwehr.at ',
    });
    const res = await onRequest(ctx);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Admin Page HTML');
    expect(ctx.next).toHaveBeenCalled();
    expect(ctx.data.adminUser).toBe('admin@feuerwehr.at');
  });
});
