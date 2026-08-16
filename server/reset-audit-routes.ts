import type { Hono } from 'hono'

import type { SelfHostedAppEnvironment } from './app.js'
import type { SelfHostedDatabase } from './database.js'

const RESET_CONFIRMATION = 'LÖSCHEN'

export function registerResetAndAuditRoutes(app: Hono<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  app.get('/api/admin/audit-logs', (context) => {
    const url = new URL(context.req.url)
    const page = atLeastOne(url.searchParams.get('page'), 1)
    const limit = Math.min(100, atLeastOne(url.searchParams.get('limit'), 20))
    const search = url.searchParams.get('search')?.trim() ?? ''
    const { logs, total } = database.audit.listPage(page, limit, search)
    return context.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) || 1 })
  })

  app.post('/api/admin/reset', async (context) => {
    const body = await context.req.json().catch(() => ({})) as { confirmationKeyword?: unknown }
    if (body.confirmationKeyword !== RESET_CONFIRMATION) {
      return context.json({ error: "Ungültiges Bestätigungswort. Es muss exakt 'LÖSCHEN' eingegeben werden." }, 400)
    }

    const timestamp = Date.now()
    const summary = database.transaction(() => {
      const counts = database.clearCompetitionAndRuntime(timestamp)
      database.audit.record({
        id: crypto.randomUUID(),
        timestamp,
        user: context.get('adminUser') ?? 'system',
        action: 'DATABASE_CLEAR',
        details: { summary: counts, clearedAt: new Date(timestamp).toISOString() },
      })
      return counts
    })
    return context.json({ message: 'Datenbank erfolgreich zurückgesetzt', summary })
  })
}

function atLeastOne(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
