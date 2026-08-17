import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createSelfHostedApp } from './app.js'
import { createDatabase } from './database.js'
import type { DataExportEnvelope } from '../shared/domain/data-management.js'

describe('self-hosted data management routes', () => {
  const adminHeaders = {
    'Content-Type': 'application/json',
    'X-Auth-Request-Email': 'admin@feuerwehr.at',
    'X-Auth-Request-Roles': 'admin',
  }

  it('exports database data, records audit log, and sets attachment header', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-test-'))
    const databasePath = join(directory, 'scoreboard.sqlite')
    const database = createDatabase(databasePath)

    try {
      // Seed a brigade, group, and entry using the pre-seeded cc-aktiv and bronze-aktiv
      database.administration.createBrigade({ id: 'fb-1', name: 'FF Test' })
      database.administration.createGroup({ id: 'g-1', fireBrigadeId: 'fb-1', competitionClassId: 'cc-aktiv', name: 'Gruppe 1' })
      database.scoring.createEntry({
        id: 'ce-1',
        groupId: 'g-1',
        categoryTypeId: 'bronze-aktiv',
        runStatus: 'VALID',
        startOrderPosition: 1,
        attackTimeHundredths: 4500,
        attackTimeErrors: 0,
        relayRaceHundredths: 5500,
        relayRaceErrors: 0,
      })

      const app = createSelfHostedApp({
        publicDirectory: directory,
        database,
      })

      const response = await app.request('/api/admin/data/export', {
        headers: adminHeaders,
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="bewerbsboard-export-')
      const body = await response.json() as DataExportEnvelope
      expect(body.version).toBe(1)
      expect(body.data.competitionClasses.length).toBeGreaterThanOrEqual(3)
      expect(body.data.fireBrigades).toHaveLength(1)
      expect(body.data.groups).toHaveLength(1)
      expect(body.data.categoryTypes.length).toBeGreaterThanOrEqual(1)
      expect(body.data.evaluationTypes.length).toBeGreaterThanOrEqual(1)
      expect(body.data.categoryEntries).toHaveLength(1)
      expect(body.data.appConfig).toBeDefined()

      // Audit log check
      const logs = database.audit.list()
      const exportLog = logs.find((l) => l.action === 'DATA_EXPORT')
      expect(exportLog).toBeDefined()
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('runs preflight and reports new vs existing counts accurately', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-test-'))
    const databasePath = join(directory, 'scoreboard.sqlite')
    const database = createDatabase(databasePath)

    try {
      database.administration.createBrigade({ id: 'fb-1', name: 'FF Existing' })

      const app = createSelfHostedApp({
        publicDirectory: directory,
        database,
      })

      const envelope: DataExportEnvelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          appConfig: [],
          competitionClasses: [
            { id: 'cc-aktiv', name: 'AKTIV' },
            { id: 'cc-custom', name: 'CUSTOM' },
          ],
          fireBrigades: [
            { id: 'fb-1', name: 'FF Existing Renamed' },
            { id: 'fb-2', name: 'FF Brandneu' },
          ],
          categoryTypes: [],
          evaluationTypes: [],
          groups: [],
          categoryEntries: [],
        },
      }

      const response = await app.request('/api/admin/data/import/preflight', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(envelope),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.isValid).toBe(true)
      expect(result.summary.competitionClasses).toEqual({ total: 2, toInsert: 1, toUpdate: 1 })
      expect(result.summary.fireBrigades).toEqual({ total: 2, toInsert: 1, toUpdate: 1 })
      expect(result.totalEntities).toBe(4)
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('imports data transactionally, updates existing records, inserts new ones, and writes audit log', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-test-'))
    const databasePath = join(directory, 'scoreboard.sqlite')
    const database = createDatabase(databasePath)

    try {
      database.administration.createBrigade({ id: 'fb-1', name: 'FF Old Name' })

      const app = createSelfHostedApp({
        publicDirectory: directory,
        database,
      })

      const envelope: DataExportEnvelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          appConfig: [{ key: 'event:name', valueJson: '"Neuer Titel"', updatedAt: 123456789 }],
          competitionClasses: [
            { id: 'cc-aktiv', name: 'AKTIV' },
            { id: 'cc-senioren', name: 'SENIOREN' },
          ],
          fireBrigades: [
            { id: 'fb-1', name: 'FF Updated Name' },
            { id: 'fb-2', name: 'FF Neu' },
          ],
          categoryTypes: [
            { id: 'bronze-aktiv', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: true },
          ],
          evaluationTypes: [],
          groups: [
            { id: 'g-1', fireBrigadeId: 'fb-1', competitionClassId: 'cc-aktiv', name: 'Gruppe 1' },
          ],
          categoryEntries: [
            {
              id: 'ce-1',
              groupId: 'g-1',
              categoryTypeId: 'bronze-aktiv',
              runStatus: 'VALID',
              startOrderPosition: 1,
              attackTimeHundredths: 4200,
              attackTimeErrors: 0,
              relayRaceHundredths: null,
              relayRaceErrors: null,
            },
          ],
        },
      }

      const response = await app.request('/api/admin/data/import', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(envelope),
      })

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.message).toContain('erfolgreich')

      // Verify DB state
      expect(database.administration.findCompetitionClassById('cc-senioren')).toBeDefined()
      const updatedBrigade = database.administration.listBrigades().find((b) => b.id === 'fb-1')
      expect(updatedBrigade?.name).toBe('FF Updated Name')
      expect(database.scoring.findEntry('ce-1')?.attackTimeHundredths).toBe(4200)

      // Verify audit log
      const logs = database.audit.list()
      const importLog = logs.find((l) => l.action === 'DATA_IMPORT')
      expect(importLog).toBeDefined()
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rolls back the entire import transaction on conflict or foreign key error', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-test-'))
    const databasePath = join(directory, 'scoreboard.sqlite')
    const database = createDatabase(databasePath)

    try {
      database.administration.createBrigade({ id: 'fb-1', name: 'FF Original' })

      const app = createSelfHostedApp({
        publicDirectory: directory,
        database,
      })

      // Invalid envelope: group refers to non-existent fireBrigadeId 'fb-nonexistent'
      const envelope: DataExportEnvelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          appConfig: [],
          competitionClasses: [{ id: 'cc-new-roll', name: 'ROLLBACK CLASS' }],
          fireBrigades: [{ id: 'fb-1', name: 'FF CHANGED IN FAILING IMPORT' }],
          categoryTypes: [],
          evaluationTypes: [],
          groups: [{ id: 'g-fail', fireBrigadeId: 'fb-nonexistent', competitionClassId: 'cc-aktiv', name: 'Gruppe X' }],
          categoryEntries: [],
        },
      }

      const response = await app.request('/api/admin/data/import', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(envelope),
      })

      expect(response.status).toBe(400)

      // Verify complete rollback: fb-1 name must still be 'FF Original', not changed!
      const brigade = database.administration.listBrigades().find((b) => b.id === 'fb-1')
      expect(brigade?.name).toBe('FF Original')
      expect(database.administration.findCompetitionClassById('cc-new-roll')).toBeUndefined()
    } finally {
      database.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
