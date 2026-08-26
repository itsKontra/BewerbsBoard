import type { Hono } from 'hono'
import type { SelfHostedDatabase } from './database.js'
import type { SelfHostedAppEnvironment } from './app.js'
import { getServerNetworkInfo } from './network-info.js'

const TV_MODES = ['ROTATION', 'FIXED', 'MESSAGE', 'WINNERS'] as const

export function registerConfigurationAndTvRoutes(app: Hono<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  app.get('/api/admin/config', (context) => context.json(configurationPayload(database, context.req.header('host'))))
  app.put('/api/admin/config', async (context) => {
    const body = await context.req.json() as Record<string, unknown>
    const current = database.configuration.read()
    const configuration = {
      eventName: stringValue(body.eventTitle ?? body['event:name'], current.eventName),
      publicUrl: stringValue(body.publicUrl ?? body['public:url'], current.publicUrl),
      rankingPageDurationMs: numberValue(body.rankingPageDurationMs, current.rankingPageDurationMs),
      tvAnnouncement: (body.tvAnnouncement ?? body['tv:announcement'] ?? current.tvAnnouncement) as typeof current.tvAnnouncement,
      tvPresentation: (body.tvPresentation ?? body['tv:presentation'] ?? current.tvPresentation) as typeof current.tvPresentation,
    }
    const actor = context.get('adminUser') ?? 'system'
    database.transaction(() => {
      database.configuration.save(configuration)
      database.audit.record({ id: crypto.randomUUID(), timestamp: Date.now(), user: actor, action: 'UPDATE', details: { entity: 'CONFIG' } })
    })
    return context.json(configurationPayload(database))
  })
  app.get('/api/public/logo', (context) => {
    const logo = database.configuration.readCustomLogo()
    if (!logo) {
      return context.text('Not Found', 404)
    }
    const buffer = Buffer.from(logo.base64Data, 'base64')
    return context.body(buffer, 200, {
      'Content-Type': logo.mimeType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    })
  })
  app.delete('/api/admin/logo', (context) => {
    const actor = context.get('adminUser') ?? 'system'
    database.transaction(() => {
      database.configuration.deleteCustomLogo()
      const current = database.configuration.read()
      if (current.tvPresentation.logoOverride.startsWith('/api/public/logo')) {
        database.configuration.save({
          ...current,
          tvPresentation: {
            ...current.tvPresentation,
            logoOverride: '',
          },
        })
      }
      database.audit.record({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        user: actor,
        action: 'DELETE',
        details: { entity: 'CUSTOM_LOGO' },
      })
    })
    return context.json({ success: true })
  })
  app.get('/api/admin/tv-state', (context) => context.json(database.getTvRuntimeState()))
  app.put('/api/admin/tv-state', async (context) => {
    const body = await context.req.json() as Record<string, unknown>
    const mode = typeof body.mode === 'string' ? body.mode : ''
    if (!TV_MODES.includes(mode as typeof TV_MODES[number])) return context.json({ error: `Invalid mode. Must be one of: ${TV_MODES.join(', ')}` }, 400)
    const selectedCategoryId = typeof body.selectedCategoryId === 'string' ? body.selectedCategoryId : null
    if ((mode === 'FIXED' || mode === 'WINNERS') && !selectedCategoryId) return context.json({ error: `selectedCategoryId is required for ${mode} mode` }, 400)
    const state = database.transaction(() => {
      const previousState = database.getTvRuntimeState()
      const next = database.setTvRuntimeState({ mode, selectedCategoryId, updatedAt: Date.now() })
      database.audit.record({ id: crypto.randomUUID(), timestamp: Date.now(), user: context.get('adminUser') ?? 'system', action: 'UPDATE', details: { entity: 'TV_RUNTIME_STATE', entityId: 'default', previousValue: previousState, newValue: next } })
      return next
    })
    return context.json(state)
  })
  app.get('/api/public/tv-state', (context) => {
    const configuration = database.configuration.read()
    const state = database.getTvRuntimeState()
    const evaluationTypes = database.catalog.listEvaluationTypes()
    const categoriesConfig = Object.fromEntries(evaluationTypes.map((et) => [et.id, {
      name: et.name,
      publicEnabled: et.public,
      tvEnabled: et.publicTv,
      order: et.order,
      displayDuration: et.displayDurationSeconds,
    }]))
    return context.json({
      mode: state?.mode,
      selectedCategoryId: state?.selectedCategoryId,
      updatedAt: state?.updatedAt,
      tvAnnouncement: configuration.tvAnnouncement,
      categoriesConfig,
      eventTitle: configuration.eventName,
      rankingPageDurationMs: configuration.rankingPageDurationMs,
      serverInfo: getServerNetworkInfo({ requestHost: context.req.header('host') }),
      tvPresentation: {
        theme: configuration.tvPresentation.theme,
        logoUrl: configuration.tvPresentation.logoOverride || '/logo.png',
        headerLabel: configuration.tvPresentation.headerLabel,
        qrCodeEnabled: configuration.tvPresentation.qrCodeEnabled,
        qrCodeAlwaysVisible: configuration.tvPresentation.qrCodeAlwaysVisible,
        qrCodeIntervalSeconds: configuration.tvPresentation.qrCodeIntervalSeconds,
        qrCodeDurationSeconds: configuration.tvPresentation.qrCodeDurationSeconds,
        adminSplashEnabled: configuration.tvPresentation.adminSplashEnabled,
      },
    })
  })
}

function stringValue(value: unknown, fallback: string): string { return typeof value === 'string' ? value : fallback }
function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 300_000 ? value : fallback }
function configurationPayload(database: SelfHostedDatabase, requestHost?: string) {
  const configuration = database.configuration.read()
  return {
    eventTitle: configuration.eventName,
    publicUrl: configuration.publicUrl,
    rankingPageDurationMs: configuration.rankingPageDurationMs,
    tvAnnouncement: configuration.tvAnnouncement,
    tvPresentation: configuration.tvPresentation,
    serverInfo: getServerNetworkInfo({ requestHost }),
  }
}
