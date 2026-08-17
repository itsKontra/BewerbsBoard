import type { Hono } from 'hono'
import type { SelfHostedAppEnvironment } from './app.js'
import type { SelfHostedDatabase } from './database.js'
import type { DataExportEnvelope } from '../shared/domain/data-management.js'

export function registerDataManagementRoutes(app: Hono<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  app.get('/api/admin/data/export', (context) => {
    const exportData = database.dataManagement.exportAll()
    const user = context.get('adminUser') ?? 'system'
    const totalEntities =
      exportData.data.appConfig.length +
      exportData.data.competitionClasses.length +
      exportData.data.fireBrigades.length +
      exportData.data.categoryTypes.length +
      exportData.data.evaluationTypes.length +
      exportData.data.groups.length +
      exportData.data.categoryEntries.length

    database.audit.record({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      user,
      action: 'DATA_EXPORT',
      details: {
        totalEntities,
        exportedAt: exportData.exportedAt,
      },
    })

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
    const filename = `bewerbsboard-export-${timestampStr}.json`

    return context.json(exportData, 200, {
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
  })

  app.post('/api/admin/data/import/preflight', async (context) => {
    const body = await context.req.json().catch(() => null) as DataExportEnvelope | null
    if (!body) {
      return context.json({ error: 'Ungültiger oder fehlender JSON Payload.', errors: ['Ungültiger JSON Payload'] }, 400)
    }

    const preflight = database.dataManagement.preflightImport(body)
    if (!preflight.isValid) {
      return context.json({
        isValid: false,
        error: 'Dateiformat ist ungültig.',
        errors: preflight.errors,
        summary: preflight.summary,
        totalEntities: preflight.totalEntities,
      }, 400)
    }

    return context.json(preflight)
  })

  app.post('/api/admin/data/import', async (context) => {
    const body = await context.req.json().catch(() => null) as DataExportEnvelope | null
    if (!body) {
      return context.json({ error: 'Ungültiger oder fehlender JSON Payload.' }, 400)
    }

    const user = context.get('adminUser') ?? 'system'
    try {
      const summary = database.dataManagement.importAll(body, user)
      return context.json({
        message: 'Daten erfolgreich importiert',
        summary: summary.summary,
        totalEntities: summary.totalEntities,
      })
    } catch (err: any) {
      return context.json({ error: err.message || 'Import fehlgeschlagen.' }, 400)
    }
  })
}
