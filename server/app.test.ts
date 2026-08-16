import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createSelfHostedApp, hasAdminRole, proxyAuditActor } from './app.js'

describe('self-hosted HTTP application', () => {
  it('reports healthy through the public health endpoint', async () => {
    const app = createSelfHostedApp({ publicDirectory: 'not-used' })

    const response = await app.request('/healthz')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('uses nginx-supplied email, preferred username, or user as the normalized audit actor', () => {
    expect(proxyAuditActor(new Request('http://scoreboard.test/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'forged@example.test',
      },
    }))).toBeNull()

    expect(proxyAuditActor(new Request('http://scoreboard.test/admin', {
      headers: {
        'X-Auth-Request-Email': ' ADMIN@Feuerwehr.at ',
        'Cf-Access-Authenticated-User-Email': 'forged@example.test',
      },
    }))).toBe('admin@feuerwehr.at')

    expect(proxyAuditActor(new Request('http://scoreboard.test/admin', {
      headers: {
        'X-Auth-Request-Preferred-Username': ' keycloak_admin ',
      },
    }))).toBe('keycloak_admin')

    expect(proxyAuditActor(new Request('http://scoreboard.test/admin', {
      headers: {
        'X-Auth-Request-User': ' keycloak_user ',
      },
    }))).toBe('keycloak_user')
  })

  it('correctly extracts and checks for user role admin from various proxy headers', () => {
    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Roles': 'admin' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Roles': 'user, admin' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Groups': '["user", "admin"]' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Forwarded-Groups': '/admin' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Roles': 'ROLE_ADMIN' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Groups': 'role:default-roles-homelab role:offline_access role:bewerb-oauth2-proxy:admin' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Roles': 'role:admin' },
    }))).toBe(true)

    expect(hasAdminRole(new Request('http://scoreboard.test', {
      headers: { 'X-Auth-Request-Roles': 'user, viewer' },
    }))).toBe(false)

    expect(hasAdminRole(new Request('http://scoreboard.test'))).toBe(false)
  })

  it('enforces admin role on /api/admin/me in proxy auth mode', async () => {
    const app = createSelfHostedApp({ publicDirectory: 'not-used' })

    // No identity header -> 401 Unauthorized
    const res1 = await app.request('/api/admin/me')
    expect(res1.status).toBe(401)
    await expect(res1.json()).resolves.toEqual({ error: 'Unauthorized' })

    // Identity header present but missing admin role -> 403 Forbidden
    const res2 = await app.request('/api/admin/me', {
      headers: {
        'X-Auth-Request-Preferred-Username': 'keycloak.user',
        'X-Auth-Request-Roles': 'user',
      },
    })
    expect(res2.status).toBe(403)
    await expect(res2.json()).resolves.toEqual({ error: 'Forbidden: admin role required' })

    // Identity header present with admin role -> 200 OK
    const res3 = await app.request('/api/admin/me', {
      headers: {
        'X-Auth-Request-Preferred-Username': 'keycloak.admin',
        'X-Auth-Request-Roles': 'admin',
      },
    })
    expect(res3.status).toBe(200)
    await expect(res3.json()).resolves.toEqual({
      user: 'keycloak.admin',
      authMode: 'proxy',
      logoutUrl: '/oauth2/sign_out?rd=/admin',
    })
  })

  it('returns a JSON error for an unknown API route', async () => {
    const app = createSelfHostedApp({ publicDirectory: 'not-used' })

    const response = await app.request('/api/public/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({ error: 'Not Found' })
  })

  it('serves a file from the built public application', async () => {
    const publicDirectory = await mkdtemp(join(tmpdir(), 'scoreboard-public-'))
    await writeFile(join(publicDirectory, 'app.js'), 'console.log("scoreboard")')

    try {
      const app = createSelfHostedApp({ publicDirectory })

      const response = await app.request('/app.js')

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/javascript')
      await expect(response.text()).resolves.toBe('console.log("scoreboard")')
    } finally {
      await rm(publicDirectory, { recursive: true, force: true })
    }
  })

  it('serves the SPA document for a browser navigation route', async () => {
    const publicDirectory = await mkdtemp(join(tmpdir(), 'scoreboard-public-'))
    await writeFile(join(publicDirectory, 'index.html'), '<main>Scoreboard</main>')

    try {
      const app = createSelfHostedApp({ publicDirectory })

      for (const [route, headers] of [
        ['/', undefined],
        ['/tv/results', undefined],
        ['/admin', undefined],
      ] as const) {
        const response = await app.request(route, { headers })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/html')
        await expect(response.text()).resolves.toBe('<main>Scoreboard</main>')
      }
    } finally {
      await rm(publicDirectory, { recursive: true, force: true })
    }
  })
})
