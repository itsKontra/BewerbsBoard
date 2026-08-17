import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createDatabase } from './database.js'

describe('self-hosted SQLite database', () => {
  it('creates the clean baseline and default Television Scoreboard runtime state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const database = createDatabase(databasePath)

      expect(database.listTables()).toEqual(expect.arrayContaining([
        '__drizzle_migrations',
        'app_config',
        'audit_log',
        'category_entries',
        'category_types',
        'competition_classes',
        'evaluation_types',
        'fire_brigades',
        'groups',
        'tv_runtime_state',
      ]))
      expect(database.listTables()).not.toContain('__self_hosted_migrations')
      expect(database.getTvRuntimeState()).toEqual({
        id: 'default',
        mode: 'ROTATION',
        selectedCategoryId: null,
        updatedAt: null,
      })

      database.close()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reopens idempotently with the required SQLite safety settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const firstDatabase = createDatabase(databasePath)
      firstDatabase.close()

      const reopenedDatabase = createDatabase(databasePath)
      try {
        expect(reopenedDatabase.getConnectionSettings()).toEqual({
          busyTimeoutMilliseconds: 5000,
          foreignKeys: true,
          journalMode: 'wal',
          synchronous: 'full',
        })
        expect(reopenedDatabase.getTvRuntimeState()).toEqual({
          id: 'default',
          mode: 'ROTATION',
          selectedCategoryId: null,
          updatedAt: null,
        })
      } finally {
        reopenedDatabase.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('returns defaults and round-trips every former KV configuration value', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const database = createDatabase(databasePath)
      try {
        expect(database.configuration.read()).toMatchObject({
          eventName: 'Feuerwehr Leistungsbewerb',
          publicUrl: 'https://bewerb.feuerwehr.at',
          tvAnnouncement: { headline: '', message: '' },
          tvPresentation: {
            theme: 'broadcast',
            logoOverride: '',
            headerLabel: 'Feuerwehr Leistungsbewerb',
            adminSplashEnabled: true,
          },
        })

        database.configuration.save({
          eventName: 'Landesbewerb 2026',
          publicUrl: 'https://live.feuerwehr.at',
          rankingPageDurationMs: 12000,
          tvAnnouncement: { headline: 'Achtung', message: 'Siegerehrung um 18 Uhr' },
          tvPresentation: {
            theme: 'ceremony',
            logoOverride: 'https://cdn.example.at/logo.svg',
            headerLabel: 'Landesbewerb Live',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: true,
          },
        })

        expect(database.configuration.read()).toEqual({
          eventName: 'Landesbewerb 2026',
          publicUrl: 'https://live.feuerwehr.at',
          rankingPageDurationMs: 12000,
          tvAnnouncement: { headline: 'Achtung', message: 'Siegerehrung um 18 Uhr' },
          tvPresentation: {
            theme: 'ceremony',
            logoOverride: 'https://cdn.example.at/logo.svg',
            headerLabel: 'Landesbewerb Live',
            qrCodeEnabled: true,
            qrCodeAlwaysVisible: false,
            qrCodeIntervalSeconds: 30,
            qrCodeDurationSeconds: 10,
            adminSplashEnabled: true,
          },
        })
      } finally {
        database.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rolls back state mutations when audit logging fails inside a transaction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-'))
    const databasePath = join(directory, 'scoreboard.sqlite')
    try {
      const database = createDatabase(databasePath)
      try {
        expect(() => database.transaction(() => {
          database.configuration.save({
            ...database.configuration.read(),
            eventName: 'Should not persist',
          })
          database.audit.record({
            id: 'audit-1',
            timestamp: 1_700_000_000_000,
            user: 'admin@feuerwehr.at',
            action: 'UPDATE_CONFIG',
            details: { eventName: 'Should not persist' },
          })
          throw new Error('Simulated mutation failure')
        })).toThrow('Simulated mutation failure')

        expect(database.configuration.read().eventName).toBe('Feuerwehr Leistungsbewerb')
        expect(database.audit.list()).toEqual([])
      } finally {
        database.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rolls back a competition reset when its audit write fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const database = createDatabase(databasePath)
      try {
        database.administration.createBrigade({ id: 'brigade-1', name: 'FF Beispiel' })
        // Seed a competition class so the group FK can resolve
        database.drizzle.run(sql`INSERT OR IGNORE INTO competition_classes (id, name) VALUES ('cc-aktiv', 'AKTIV')`)
        database.administration.createGroup({ id: 'group-1', fireBrigadeId: 'brigade-1', name: 'Gruppe 1', competitionClassId: 'cc-aktiv' })
        // Seed a category type so the entry FK can resolve
        database.drizzle.run(sql`INSERT OR IGNORE INTO category_types (id, name, competition_class_id, has_relay_race) VALUES ('ct-bronze', 'bronze-aktiv', 'cc-aktiv', 0)`)
        database.scoring.createEntry({ id: 'entry-1', groupId: 'group-1', categoryTypeId: 'ct-bronze', runStatus: 'OPEN', startOrderPosition: 1, attackTimeHundredths: null, attackTimeErrors: null, relayRaceHundredths: null, relayRaceErrors: null })

        expect(() => database.transaction(() => {
          database.clearCompetitionAndRuntime(1_700_000_000_000)
          throw new Error('Simulated audit failure')
        })).toThrow('Simulated audit failure')

        expect(database.administration.listBrigades()).toHaveLength(1)
        expect(database.administration.listGroups()).toHaveLength(1)
        expect(database.scoring.listEntries()).toHaveLength(1)
        expect(database.getTvRuntimeState()).toEqual({ id: 'default', mode: 'ROTATION', selectedCategoryId: null, updatedAt: null })
      } finally {
        database.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('selectively resets scopes with cascading dependency enforcement', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-database-selective-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const database = createDatabase(databasePath)
      try {
        database.administration.createBrigade({ id: 'brigade-1', name: 'FF Beispiel' })
        database.drizzle.run(sql`INSERT OR IGNORE INTO competition_classes (id, name) VALUES ('cc-aktiv', 'AKTIV')`)
        database.administration.createGroup({ id: 'group-1', fireBrigadeId: 'brigade-1', name: 'Gruppe 1', competitionClassId: 'cc-aktiv' })
        database.drizzle.run(sql`INSERT OR IGNORE INTO category_types (id, name, competition_class_id, has_relay_race) VALUES ('ct-bronze', 'bronze-aktiv', 'cc-aktiv', 0)`)
        database.scoring.createEntry({ id: 'entry-1', groupId: 'group-1', categoryTypeId: 'ct-bronze', runStatus: 'OPEN', startOrderPosition: 1, attackTimeHundredths: null, attackTimeErrors: null, relayRaceHundredths: null, relayRaceErrors: null })

        // 1. Reset only categoryEntries
        const summary1 = database.clearCompetitionAndRuntime(1_700_000_000_000, { categoryEntries: true })
        expect(summary1.categoryEntriesCount).toBe(1)
        expect(summary1.groupsCount).toBeUndefined()
        expect(database.scoring.listEntries()).toHaveLength(0)
        expect(database.administration.listGroups()).toHaveLength(1)
        expect(database.administration.listBrigades()).toHaveLength(1)

        // Re-create entry
        database.scoring.createEntry({ id: 'entry-2', groupId: 'group-1', categoryTypeId: 'ct-bronze', runStatus: 'OPEN', startOrderPosition: 1, attackTimeHundredths: null, attackTimeErrors: null, relayRaceHundredths: null, relayRaceErrors: null })

        // 2. Reset fireBrigades -> cascades to groups & entries
        const summary2 = database.clearCompetitionAndRuntime(1_700_000_000_000, { fireBrigades: true })
        expect(summary2.categoryEntriesCount).toBe(1)
        expect(summary2.groupsCount).toBe(1)
        expect(summary2.fireBrigadesCount).toBe(1)
        expect(database.scoring.listEntries()).toHaveLength(0)
        expect(database.administration.listGroups()).toHaveLength(0)
        expect(database.administration.listBrigades()).toHaveLength(0)
      } finally {
        database.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('manages competition classes, category types, and evaluation types with referential integrity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scoreboard-masterdata-'))
    const databasePath = join(directory, 'scoreboard.sqlite')

    try {
      const database = createDatabase(databasePath)
      try {
        // 1. Competition Classes
        database.administration.createCompetitionClass({ id: 'cc-senioren', name: 'SENIOREN' })
        expect(database.administration.listCompetitionClasses()).toHaveLength(4)
        expect(database.administration.findCompetitionClassById('cc-senioren')).toEqual({ id: 'cc-senioren', name: 'SENIOREN' })
        expect(database.administration.findCompetitionClassByName('senioren')).toEqual({ id: 'cc-senioren', name: 'SENIOREN' })
        expect(database.administration.hasGroupsForCompetitionClass('cc-senioren')).toBe(false)

        // 2. Category Types
        database.catalog.createCategoryType({ id: 'ct-staffel', name: 'Staffel Test', competitionClassId: 'cc-aktiv', hasRelayRace: true })
        expect(database.catalog.findCategoryTypeById('ct-staffel')).toEqual({ id: 'ct-staffel', name: 'Staffel Test', competitionClassId: 'cc-aktiv', hasRelayRace: true })
        expect(database.catalog.findCategoryTypeByName('staffel test')).toEqual({ id: 'ct-staffel', name: 'Staffel Test', competitionClassId: 'cc-aktiv', hasRelayRace: true })
        expect(database.catalog.hasEntriesForCategoryType('ct-staffel')).toBe(false)
        expect(database.catalog.hasEvaluationsForCategoryType('ct-staffel')).toBe(false)

        // 3. Evaluation Types
        const evalStaffel = database.catalog.createEvaluationType({
          id: 'eval-staffel',
          name: 'Staffel Wertung Test',
          categoryTypeId1: 'ct-staffel',
          categoryTypeId2: null,
          excludeRelayRace: false,
          public: true,
          publicTv: true,
          displayDurationSeconds: 15,
          order: 10,
        })
        expect(evalStaffel).toMatchObject({
          id: 'eval-staffel',
          name: 'Staffel Wertung Test',
          categoryTypeId1: 'ct-staffel',
          categoryTypeName1: 'Staffel Test',
          hasRelayRace1: true,
          competitionClassId1: 'cc-aktiv',
          competitionClassId2: null,
          displayDurationSeconds: 15,
          order: 10,
        })
        expect(database.catalog.hasEvaluationsForCategoryType('ct-staffel')).toBe(true)

        // Update evaluation type name, duration and visibility
        const updatedEval = database.catalog.updateEvaluationType('eval-staffel', {
          name: 'Staffel Wertung Renamed',
          displayDurationSeconds: 20,
          publicTv: false,
        })
        expect(updatedEval).toMatchObject({
          id: 'eval-staffel',
          name: 'Staffel Wertung Renamed',
          displayDurationSeconds: 20,
          publicTv: false,
        })

        // Update category type name and relay flag
        const updatedCatType = database.catalog.updateCategoryType('ct-staffel', {
          name: 'Staffel Test Renamed',
          hasRelayRace: false,
        })
        expect(updatedCatType).toEqual({
          id: 'ct-staffel',
          name: 'Staffel Test Renamed',
          competitionClassId: 'cc-aktiv',
          hasRelayRace: false,
        })
        expect(database.catalog.findCategoryTypeById('ct-staffel')?.name).toBe('Staffel Test Renamed')

        // Delete evaluation type
        const deletedEval = database.catalog.deleteEvaluationType('eval-staffel')
        expect(deletedEval?.name).toBe('Staffel Wertung Renamed')
        expect(database.catalog.findEvaluationTypeById('eval-staffel')).toBeUndefined()
        expect(database.catalog.hasEvaluationsForCategoryType('ct-staffel')).toBe(false)

        // Delete category type
        const deletedCat = database.catalog.deleteCategoryType('ct-staffel')
        expect(deletedCat?.name).toBe('Staffel Test Renamed')
        expect(database.catalog.findCategoryTypeById('ct-staffel')).toBeUndefined()

        // Delete competition class
        const deletedCC = database.administration.deleteCompetitionClass('cc-senioren')
        expect(deletedCC?.name).toBe('SENIOREN')
        expect(database.administration.findCompetitionClassById('cc-senioren')).toBeUndefined()
      } finally {
        database.close()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
