import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'

describe('self-hosted brigade and group administration routes', () => {
  it('rejects a normalized duplicate fire brigade name on creation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-brigade-duplicates-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }

    try {
      expect((await app.request('/api/admin/brigades', {
        method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }),
      })).status).toBe(201)

      const duplicate = await app.request('/api/admin/brigades', {
        method: 'POST', headers, body: JSON.stringify({ name: '  ff musterSTADT  ' }),
      })

      expect(duplicate.status).toBe(409)
      await expect(duplicate.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' })
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects renaming a fire brigade to another normalized name', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-brigade-rename-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }

    try {
      const oldBrigade = await (await app.request('/api/admin/brigades', {
        method: 'POST', headers, body: JSON.stringify({ name: 'FF Altstadt' }),
      })).json() as { id: string }
      await app.request('/api/admin/brigades', {
        method: 'POST', headers, body: JSON.stringify({ name: 'FF Neustadt' }),
      })

      const duplicate = await app.request(`/api/admin/brigades/${oldBrigade.id}`, {
        method: 'PUT', headers, body: JSON.stringify({ name: ' ff NEUSTADT ' }),
      })

      expect(duplicate.status).toBe(409)
      await expect(duplicate.json()).resolves.toEqual({ error: 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.' })
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('persists the authorized brigade and group lifecycle with its audit history', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-brigades-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    // Seed competition classes needed for group creation
    database.drizzle.run(sql`INSERT OR IGNORE INTO competition_classes (id, name) VALUES ('cc-aktiv', 'AKTIV'), ('cc-jugend', 'JUGEND'), ('cc-gast', 'GAST')`)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const request = (path: string, init?: RequestInit) => app.request(path, init)
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }

    try {
      const brigadeResponse = await request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }) })
      expect(brigadeResponse.status).toBe(201)
      const brigade = await brigadeResponse.json() as { id: string, name: string }
      expect(brigade).toMatchObject({ name: 'FF Musterstadt' })

      const groupResponse = await request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: '1', competitionClassId: 'cc-aktiv' }) })
      expect(groupResponse.status).toBe(201)
      const group = await groupResponse.json() as { id: string }

      const updatedBrigade = await request(`/api/admin/brigades/${brigade.id}`, { method: 'PUT', headers, body: JSON.stringify({ name: 'FF Neustadt' }) })
      expect(updatedBrigade.status).toBe(200)
      await expect(updatedBrigade.json()).resolves.toMatchObject({ id: brigade.id, name: 'FF Neustadt' })

      const updatedGroup = await request(`/api/admin/groups/${group.id}`, { method: 'PUT', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: 'Jugend 1', competitionClassId: 'cc-jugend' }) })
      expect(updatedGroup.status).toBe(200)
      await expect(updatedGroup.json()).resolves.toMatchObject({ id: group.id, fireBrigadeId: brigade.id, name: 'Jugend 1', competitionClass: 'JUGEND' })

      const groups = await request('/api/admin/groups', { headers })
      await expect(groups.json()).resolves.toEqual([expect.objectContaining({ id: group.id, name: 'Jugend 1' })])

      expect((await request(`/api/admin/brigades/${brigade.id}`, { method: 'DELETE', headers })).status).toBe(400)
      expect((await request(`/api/admin/groups/${group.id}`, { method: 'DELETE', headers })).status).toBe(200)
      expect((await request(`/api/admin/brigades/${brigade.id}`, { method: 'DELETE', headers })).status).toBe(200)

      expect(database.audit.list().map(({ action, user }) => ({ action, user }))).toEqual([
        { action: 'CREATE_BRIGADE', user: 'admin@feuerwehr.at' },
        { action: 'CREATE_GROUP', user: 'admin@feuerwehr.at' },
        { action: 'UPDATE_BRIGADE', user: 'admin@feuerwehr.at' },
        { action: 'UPDATE_GROUP', user: 'admin@feuerwehr.at' },
        { action: 'DELETE_GROUP', user: 'admin@feuerwehr.at' },
        { action: 'DELETE_BRIGADE', user: 'admin@feuerwehr.at' },
      ])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('preserves validation, duplicate, and related-competition-data rejection behavior', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-brigades-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    database.drizzle.run(sql`INSERT OR IGNORE INTO competition_classes (id, name) VALUES ('cc-aktiv', 'AKTIV'), ('cc-jugend', 'JUGEND'), ('cc-gast', 'GAST')`)
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }

    try {
      const invalid = await app.request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ name: '1' }) })
      expect(invalid.status).toBe(400)
      await expect(invalid.json()).resolves.toEqual({ error: 'Fire brigade ID is required' })

      const legacyNameLookup = await app.request('/api/admin/groups', {
        method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: 'unused', name: '1', competitionClass: 'AKTIV' }),
      })
      expect(legacyNameLookup.status).toBe(400)
      await expect(legacyNameLookup.json()).resolves.toEqual({ error: 'Invalid competition class' })

      database.drizzle.run(sql`INSERT INTO category_types (id, name, competition_class_id, has_relay_race) VALUES ('ct-bronze', 'bronze-aktiv', 'cc-aktiv', 0)`)
      const brigade = await (await app.request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Musterstadt' }) })).json() as { id: string }
      const group = await (await app.request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: '1', competitionClassId: 'cc-aktiv' }) })).json() as { id: string }
      const duplicate = await app.request('/api/admin/groups', { method: 'POST', headers, body: JSON.stringify({ fireBrigadeId: brigade.id, name: '1', competitionClassId: 'cc-aktiv' }) })
      expect(duplicate.status).toBe(409)
      await expect(duplicate.json()).resolves.toEqual({ error: 'A group with this name and competition class already exists in the selected fire brigade' })

      database.drizzle.run(sql`INSERT INTO category_entries (id, group_id, category_type_id, run_status) VALUES ('entry-1', ${group.id}, 'ct-bronze', 'OPEN')`)
      const deleteGroup = await app.request(`/api/admin/groups/${group.id}`, { method: 'DELETE', headers })
      expect(deleteGroup.status).toBe(500)
      await expect(deleteGroup.json()).resolves.toEqual({ error: 'FOREIGN KEY constraint failed' })
      expect((await app.request('/api/admin/groups', { headers })).status).toBe(200)
      await expect((await app.request('/api/admin/groups', { headers })).json()).resolves.toEqual([expect.objectContaining({ id: group.id })])
      expect(database.audit.list().map((audit) => audit.action)).toEqual(['CREATE_BRIGADE', 'CREATE_GROUP'])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('manages the competition classes lifecycle with referential protection and audit logging', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-cc-routes-'))
    const database = createDatabase(join(directory, 'scoreboard.sqlite'))
    const app = createSelfHostedApp({ publicDirectory: 'not-used', database })
    const headers = { 'Content-Type': 'application/json', 'X-Auth-Request-Email': 'admin@feuerwehr.at', 'X-Auth-Request-Roles': 'admin' }
    const request = (path: string, init?: RequestInit) => app.request(path, init)

    try {
      // 1. Create competition class
      const createRes = await request('/api/admin/competition-classes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'SENIOREN' }),
      })
      expect(createRes.status).toBe(201)
      const created = await createRes.json() as { id: string; name: string }
      expect(created).toMatchObject({ name: 'SENIOREN' })

      // Duplicate rejection
      const dupRes = await request('/api/admin/competition-classes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'SENIOREN' }),
      })
      expect(dupRes.status).toBe(409)

      // List classes
      const listRes = await request('/api/admin/competition-classes', { headers })
      expect(listRes.status).toBe(200)
      await expect(listRes.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'SENIOREN' })]))

      // Create brigade and group using this competition class
      const brigade = await (await request('/api/admin/brigades', { method: 'POST', headers, body: JSON.stringify({ name: 'FF Alt' }) })).json() as { id: string }
      const groupRes = await request('/api/admin/groups', {
        method: 'POST',
        headers,
        body: JSON.stringify({ fireBrigadeId: brigade.id, name: 'Senioren 1', competitionClassId: created.id }),
      })
      expect(groupRes.status).toBe(201)
      const group = await groupRes.json() as { id: string }

      // Deletion blocked because of assigned group
      const blockedDelete = await request(`/api/admin/competition-classes/${created.id}`, { method: 'DELETE', headers })
      expect(blockedDelete.status).toBe(400)
      await expect(blockedDelete.json()).resolves.toEqual({ error: 'Cannot delete competition class assigned to groups' })

      // Delete group, then delete competition class succeeds
      expect((await request(`/api/admin/groups/${group.id}`, { method: 'DELETE', headers })).status).toBe(200)
      const deleteRes = await request(`/api/admin/competition-classes/${created.id}`, { method: 'DELETE', headers })
      expect(deleteRes.status).toBe(200)
      await expect(deleteRes.json()).resolves.toEqual({ success: true, deletedId: created.id })

      // Audit log check
      expect(database.audit.list().map((a) => a.action)).toEqual([
        'CREATE_COMPETITION_CLASS',
        'CREATE_BRIGADE',
        'CREATE_GROUP',
        'DELETE_GROUP',
        'DELETE_COMPETITION_CLASS',
      ])
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
