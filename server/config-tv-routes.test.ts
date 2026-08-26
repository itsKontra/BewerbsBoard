import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'

describe('self-hosted configuration and TV routes', () => {
  it('persists admin configuration and exposes it to the public TV state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-config-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
      const update = await app.request('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }, body: JSON.stringify({ eventTitle: 'Landesbewerb', publicUrl: 'https://live.example', rankingPageDurationMs: 12_000, tvAnnouncement: { headline: 'Willkommen', message: 'Start' }, tvPresentation: { theme: 'ceremony', logoOverride: '/logo.svg', headerLabel: 'Live', qrCodeEnabled: false, qrCodeAlwaysVisible: true, qrCodeIntervalSeconds: 45, qrCodeDurationSeconds: 12 }, categories: { 'bronze-aktiv': { name: 'Bronze A', publicEnabled: false, tvEnabled: true, displayDuration: 20, order: 1 } } }) })
      expect(update.status).toBe(200)
      expect(await update.json()).toMatchObject({ eventTitle: 'Landesbewerb', publicUrl: 'https://live.example' })
      const publicState = await app.request('/api/public/tv-state')
      expect(publicState.status).toBe(200)
      expect(await publicState.json()).toMatchObject({ eventTitle: 'Landesbewerb', rankingPageDurationMs: 12_000, tvAnnouncement: { headline: 'Willkommen', message: 'Start' }, tvPresentation: { theme: 'ceremony', logoUrl: '/logo.svg', headerLabel: 'Live', qrCodeEnabled: false, qrCodeAlwaysVisible: true, qrCodeIntervalSeconds: 45, qrCodeDurationSeconds: 12 } })
      expect(database.audit.list()).toHaveLength(1)
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })

  it('validates and publishes TV runtime state changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-config-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
      const invalid = await app.request('/api/admin/tv-state', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }, body: JSON.stringify({ mode: 'FIXED' }) })
      expect(invalid.status).toBe(400)
      const update = await app.request('/api/admin/tv-state', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }, body: JSON.stringify({ mode: 'FIXED', selectedCategoryId: 'bronze-aktiv' }) })
      expect(update.status).toBe(200)
      expect(await update.json()).toMatchObject({ mode: 'FIXED', selectedCategoryId: 'bronze-aktiv' })
      expect(await (await app.request('/api/public/tv-state')).json()).toMatchObject({ mode: 'FIXED', selectedCategoryId: 'bronze-aktiv' })
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })

  it('uses Evaluation Type settings for the public TV state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-config-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      database.catalog.createCategoryType({ id: 'custom-discipline', name: 'Custom Discipline', competitionClassId: 'cc-aktiv', hasRelayRace: false })
      database.catalog.createEvaluationType({ id: 'custom-evaluation', name: 'Custom Evaluation', categoryTypeId1: 'custom-discipline', excludeRelayRace: false, public: true, publicTv: true })
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
      const publicState = await app.request('/api/public/tv-state')

      expect((await publicState.json()).categoriesConfig['custom-evaluation']).toMatchObject({
        name: 'Custom Evaluation', publicEnabled: true, tvEnabled: true, displayDuration: 10,
      })
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })

  it('serves and deletes stored custom logo via /api/public/logo and /api/admin/logo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-logo-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })

      // Initially 404 when no custom logo
      const initial = await app.request('/api/public/logo')
      expect(initial.status).toBe(404)

      // Store a custom logo in SQLite
      const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      database.configuration.saveCustomLogo({
        mimeType: 'image/png',
        base64Data: samplePngBase64,
        updatedAt: 1700000000000,
      })

      // Set logoOverride to custom logo
      const current = database.configuration.read()
      database.configuration.save({
        ...current,
        tvPresentation: { ...current.tvPresentation, logoOverride: '/api/public/logo?v=1700000000000' },
      })

      // GET /api/public/logo
      const response = await app.request('/api/public/logo')
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/png')
      expect(response.headers.get('Cache-Control')).toContain('public')
      const buffer = await response.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(0)

      // DELETE /api/admin/logo
      const deleteRes = await app.request('/api/admin/logo', {
        method: 'DELETE',
        headers: { 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
      })
      expect(deleteRes.status).toBe(200)
      expect(await deleteRes.json()).toEqual({ success: true })

      // Verify custom logo deleted
      expect(database.configuration.readCustomLogo()).toBeNull()
      expect(database.configuration.read().tvPresentation.logoOverride).toBe('')
      const deletedCheck = await app.request('/api/public/logo')
      expect(deletedCheck.status).toBe(404)
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })
})
