import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'

import type { SelfHostedAppEnvironment } from './app.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LocalAuthConfig {
  username: string
  password: string
  /** HMAC-SHA256 secret used to sign session cookies. */
  secret: string
}

/**
 * Reads LOCAL_AUTH_USER, LOCAL_AUTH_PASSWORD, LOCAL_AUTH_SECRET from the
 * supplied env object (typically process.env).
 *
 * Returns null when LOCAL_AUTH_USER or LOCAL_AUTH_PASSWORD are absent,
 * meaning local auth is disabled and proxy-header auth is used instead.
 */
export function readLocalAuthConfig(
  env: NodeJS.ProcessEnv,
): LocalAuthConfig | null {
  const username = env.LOCAL_AUTH_USER?.trim()
  const password = env.LOCAL_AUTH_PASSWORD?.trim()

  if (!username || !password) {
    return null
  }

  // Fall back to a random secret per restart when none is supplied.
  const secret = env.LOCAL_AUTH_SECRET?.trim() || generateRandomSecret()

  return { username, password, secret }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'scoreboard_session'
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60 // 8 hours

interface SessionPayload {
  user: string
  exp: number
}

async function importKey(secret: string) {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function base64urlEncode(buffer: ArrayBuffer): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64')
}

/**
 * Creates a signed session token: `<base64url(payload)>.<base64url(hmac)>`
 */
export async function signSession(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const key = await importKey(secret)
  const encoder = new TextEncoder()
  const payloadEncoded = base64urlEncode(encoder.encode(JSON.stringify(payload)).buffer as ArrayBuffer)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadEncoded))
  return `${payloadEncoded}.${base64urlEncode(signature)}`
}

/**
 * Verifies the token and returns the payload, or null if invalid/expired.
 */
export async function verifySession(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const payloadPart = token.slice(0, dotIndex)
  const sigPart = token.slice(dotIndex + 1)

  try {
    const key = await importKey(secret)
    const encoder = new TextEncoder()
    const sigBuffer = new Uint8Array(base64urlDecode(sigPart))
    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, encoder.encode(payloadPart))
    if (!valid) return null

    const payloadJson = base64urlDecode(payloadPart).toString('utf8')
    const payload = JSON.parse(payloadJson) as SessionPayload

    if (typeof payload.user !== 'string' || typeof payload.exp !== 'number') {
      return null
    }
    if (Date.now() > payload.exp) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const eq = part.indexOf('=')
      if (eq === -1) return [part.trim(), '']
      return [part.slice(0, eq).trim(), part.slice(eq + 1).trim()]
    }),
  )
}

function buildSetCookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

function buildClearCookieHeader(name: string): string {
  return `${name}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`
}

function generateRandomSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('hex')
}

// ---------------------------------------------------------------------------
// Middleware — protects /admin and /api/admin/* routes
// ---------------------------------------------------------------------------

/**
 * Returns a Hono middleware that requires a valid local-auth session cookie.
 * On missing/invalid cookies it responds with 401 + X-Auth-Mode: local.
 * On valid cookies it sets the `adminUser` context variable.
 */
export function createLocalAuthMiddleware(
  config: LocalAuthConfig,
): MiddlewareHandler<SelfHostedAppEnvironment> {
  return async (context: Context<SelfHostedAppEnvironment>, next) => {
    const cookies = parseCookies(context.req.header('cookie') ?? null)
    const token = cookies[COOKIE_NAME]

    if (!token) {
      return context.json(
        { error: 'Unauthorized' },
        401,
        { 'X-Auth-Mode': 'local' },
      )
    }

    const payload = await verifySession(token, config.secret)
    if (!payload) {
      return context.json(
        { error: 'Unauthorized' },
        401,
        { 'X-Auth-Mode': 'local' },
      )
    }

    context.set('adminUser', payload.user)
    await next()
  }
}

// ---------------------------------------------------------------------------
// Routes — /local-auth/login and /local-auth/logout
// ---------------------------------------------------------------------------

/**
 * Registers POST /local-auth/login and POST /local-auth/logout on `app`.
 */
export function registerLocalAuthRoutes(
  app: Hono<SelfHostedAppEnvironment>,
  config: LocalAuthConfig,
): void {
  app.post('/local-auth/login', async (context) => {
    let username: string | undefined
    let password: string | undefined

    const contentType = context.req.header('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = await context.req.json().catch(() => ({})) as Record<string, unknown>
      username = typeof body.username === 'string' ? body.username : undefined
      password = typeof body.password === 'string' ? body.password : undefined
    } else {
      const body = await context.req.parseBody().catch(() => ({}) as Record<string, unknown>)
      const bodyRecord = body as Record<string, unknown>
      username = typeof bodyRecord.username === 'string' ? bodyRecord.username : undefined
      password = typeof bodyRecord.password === 'string' ? bodyRecord.password : undefined
    }

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username !== config.username ||
      password !== config.password
    ) {
      return context.json({ error: 'Invalid credentials' }, 401, { 'X-Auth-Mode': 'local' })
    }

    const payload: SessionPayload = {
      user: config.username,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }
    const token = await signSession(payload, config.secret)

    return context.json(
      { user: config.username },
      200,
      { 'Set-Cookie': buildSetCookieHeader(COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS) },
    )
  })

  app.post('/local-auth/logout', (context) => {
    return context.json(
      { ok: true },
      200,
      { 'Set-Cookie': buildClearCookieHeader(COOKIE_NAME) },
    )
  })
}
