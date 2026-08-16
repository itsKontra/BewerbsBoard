import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'

/** Seeds the minimal catalog rows needed to register AKTIV groups and bronze-aktiv entries. */
function seedCatalog(database: ReturnType<typeof createDatabase>) {
  database.drizzle.run(sql`
    INSERT OR IGNORE INTO competition_classes (id, name) VALUES
      ('cc-aktiv', 'AKTIV'), ('cc-jugend', 'JUGEND'), ('cc-gast', 'GAST')
  `)
  database.drizzle.run(sql`
    INSERT OR IGNORE INTO category_types (id, name, competition_class_id, has_relay_race) VALUES
      ('ct-bronze-aktiv', 'bronze-aktiv', 'cc-aktiv', 0),
      ('ct-silber-aktiv', 'silber-aktiv', 'cc-aktiv', 1)
  `)
  database.drizzle.run(sql`
    INSERT OR IGNORE INTO evaluation_types (id, name, category_type_id_1, category_type_id_2, exclude_relay_race, public, public_tv) VALUES
      ('eval-bronze-aktiv', 'Test Bronze Aktiv', 'ct-bronze-aktiv', NULL, 0, 1, 1),
      ('eval-gesamt-aktiv', 'Test Gesamtwertung Aktiv', 'ct-bronze-aktiv', 'ct-silber-aktiv', 0, 1, 1)
  `)
}

describe('self-hosted scoring and public-results routes', () => {
  it('scores, compacts and ranks category entries while atomically auditing each mutation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-scoring-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    seedCatalog(database)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    const request = (path: string, init?: RequestInit) => app.request(path, init)

    try {
      const brigade = await (await request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }) })).json() as { id: string }
      const groups = await Promise.all(['1', '2'].map(async (name) => (await (await request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name, competitionClassId: 'cc-aktiv' }) })).json() as { id: string })))
      const entries = await Promise.all(groups.map(async (group) => (await (await request('/api/admin/category-entries', { method: 'POST', headers, body: JSON.stringify({ groupId: group.id, categoryTypeId: 'ct-bronze-aktiv' }) })).json() as { id: string })))

      const reordered = await request('/api/admin/category-entries/reorder', { method: 'POST', headers, body: JSON.stringify({ categoryTypeId: 'ct-bronze-aktiv', orderedIds: [entries[1].id, entries[0].id] }) })
      expect(reordered.status).toBe(200)

      const update = await request(`/api/admin/category-entries/${entries[0].id}`, { method: 'PUT', headers, body: JSON.stringify({ attackTimeStr: '42,38', errors: 1 }) })
      expect(update.status).toBe(200)
      // Score = 4238 hundredths + 1 error * 100 = 4338; returned as scoreHundredths in the entry object
      await expect(update.json()).resolves.toMatchObject({ entry: { runStatus: 'VALID', startOrderPosition: null, scoreHundredths: 4338 } })

      const invalidTime = await request(`/api/admin/category-entries/${entries[1].id}`, { method: 'PUT', headers, body: JSON.stringify({ attackTimeStr: 'nope' }) })
      expect(invalidTime.status).toBe(400)
      await expect(invalidTime.json()).resolves.toEqual({ error: 'Invalid German decimal time format. Example valid inputs: 42, 42,3, 42,38 (0.01 to 999.99)' })

      const listed = await request('/api/admin/category-entries', { headers })
      await expect(listed.json()).resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: entries[1].id, runStatus: 'OPEN', startOrderPosition: 1 }),
      ]))

      const results = await request('/api/public/results')
      expect(results.status).toBe(200)
      const resultsPayload = await results.json() as { categories: Record<string, { type: string, rankedResults: unknown[], openEntries: unknown[], dnfEntries: unknown[] }> }

      // Evaluation-type IDs are used as category keys now
      expect(Object.keys(resultsPayload.categories)).toContain('eval-bronze-aktiv')
      expect(Object.keys(resultsPayload.categories)).toContain('eval-gesamt-aktiv')
      expect(resultsPayload).toMatchObject({
        eventTitle: 'Feuerwehr Leistungsbewerb',
        categories: {
          'eval-bronze-aktiv': {
            rankedResults: [expect.objectContaining({ rank: 1, scoreHundredths: 4338 })],
            openEntries: [expect.objectContaining({ id: entries[1].id, startOrderPosition: 1 })],
          },
        },
      })
      expect(resultsPayload.categories['eval-gesamt-aktiv']).toMatchObject({ type: 'combined', rankedResults: [], openEntries: [], dnfEntries: [] })
      expect(database.audit.list().map((audit) => audit.action)).toEqual(['CREATE_BRIGADE', 'CREATE_GROUP', 'CREATE_GROUP', 'CREATE_CATEGORY_ENTRY', 'CREATE_CATEGORY_ENTRY', 'REORDER_CATEGORY_ENTRIES', 'UPDATE'])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('preserves category-entry validation and reorder contracts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-scoring-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    seedCatalog(database)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    try {
      const invalid = await app.request('/api/admin/category-entries', { method: 'POST', headers, body: JSON.stringify({}) })
      expect(invalid.status).toBe(400)
      await expect(invalid.json()).resolves.toEqual({ error: 'Missing groupId or categoryTypeId' })
      const legacyNameLookup = await app.request('/api/admin/category-entries', {
        method: 'POST', headers, body: JSON.stringify({ groupId: 'unused', categoryType: 'Bronze Aktiv' }),
      })
      expect(legacyNameLookup.status).toBe(400)
      await expect(legacyNameLookup.json()).resolves.toEqual({ error: 'Missing groupId or categoryTypeId' })
      const malformedTime = await app.request('/api/admin/category-entries/missing', { method: 'PUT', headers, body: JSON.stringify({ attackTimeStr: 'nope' }) })
      expect(malformedTime.status).toBe(404)
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects entries whose category type is assigned to another competition class', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-scoring-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    seedCatalog(database)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    try {
      const brigade = await (await app.request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }) })).json() as { id: string }
      const group = await (await app.request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: 'Jugend 1', competitionClassId: 'cc-jugend' }) })).json() as { id: string }

      const response = await app.request('/api/admin/category-entries', {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupId: group.id, categoryTypeId: 'ct-bronze-aktiv' }),
      })

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: "Incompatible category type 'bronze-aktiv' for group type 'JUGEND'" })
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('publishes a cross-class combined evaluation for groups from the same brigade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-combined-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    seedCatalog(database)
    database.drizzle.run(sql`
      INSERT INTO category_types (id, name, competition_class_id, has_relay_race)
      VALUES ('ct-bronze-jugend', 'bronze-jugend', 'cc-jugend', 0)
    `)
    database.drizzle.run(sql`
      INSERT INTO evaluation_types (id, name, category_type_id_1, category_type_id_2, exclude_relay_race, is_brigade_pairing, public, public_tv)
      VALUES ('eval-overall-brigade', 'Overall Brigade', 'ct-bronze-aktiv', 'ct-bronze-jugend', 0, 1, 1, 1)
    `)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    try {
      const brigade = await (await app.request('/api/admin/brigades', {
        method: 'POST', headers, body: JSON.stringify({ name: 'FF Combined' }),
      })).json() as { id: string }
      const activeGroup = await (await app.request('/api/admin/groups', {
        method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: 'Active 1', competitionClassId: 'cc-aktiv' }),
      })).json() as { id: string }
      const youthGroup = await (await app.request('/api/admin/groups', {
        method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: 'Youth 1', competitionClassId: 'cc-jugend' }),
      })).json() as { id: string }
      const activeEntry = await (await app.request('/api/admin/category-entries', {
        method: 'POST', headers, body: JSON.stringify({ groupId: activeGroup.id, categoryTypeId: 'ct-bronze-aktiv' }),
      })).json() as { id: string }
      const youthEntry = await (await app.request('/api/admin/category-entries', {
        method: 'POST', headers, body: JSON.stringify({ groupId: youthGroup.id, categoryTypeId: 'ct-bronze-jugend' }),
      })).json() as { id: string }
      await app.request(`/api/admin/category-entries/${activeEntry.id}`, {
        method: 'PUT', headers, body: JSON.stringify({ attackTimeStr: '43,00', errors: 2 }),
      })
      await app.request(`/api/admin/category-entries/${youthEntry.id}`, {
        method: 'PUT', headers, body: JSON.stringify({ attackTimeStr: '41,00', errors: 1 }),
      })

      const response = await app.request('/api/public/results')
      const data = await response.json() as any

      expect(data.categories['eval-overall-brigade']).toMatchObject({
        type: 'combined',
        rankedResults: [expect.objectContaining({
          rank: 1,
          fireBrigadeId: brigade.id,
          primaryRun: expect.objectContaining({
            entryId: activeEntry.id,
          }),
          secondaryRun: expect.objectContaining({
            entryId: youthEntry.id,
          }),
          scoreHundredths: 8700,
        })],
      })
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rolls back a scoring mutation when its audit write fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-scoring-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    seedCatalog(database)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    try {
      const brigade = await (await app.request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }) })).json() as { id: string }
      const group = await (await app.request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: '1', competitionClassId: 'cc-aktiv' }) })).json() as { id: string }
      const record = database.audit.record
      ;(database.audit as { record: typeof record }).record = () => { throw new Error('audit unavailable') }
      const response = await app.request('/api/admin/category-entries', { method: 'POST', headers, body: JSON.stringify({ groupId: group.id, categoryTypeId: 'ct-bronze-aktiv' }) })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: 'audit unavailable' })
      ;(database.audit as { record: typeof record }).record = record
      await expect((await app.request('/api/admin/category-entries', { headers })).json()).resolves.toEqual([])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('manages the category-types and evaluation-types lifecycle with full validation, protection and config cleanup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-scoring-catalog-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    const request = (path: string, init?: RequestInit) => app.request(path, init)

    try {
      // 1. Create Category Type
      const catRes = await request('/api/admin/category-types', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Staffel Bronze', competitionClassId: 'cc-aktiv', hasRelayRace: true }),
      })
      expect(catRes.status).toBe(201)
      const cat = await catRes.json() as { id: string; name: string; hasRelayRace: boolean }
      expect(cat).toMatchObject({ name: 'Staffel Bronze', hasRelayRace: true })
      expect(cat.id).toBeDefined()
      expect(cat.id.length).toBeGreaterThan(0)

      // Duplicate category rejection
      const dupCat = await request('/api/admin/category-types', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Staffel Bronze', competitionClassId: 'cc-aktiv' }),
      })
      expect(dupCat.status).toBe(409)

      // Update category type name
      const updateCatRes = await request(`/api/admin/category-types/${cat.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: 'Staffel Bronze Neuer Name', hasRelayRace: false }),
      })
      expect(updateCatRes.status).toBe(200)
      await expect(updateCatRes.json()).resolves.toMatchObject({
        id: cat.id,
        name: 'Staffel Bronze Neuer Name',
        hasRelayRace: false,
      })

      // 2. Create Evaluation Type referencing the category
      const evalRes = await request('/api/admin/evaluation-types', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Staffel Bronze Wertung',
          categoryTypeId1: cat.id,
          displayDurationSeconds: 14,
          order: 2,
        }),
      })
      expect(evalRes.status).toBe(201)
      const evalItem = await evalRes.json() as { id: string; name: string; displayDurationSeconds: number }
      expect(evalItem).toMatchObject({
        name: 'Staffel Bronze Wertung',
        categoryTypeId1: cat.id,
        displayDurationSeconds: 14,
        order: 2,
      })
      expect(evalItem.id).toBeDefined()
      expect(evalItem.id.length).toBeGreaterThan(0)

      // 3. Category deletion is blocked while referenced by evaluation type
      const blockedCatDelete = await request(`/api/admin/category-types/${cat.id}`, { method: 'DELETE', headers })
      expect(blockedCatDelete.status).toBe(400)
      await expect(blockedCatDelete.json()).resolves.toEqual({ error: 'Cannot delete category type referenced by evaluation types' })

      // 4. Update Evaluation Type (name, duration, visibility)
      const updateEvalRes = await request(`/api/admin/evaluation-types/${evalItem.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: 'Staffel Wertung Umbenannt', displayDurationSeconds: 18, publicTv: false }),
      })
      expect(updateEvalRes.status).toBe(200)
      await expect(updateEvalRes.json()).resolves.toMatchObject({
        id: evalItem.id,
        name: 'Staffel Wertung Umbenannt',
        displayDurationSeconds: 18,
        publicTv: false,
      })

      // 5. Delete Evaluation Type
      const deleteEvalRes = await request(`/api/admin/evaluation-types/${evalItem.id}`, { method: 'DELETE', headers })
      expect(deleteEvalRes.status).toBe(200)
      await expect(deleteEvalRes.json()).resolves.toEqual({ success: true, deletedId: evalItem.id })

      // 6. Delete Category Type now succeeds
      const deleteCatRes = await request(`/api/admin/category-types/${cat.id}`, { method: 'DELETE', headers })
      expect(deleteCatRes.status).toBe(200)
      await expect(deleteCatRes.json()).resolves.toEqual({ success: true, deletedId: cat.id })

      // Check audit history
      expect(database.audit.list().map((a) => a.action)).toEqual([
        'CREATE_CATEGORY_TYPE',
        'UPDATE_CATEGORY_TYPE',
        'CREATE_EVALUATION_TYPE',
        'UPDATE_EVALUATION_TYPE',
        'DELETE_EVALUATION_TYPE',
        'DELETE_CATEGORY_TYPE',
      ])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
