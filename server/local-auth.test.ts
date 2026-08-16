import { describe, expect, it } from 'vitest'

import {
  readLocalAuthConfig,
  signSession,
  verifySession,
} from './local-auth.js'
import { createSelfHostedApp } from './app.js'

// ---------------------------------------------------------------------------
// Config parsing
// ---------------------------------------------------------------------------

describe('readLocalAuthConfig', () => {
  it('returns null when LOCAL_AUTH_USER is absent', () => {
    expect(readLocalAuthConfig({ LOCAL_AUTH_PASSWORD: 'secret' })).toBeNull()
  })

  it('returns null when LOCAL_AUTH_PASSWORD is absent', () => {
    expect(readLocalAuthConfig({ LOCAL_AUTH_USER: 'admin' })).toBeNull()
  })

  it('returns null when both vars are absent', () => {
    expect(readLocalAuthConfig({})).toBeNull()
  })

  it('returns null when LOCAL_AUTH_USER is blank', () => {
    expect(readLocalAuthConfig({ LOCAL_AUTH_USER: '  ', LOCAL_AUTH_PASSWORD: 'secret' })).toBeNull()
  })

  it('returns null when LOCAL_AUTH_PASSWORD is blank', () => {
    expect(readLocalAuthConfig({ LOCAL_AUTH_USER: 'admin', LOCAL_AUTH_PASSWORD: '' })).toBeNull()
  })

  it('returns config with trimmed values when both vars are set', () => {
    const config = readLocalAuthConfig({ LOCAL_AUTH_USER: ' admin ', LOCAL_AUTH_PASSWORD: ' s3cr3t ' })
    expect(config).not.toBeNull()
    expect(config!.username).toBe('admin')
    expect(config!.password).toBe('s3cr3t')
  })

  it('uses supplied LOCAL_AUTH_SECRET', () => {
    const config = readLocalAuthConfig({
      LOCAL_AUTH_USER: 'admin',
      LOCAL_AUTH_PASSWORD: 'pass',
      LOCAL_AUTH_SECRET: 'mysecret',
    })
    expect(config!.secret).toBe('mysecret')
  })

  it('generates a random secret when LOCAL_AUTH_SECRET is absent', () => {
    const a = readLocalAuthConfig({ LOCAL_AUTH_USER: 'a', LOCAL_AUTH_PASSWORD: 'b' })
    const b = readLocalAuthConfig({ LOCAL_AUTH_USER: 'a', LOCAL_AUTH_PASSWORD: 'b' })
    // Two calls should produce different auto-generated secrets
    expect(a!.secret).toBeTruthy()
    expect(b!.secret).toBeTruthy()
    expect(a!.secret).not.toBe(b!.secret)
  })

  it('generates a random secret when LOCAL_AUTH_SECRET is blank', () => {
    const config = readLocalAuthConfig({ LOCAL_AUTH_USER: 'a', LOCAL_AUTH_PASSWORD: 'b', LOCAL_AUTH_SECRET: '  ' })
    expect(config!.secret).toBeTruthy()
    expect(config!.secret.trim()).not.toBe('')
  })
})

// ---------------------------------------------------------------------------
// Cookie sign / verify
// ---------------------------------------------------------------------------

describe('signSession / verifySession', () => {
  const secret = 'test-secret'

  it('round-trips a valid payload', async () => {
    const payload = { user: 'alice', exp: Date.now() + 60_000 }
    const token = await signSession(payload, secret)
    const result = await verifySession(token, secret)
    expect(result).not.toBeNull()
    expect(result!.user).toBe('alice')
  })

  it('returns null for a tampered token', async () => {
    const payload = { user: 'alice', exp: Date.now() + 60_000 }
    const token = await signSession(payload, secret)
    // Corrupt the signature
    const parts = token.split('.')
    const tamperedToken = `${parts[0]}.INVALIDSIGNATURE`
    expect(await verifySession(tamperedToken, secret)).toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const payload = { user: 'alice', exp: Date.now() + 60_000 }
    const token = await signSession(payload, 'secret-A')
    expect(await verifySession(token, 'secret-B')).toBeNull()
  })

  it('returns null for an expired token', async () => {
    const payload = { user: 'alice', exp: Date.now() - 1 }
    const token = await signSession(payload, secret)
    expect(await verifySession(token, secret)).toBeNull()
  })

  it('returns null for garbage input', async () => {
    expect(await verifySession('', secret)).toBeNull()
    expect(await verifySession('not.a.real.token', secret)).toBeNull()
    expect(await verifySession('nodot', secret)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Login route
// ---------------------------------------------------------------------------

function makeApp(username = 'admin', password = 'secret') {
  return createSelfHostedApp({
    publicDirectory: 'not-used',
    localAuth: { username, password, secret: 'test-secret-for-tests' },
  })
}

describe('POST /local-auth/login', () => {
  it('returns 200 and sets a session cookie on valid credentials', async () => {
    const app = makeApp()
    const res = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { user: string }
    expect(data.user).toBe('admin')
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('scoreboard_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('returns 401 on wrong password', async () => {
    const app = makeApp()
    const res = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('X-Auth-Mode')).toBe('local')
  })

  it('returns 401 on wrong username', async () => {
    const app = makeApp()
    const res = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', password: 'secret' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 on empty body', async () => {
    const app = makeApp()
    const res = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })

  it('accepts form-encoded body', async () => {
    const app = makeApp()
    const form = new URLSearchParams({ username: 'admin', password: 'secret' })
    const res = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Logout route
// ---------------------------------------------------------------------------

describe('POST /local-auth/logout', () => {
  it('clears the session cookie', async () => {
    const app = makeApp()
    const res = await app.request('/local-auth/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('Max-Age=0')
  })
})

// ---------------------------------------------------------------------------
// Middleware — protected routes
// ---------------------------------------------------------------------------

describe('local auth middleware on protected routes', () => {
  it('blocks /api/admin/me without a cookie (401 + X-Auth-Mode: local)', async () => {
    const app = makeApp()
    const res = await app.request('/api/admin/me')
    expect(res.status).toBe(401)
    expect(res.headers.get('X-Auth-Mode')).toBe('local')
  })

  // The HTML routes /admin and /admin/* intentionally bypass the middleware so
  // the SPA can load in the browser and render the login form client-side.
  // Blocking them server-side would return raw JSON 401, not the SPA.
  it('does NOT block GET /admin (SPA must load to render the login form)', async () => {
    const app = makeApp()
    // The public directory doesn't exist in tests, so the app returns 404 for the
    // static file — but crucially it must NOT return 401.
    const res = await app.request('/admin')
    expect(res.status).not.toBe(401)
  })

  it('does NOT block GET /admin/settings (SPA passthrough)', async () => {
    const app = makeApp()
    const res = await app.request('/admin/settings')
    expect(res.status).not.toBe(401)
  })

  it('allows /api/admin/me with a valid session cookie and returns the username', async () => {
    const app = makeApp()

    // First: log in to obtain a cookie
    const loginRes = await app.request('/local-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'secret' }),
    })
    expect(loginRes.status).toBe(200)

    const rawCookie = loginRes.headers.get('set-cookie') ?? ''
    // Extract just `name=value` portion
    const cookie = rawCookie.split(';')[0]

    // Then: hit the protected endpoint with the cookie
    const meRes = await app.request('/api/admin/me', {
      headers: { cookie },
    })
    expect(meRes.status).toBe(200)
    const data = await meRes.json() as { user: string }
    expect(data.user).toBe('admin')
  })

  it('blocks with a forged / tampered cookie', async () => {
    const app = makeApp()
    const res = await app.request('/api/admin/me', {
      headers: { cookie: 'scoreboard_session=forged.invalidsig' },
    })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Proxy-header mode still works when localAuth is absent
// ---------------------------------------------------------------------------

describe('proxy-header auth (no localAuth config)', () => {
  it('allows access and reads X-Auth-Request-Preferred-Username when localAuth is not set and admin role is present', async () => {
    const app = createSelfHostedApp({ publicDirectory: 'not-used' })
    const res = await app.request('/api/admin/me', {
      headers: {
        'X-Auth-Request-Preferred-Username': 'proxy.user',
        'X-Auth-Request-Roles': 'admin',
      },
    })
    expect(res.status).toBe(200)
    const data = await res.json() as { user: string }
    expect(data.user).toBe('proxy.user')
  })

  it('rejects proxy request with 403 Forbidden when admin role is missing', async () => {
    const app = createSelfHostedApp({ publicDirectory: 'not-used' })
    const res = await app.request('/api/admin/me', {
      headers: {
        'X-Auth-Request-Preferred-Username': 'proxy.user',
        'X-Auth-Request-Roles': 'viewer',
      },
    })
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden: admin role required' })
  })
})
