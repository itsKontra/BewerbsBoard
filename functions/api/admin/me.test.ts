import { describe, it, expect } from 'vitest';
import { onRequestGet } from './me';

describe('Me API Endpoint (/api/admin/me)', () => {
  it('returns the adminUser set by middleware', async () => {
    const context = {
      request: new Request('https://example.com/api/admin/me'),
      env: {},
      data: { adminUser: 'user@example.com' },
      params: {},
    } as any;

    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      user: 'user@example.com',
      authMode: 'proxy',
      logoutUrl: '/oauth2/sign_out?rd=/admin',
    });
  });

  it('falls back to admin@feuerwehr.at when adminUser is not present', async () => {
    const context = {
      request: new Request('https://example.com/api/admin/me'),
      env: {},
      data: {},
      params: {},
    } as any;

    const response = await onRequestGet(context);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      user: 'admin@feuerwehr.at',
      authMode: 'proxy',
      logoutUrl: '/oauth2/sign_out?rd=/admin',
    });
  });
});
