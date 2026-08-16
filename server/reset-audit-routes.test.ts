import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'

describe('self-hosted reset and audit routes', () => {
  it('clears competition and runtime data, preserves configuration, and records the reset for audit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-reset-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))

    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
      const adminHeaders = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }

      await app.request('/api/admin/config', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({
        eventTitle: 'Landesbewerb 2026',
        publicUrl: 'https://live.feuerwehr.at',
        tvAnnouncement: { headline: 'Willkommen', message: 'Start um 09:00 Uhr' },
        tvPresentation: { theme: 'ceremony', logoOverride: '/event-logo.svg', headerLabel: 'Landesbewerb Live' },
      }) })
      // Seed catalog required for group and entry FK resolution
      const { sql } = await import('drizzle-orm')
      database.drizzle.run(sql`INSERT OR IGNORE INTO competition_classes (id, name) VALUES ('cc-aktiv', 'AKTIV')`)
      database.drizzle.run(sql`INSERT OR IGNORE INTO category_types (id, name, competition_class_id, has_relay_race) VALUES ('ct-bronze-aktiv', 'bronze-aktiv', 'cc-aktiv', 0)`)
      const brigade = await app.request('/api/admin/brigades', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ name: 'FF Beispiel' }) })
      const { id: brigadeId } = await brigade.json() as { id: string }
      const group = await app.request('/api/admin/groups', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ fireBrigadeId: brigadeId, name: 'Gruppe 1', competitionClassId: 'cc-aktiv' }) })
      const { id: groupId } = await group.json() as { id: string }
      await app.request('/api/admin/category-entries', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ groupId, categoryTypeId: 'ct-bronze-aktiv' }) })
      await app.request('/api/admin/tv-state', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ mode: 'FIXED', selectedCategoryId: 'bronze-aktiv' }) })

      const reset = await app.request('/api/admin/reset', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ confirmationKeyword: 'LÖSCHEN' }) })

      expect(reset.status).toBe(200)
      await expect(reset.json()).resolves.toEqual({
        message: 'Datenbank erfolgreich zurückgesetzt',
        summary: { fireBrigadesCount: 1, groupsCount: 1, categoryEntriesCount: 1 },
      })
      await expect((await app.request('/api/admin/brigades', { headers: adminHeaders })).json()).resolves.toEqual([])
      await expect((await app.request('/api/admin/groups', { headers: adminHeaders })).json()).resolves.toEqual([])
      await expect((await app.request('/api/admin/category-entries', { headers: adminHeaders })).json()).resolves.toEqual([])
      await expect((await app.request('/api/admin/tv-state', { headers: adminHeaders })).json()).resolves.toMatchObject({ mode: 'ROTATION', selectedCategoryId: null })
      await expect((await app.request('/api/admin/config', { headers: adminHeaders })).json()).resolves.toMatchObject({
        eventTitle: 'Landesbewerb 2026',
        publicUrl: 'https://live.feuerwehr.at',
        tvAnnouncement: { headline: 'Willkommen', message: 'Start um 09:00 Uhr' },
        tvPresentation: { theme: 'ceremony', logoOverride: '/event-logo.svg', headerLabel: 'Landesbewerb Live' },
      })

      const audit = await app.request('/api/admin/audit-logs?page=1&limit=20&search=DATABASE_CLEAR', { headers: adminHeaders })
      expect(audit.status).toBe(200)
      const auditPayload = await audit.clone().json() as { logs: Array<{ action: string, details: string | null }>, total: number }
      await expect(audit.json()).resolves.toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        logs: [{ user: 'admin@feuerwehr.at', action: 'DATABASE_CLEAR', details: expect.any(String) }],
      })
      expect(JSON.parse(auditPayload.logs[0]!.details!)).toMatchObject({ summary: { fireBrigadesCount: 1, groupsCount: 1, categoryEntriesCount: 1 } })

      const fullAudit = await app.request('/api/admin/audit-logs?page=1&limit=20', { headers: adminHeaders })
      const fullAuditPayload = await fullAudit.json() as { logs: Array<{ action: string }>, total: number }
      expect(fullAuditPayload.total).toBe(6)
      expect(fullAuditPayload.logs.map((log) => log.action)).toEqual(expect.arrayContaining([
        'UPDATE', 'CREATE_BRIGADE', 'CREATE_GROUP', 'CREATE_CATEGORY_ENTRY', 'DATABASE_CLEAR',
      ]))
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('records every repeated reset and preserves the reset API validation contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-reset-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))

    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
      const adminHeaders = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
      const invalid = await app.request('/api/admin/reset', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ confirmationKeyword: 'delete' }) })
      expect(invalid.status).toBe(400)
      await expect(invalid.json()).resolves.toEqual({ error: "Ungültiges Bestätigungswort. Es muss exakt 'LÖSCHEN' eingegeben werden." })

      for (let index = 0; index < 2; index += 1) {
        const reset = await app.request('/api/admin/reset', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ confirmationKeyword: 'LÖSCHEN' }) })
        expect(reset.status).toBe(200)
        await expect(reset.json()).resolves.toMatchObject({ summary: { fireBrigadesCount: 0, groupsCount: 0, categoryEntriesCount: 0 } })
      }

      const audit = await app.request('/api/admin/audit-logs?page=1&limit=1&search=DATABASE_CLEAR', { headers: adminHeaders })
      await expect(audit.json()).resolves.toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2, logs: [{ action: 'DATABASE_CLEAR', user: 'admin@feuerwehr.at' }] })
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
