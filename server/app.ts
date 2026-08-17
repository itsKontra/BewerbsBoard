import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

import { Hono, type MiddlewareHandler } from 'hono'

import { hasAdminRole, proxyAuditActor } from './proxy-identity.js'
import type { SelfHostedDatabase } from './database.js'
import { registerBrigadeAndGroupRoutes } from './brigade-group-routes.js'
import { registerConfigurationAndTvRoutes } from './config-tv-routes.js'
import { registerScoringRoutes } from './scoring-routes.js'
import { registerResetAndAuditRoutes } from './reset-audit-routes.js'
import { registerDataManagementRoutes } from './data-management-routes.js'
import type { LocalAuthConfig } from './local-auth.js'
import { createLocalAuthMiddleware, registerLocalAuthRoutes } from './local-auth.js'

export { hasAdminRole, proxyAuditActor } from './proxy-identity.js'

export interface SelfHostedAppOptions {
  publicDirectory: string
  database?: SelfHostedDatabase
  /** When set, enables local username/password authentication instead of proxy-header auth. */
  localAuth?: LocalAuthConfig
}

export interface SelfHostedAppVariables {
  adminUser?: string
}

export interface SelfHostedAppEnvironment {
  Variables: SelfHostedAppVariables
}

export function createSelfHostedApp(options: SelfHostedAppOptions) {
  const app = new Hono<SelfHostedAppEnvironment>()
  const publicDirectory = resolve(options.publicDirectory)

  app.onError((error, context) => context.json({ error: error.message }, 500))

  if (options.localAuth) {
    // Local auth mode: only protect API routes with cookie-based middleware.
    // The HTML routes (/admin, /admin/*) must remain unguarded so the SPA
    // can load and render the login form for unauthenticated visitors.
    const localAuthMiddleware = createLocalAuthMiddleware(options.localAuth)
    registerLocalAuthRoutes(app, options.localAuth)
    app.use('/api/admin/*', localAuthMiddleware)
  } else {
    // Proxy-header mode: read identity from X-Auth-Request-* headers set by nginx/oauth2-proxy.
    // Enforce admin role check on /api/admin/* routes.
    app.use('/admin', captureProxyIdentity)
    app.use('/admin/*', captureProxyIdentity)
    app.use('/api/admin/*', requireProxyAdminAuth)
  }
  app.get('/healthz', (context) => context.json({ status: 'ok' }))
  app.get('/api/admin/me', (context) => context.json({
    user: context.get('adminUser') ?? 'admin@feuerwehr.at',
    authMode: options.localAuth ? 'local' : 'proxy',
    logoutUrl: options.localAuth ? '/local-auth/logout' : '/oauth2/sign_out?rd=/admin',
  }))
  if (options.database) {
    registerConfigurationAndTvRoutes(app, options.database)
    registerBrigadeAndGroupRoutes(app, options.database)
    registerScoringRoutes(app, options.database)
    registerResetAndAuditRoutes(app, options.database)
    registerDataManagementRoutes(app, options.database)
  }
  app.all('/api/*', (context) => context.json({ error: 'Not Found' }, 404))
  app.get('*', async (context, next) => {
    const requestedPath = decodeURIComponent(new URL(context.req.url).pathname)
    const filePath = resolve(publicDirectory, requestedPath.slice(1))
    const pathWithinPublicDirectory = relative(publicDirectory, filePath)

    if (pathWithinPublicDirectory.startsWith('..') || isAbsolute(pathWithinPublicDirectory)) {
      return context.notFound()
    }

    const content = await readPublicFile(filePath)
    if (content === null) {
      return next()
    }

    return context.body(content, 200, {
      'Content-Type': contentTypeFor(filePath),
    })
  })
  app.get('*', async (context) => {
    const indexPath = resolve(publicDirectory, 'index.html')
    const content = await readPublicFile(indexPath)

    if (content === null) {
      return context.notFound()
    }

    return context.body(content, 200, {
      'Content-Type': contentTypeFor(indexPath),
    })
  })

  return app
}

const captureProxyIdentity: MiddlewareHandler<SelfHostedAppEnvironment> = async (context, next) => {
  const email = proxyAuditActor(context.req.raw)
  if (email) {
    context.set('adminUser', email)
  }
  await next()
}

const requireProxyAdminAuth: MiddlewareHandler<SelfHostedAppEnvironment> = async (context, next) => {
  const email = proxyAuditActor(context.req.raw)
  if (!email) {
    return context.json({ error: 'Unauthorized' }, 401)
  }
  if (!hasAdminRole(context.req.raw)) {
    return context.json({ error: 'Forbidden: admin role required' }, 403)
  }
  context.set('adminUser', email)
  await next()
}

function contentTypeFor(filePath: string): string {
  const contentTypes: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }

  return contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

async function readPublicFile(filePath: string) {
  try {
    return await readFile(filePath)
  } catch (error) {
    if (isFileUnavailableError(error)) {
      return null
    }
    throw error
  }
}

function isFileUnavailableError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'EISDIR')
}
