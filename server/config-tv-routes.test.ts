import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
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

  it('handles logo upload with validation, sanitization, and persistence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-upload-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })

      // 1. Upload valid PNG via multipart form data
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
      const formData = new FormData()
      formData.append('file', new File([pngBytes], 'logo.png', { type: 'image/png' }))

      const uploadRes = await app.request('/api/admin/logo/upload', {
        method: 'POST',
        headers: { 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
        body: formData,
      })
      expect(uploadRes.status).toBe(200)
      const uploadJson = await uploadRes.json() as any
      expect(uploadJson.success).toBe(true)
      expect(uploadJson.logoUrl).toMatch(/^\/api\/public\/logo\?v=\d+$/)

      // Verify custom logo is in database
      const stored = database.configuration.readCustomLogo()
      expect(stored).not.toBeNull()
      expect(stored?.mimeType).toBe('image/png')
      expect(database.configuration.read().tvPresentation.logoOverride).toBe(uploadJson.logoUrl)

      // 2. Upload SVG with malicious tags and verify sanitization
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle cx="5" cy="5" r="5"/></svg>'
      const svgFormData = new FormData()
      svgFormData.append('file', new File([maliciousSvg], 'logo.svg', { type: 'image/svg+xml' }))

      const svgRes = await app.request('/api/admin/logo/upload', {
        method: 'POST',
        headers: { 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
        body: svgFormData,
      })
      expect(svgRes.status).toBe(200)
      const svgStored = database.configuration.readCustomLogo()
      expect(svgStored?.mimeType).toBe('image/svg+xml')
      const decodedSvg = Buffer.from(svgStored!.base64Data, 'base64').toString('utf-8')
      expect(decodedSvg).not.toContain('onload')
      expect(decodedSvg).not.toContain('<script')
      expect(decodedSvg).toContain('<circle')

      // 3. Reject invalid format
      const invalidFormData = new FormData()
      invalidFormData.append('file', new File(['not an image'], 'bad.txt', { type: 'text/plain' }))
      const invalidRes = await app.request('/api/admin/logo/upload', {
        method: 'POST',
        headers: { 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
        body: invalidFormData,
      })
      expect(invalidRes.status).toBe(400)
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })

  it('handles remote logo URL fetch and caching', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-fetch-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })

      // Mock global fetch for remote image
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(pngBytes.buffer),
      } as any)

      const fetchRes = await app.request('/api/admin/logo/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
        body: JSON.stringify({ url: 'https://cdn.feuerwehr.at/remote-logo.png' }),
      })
      expect(fetchRes.status).toBe(200)
      const fetchJson = await fetchRes.json() as any
      expect(fetchJson.success).toBe(true)
      expect(fetchJson.logoUrl).toMatch(/^\/api\/public\/logo\?v=\d+$/)

      const stored = database.configuration.readCustomLogo()
      expect(stored?.mimeType).toBe('image/png')
      fetchSpy.mockRestore()

      // Reject bad URL
      const badUrlRes = await app.request('/api/admin/logo/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' },
        body: JSON.stringify({ url: 'ftp://invalid.com/logo.png' }),
      })
      expect(badUrlRes.status).toBe(400)
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })

  it('exposes preset logo paths and custom logo endpoints in public tv-state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-tv-state-logo-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    try {
      const app = createSelfHostedApp({ publicDirectory: 'not-used', database })

      // 1. Preset logo
      database.configuration.save({
        ...database.configuration.read(),
        tvPresentation: {
          ...database.configuration.read().tvPresentation,
          logoOverride: '/logo-options/logo_alt_3.png',
        },
      })
      let tvStateRes = await app.request('/api/public/tv-state')
      expect(tvStateRes.status).toBe(200)
      let stateJson = await tvStateRes.json() as any
      expect(stateJson.tvPresentation.logoUrl).toBe('/logo-options/logo_alt_3.png')

      // 2. Custom logo
      database.configuration.save({
        ...database.configuration.read(),
        tvPresentation: {
          ...database.configuration.read().tvPresentation,
          logoOverride: '/api/public/logo?v=1740000000000',
        },
      })
      tvStateRes = await app.request('/api/public/tv-state')
      expect(tvStateRes.status).toBe(200)
      stateJson = await tvStateRes.json() as any
      expect(stateJson.tvPresentation.logoUrl).toBe('/api/public/logo?v=1740000000000')
    } finally { database.close(); await rm(directory, { recursive: true, force: true }) }
  })
})
