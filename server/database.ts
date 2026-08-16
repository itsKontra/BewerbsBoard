import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'

import { createConfigurationRepository, type ConfigurationRepository } from './configuration.js'

export interface TvRuntimeState {
  id: string
  mode: string
  selectedCategoryId: string | null
  updatedAt: number | null
}

export interface ConnectionSettings {
  busyTimeoutMilliseconds: number
  foreignKeys: boolean
  journalMode: string
  synchronous: 'full'
}

export interface AuditRecord {
  id: string
  timestamp: number
  user: string
  action: string
  details: unknown
}

export interface AuditLogPage {
  logs: Array<Omit<AuditRecord, 'details'> & { details: string | null }>
  total: number
}

export interface ResetSummary {
  fireBrigadesCount: number
  groupsCount: number
  categoryEntriesCount: number
}

export interface FireBrigade {
  id: string
  name: string
}

/** A group read model. Names are joined for display; relationships use IDs. */
export interface Group {
  id: string
  fireBrigadeId: string
  name: string
  competitionClassId: string
  /** Denormalized from competition_classes.name join, e.g. 'AKTIV' | 'JUGEND' | 'GAST' */
  competitionClass: string
}

export type GroupWrite = Pick<Group, 'id' | 'fireBrigadeId' | 'name' | 'competitionClassId'>

/** A competition class lookup row. */
export interface CompetitionClass {
  id: string
  name: string
}

/** A category type lookup row. */
export interface CategoryType {
  id: string
  name: string
  competitionClassId: string
  hasRelayRace: boolean
}

/** An evaluation type row with denormalized category type metadata. */
export interface EvaluationType {
  id: string
  name: string
  categoryTypeId1: string
  categoryTypeName1: string
  hasRelayRace1: boolean
  competitionClassId1: string | null
  categoryTypeId2: string | null
  categoryTypeName2: string | null
  hasRelayRace2: boolean
  competitionClassId2: string | null
  excludeRelayRace: boolean
  isBrigadePairing: boolean
  public: boolean
  publicTv: boolean
  displayDurationSeconds: number
  order: number
}

export interface CategoryEntry {
  id: string
  groupId: string
  categoryTypeId: string
  runStatus: 'OPEN' | 'VALID' | 'DNF'
  startOrderPosition: number | null
  attackTimeHundredths: number | null
  attackTimeErrors: number | null
  relayRaceHundredths: number | null
  relayRaceErrors: number | null
}

export interface CategoryEntryDetails extends CategoryEntry {
  categoryTypeName: string
  hasRelayRace: boolean
  groupName: string
  competitionClass: string
  fireBrigadeId: string
  fireBrigadeName: string
}

export interface SelfHostedDatabase {
  readonly drizzle: ReturnType<typeof drizzle>
  close(): void
  readonly configuration: ConfigurationRepository
  readonly administration: {
    listBrigades(): FireBrigade[]
    findDuplicateBrigade(name: string, excludedId?: string): boolean
    createBrigade(brigade: FireBrigade): FireBrigade
    updateBrigade(id: string, name: string): FireBrigade | undefined
    deleteBrigade(id: string): FireBrigade | undefined
    hasGroups(brigadeId: string): boolean
    listGroups(): Group[]
    createGroup(group: GroupWrite): Group
    findDuplicateGroup(group: GroupWrite, excludedId?: string): boolean
    updateGroup(id: string, group: GroupWrite): Group | undefined
    deleteGroup(id: string): Group | undefined
    listCompetitionClasses(): CompetitionClass[]
    findCompetitionClassByName(name: string): CompetitionClass | undefined
    findCompetitionClassById(id: string): CompetitionClass | undefined
    createCompetitionClass(competitionClass: CompetitionClass): CompetitionClass
    deleteCompetitionClass(id: string): CompetitionClass | undefined
    hasGroupsForCompetitionClass(competitionClassId: string): boolean
  }
  readonly audit: {
    list(): AuditRecord[]
    listPage(page: number, limit: number, search: string): AuditLogPage
    record(record: AuditRecord): void
  }
  clearCompetitionAndRuntime(updatedAt: number): ResetSummary
  readonly scoring: {
    listEntries(): CategoryEntryDetails[]
    findEntry(id: string): CategoryEntry | undefined
    findGroup(id: string): Group | undefined
    findDuplicateEntry(groupId: string, categoryTypeId: string): boolean
    nextOpenPosition(categoryTypeId: string): number
    createEntry(entry: CategoryEntry): void
    updateEntry(entry: CategoryEntry): void
    deleteEntry(id: string): void
    compactOpenEntries(categoryTypeId: string, excludedId?: string): void
  }
  readonly catalog: {
    listCategoryTypes(): CategoryType[]
    findCategoryTypeById(id: string): CategoryType | undefined
    findCategoryTypeByName(name: string): CategoryType | undefined
    createCategoryType(categoryType: CategoryType): CategoryType
    updateCategoryType(id: string, categoryType: Partial<{ name: string; competitionClassId: string; hasRelayRace: boolean }>): CategoryType | undefined
    deleteCategoryType(id: string): CategoryType | undefined
    hasEntriesForCategoryType(categoryTypeId: string): boolean
    hasEvaluationsForCategoryType(categoryTypeId: string): boolean
    listEvaluationTypes(): EvaluationType[]
    findEvaluationTypeById(id: string): EvaluationType | undefined
    createEvaluationType(evaluationType: {
      id: string
      name: string
      categoryTypeId1: string
      categoryTypeId2?: string | null
      excludeRelayRace: boolean
      isBrigadePairing?: boolean
      public: boolean
      publicTv: boolean
      displayDurationSeconds?: number
      order?: number
    }): EvaluationType
    updateEvaluationType(id: string, evaluationType: Partial<{
      name: string
      categoryTypeId1: string
      categoryTypeId2: string | null
      excludeRelayRace: boolean
      isBrigadePairing: boolean
      public: boolean
      publicTv: boolean
      displayDurationSeconds: number
      order: number
    }>): EvaluationType | undefined
    deleteEvaluationType(id: string): EvaluationType | undefined
  }
  getConnectionSettings(): ConnectionSettings
  getTvRuntimeState(): TvRuntimeState | undefined
  setTvRuntimeState(state: Omit<TvRuntimeState, 'id'>): TvRuntimeState
  listTables(): string[]
  transaction<T>(work: () => T): T
}

export function createDatabase(databasePath: string): SelfHostedDatabase {
  const sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = FULL')
  sqlite.pragma('busy_timeout = 5000')
  const database = drizzle(sqlite)
  migrate(database, { migrationsFolder: resolve('server/migrations') })

  const mapEvaluationTypeRow = (row: any): EvaluationType => ({
    id: row.id,
    name: row.name,
    categoryTypeId1: row.categoryTypeId1,
    categoryTypeName1: row.categoryTypeName1,
    hasRelayRace1: Boolean(row.hasRelayRace1),
    competitionClassId1: row.competitionClassId1 ?? null,
    categoryTypeId2: row.categoryTypeId2 ?? null,
    categoryTypeName2: row.categoryTypeName2 ?? null,
    hasRelayRace2: Boolean(row.hasRelayRace2),
    competitionClassId2: row.competitionClassId2 ?? null,
    excludeRelayRace: Boolean(row.excludeRelayRace),
    isBrigadePairing: Boolean(row.isBrigadePairing),
    public: Boolean(row.public),
    publicTv: Boolean(row.publicTv),
    displayDurationSeconds: Number(row.displayDurationSeconds ?? 10),
    order: Number(row.order ?? 1),
  })

  return {
    drizzle: database,
    close: () => sqlite.close(),
    configuration: createConfigurationRepository(sqlite),
    administration: {
      listBrigades: () => sqlite.prepare('SELECT id, name FROM fire_brigades').all() as FireBrigade[],
      findDuplicateBrigade: (name, excludedId) => {
        const normalizedName = name.trim().toLocaleLowerCase('de-AT')
        return (sqlite.prepare('SELECT id, name FROM fire_brigades').all() as FireBrigade[]).some(
          (brigade) => brigade.id !== excludedId && brigade.name.trim().toLocaleLowerCase('de-AT') === normalizedName,
        )
      },
      createBrigade: (brigade) => {
        sqlite.prepare('INSERT INTO fire_brigades (id, name) VALUES (?, ?)').run(brigade.id, brigade.name)
        return brigade
      },
      updateBrigade: (id, name) => {
        const result = sqlite.prepare('UPDATE fire_brigades SET name = ? WHERE id = ? RETURNING id, name').get(name, id)
        return result as FireBrigade | undefined
      },
      deleteBrigade: (id) => sqlite.prepare('DELETE FROM fire_brigades WHERE id = ? RETURNING id, name').get(id) as FireBrigade | undefined,
      hasGroups: (brigadeId) => sqlite.prepare('SELECT 1 FROM groups WHERE fire_brigade_id = ? LIMIT 1').get(brigadeId) !== undefined,
      listGroups: () => sqlite.prepare(`
        SELECT g.id, g.fire_brigade_id AS fireBrigadeId, g.name, g.competition_class_id AS competitionClassId, cc.name AS competitionClass
        FROM groups g
        JOIN competition_classes cc ON cc.id = g.competition_class_id
      `).all() as Group[],
      createGroup: (group) => {
        sqlite.prepare(`
          INSERT INTO groups (id, fire_brigade_id, name, competition_class_id)
          VALUES (?, ?, ?, ?)
        `).run(group.id, group.fireBrigadeId, group.name, group.competitionClassId)
        return sqlite.prepare(`
          SELECT g.id, g.fire_brigade_id AS fireBrigadeId, g.name, g.competition_class_id AS competitionClassId, cc.name AS competitionClass
          FROM groups g JOIN competition_classes cc ON cc.id = g.competition_class_id WHERE g.id = ?
        `).get(group.id) as Group
      },
      findDuplicateGroup: (group, excludedId) => {
        return sqlite.prepare(`
          SELECT 1 FROM groups
          WHERE fire_brigade_id = ? AND name = ? AND competition_class_id = ?
          ${excludedId === undefined ? '' : 'AND id != ?'}
          LIMIT 1
        `).get(...(excludedId === undefined
          ? [group.fireBrigadeId, group.name, group.competitionClassId]
          : [group.fireBrigadeId, group.name, group.competitionClassId, excludedId])) !== undefined
      },
      updateGroup: (id, group) => {
        const rowsChanged = sqlite.prepare(
          'UPDATE groups SET name = ?, competition_class_id = ? WHERE id = ?'
        ).run(group.name, group.competitionClassId, id).changes
        if (rowsChanged === 0) return undefined
        return sqlite.prepare(`
          SELECT g.id, g.fire_brigade_id AS fireBrigadeId, g.name, g.competition_class_id AS competitionClassId, cc.name AS competitionClass
          FROM groups g JOIN competition_classes cc ON cc.id = g.competition_class_id WHERE g.id = ?
        `).get(id) as Group
      },
      deleteGroup: (id) => {
        const existing = sqlite.prepare(`
          SELECT g.id, g.fire_brigade_id AS fireBrigadeId, g.name, g.competition_class_id AS competitionClassId, cc.name AS competitionClass
          FROM groups g JOIN competition_classes cc ON cc.id = g.competition_class_id
          WHERE g.id = ?
        `).get(id) as Group | undefined
        if (!existing) return undefined
        sqlite.prepare('DELETE FROM groups WHERE id = ?').run(id)
        return existing
      },
      listCompetitionClasses: () => sqlite.prepare('SELECT id, name FROM competition_classes ORDER BY name').all() as CompetitionClass[],
      findCompetitionClassByName: (name) => sqlite.prepare("SELECT id, name FROM competition_classes WHERE name = ? COLLATE NOCASE OR id = ? OR replace(lower(name), ' ', '-') = lower(?)").get(name, name, name) as CompetitionClass | undefined,
      findCompetitionClassById: (id) => sqlite.prepare('SELECT id, name FROM competition_classes WHERE id = ?').get(id) as CompetitionClass | undefined,
      createCompetitionClass: (cc) => {
        sqlite.prepare('INSERT INTO competition_classes (id, name) VALUES (?, ?)').run(cc.id, cc.name)
        return cc
      },
      deleteCompetitionClass: (id) => sqlite.prepare('DELETE FROM competition_classes WHERE id = ? RETURNING id, name').get(id) as CompetitionClass | undefined,
      hasGroupsForCompetitionClass: (ccId) => sqlite.prepare('SELECT 1 FROM groups WHERE competition_class_id = ? LIMIT 1').get(ccId) !== undefined,
    },
    audit: {
      list: () => sqlite.prepare(`
        SELECT id, timestamp, user, action, details
        FROM audit_log
        ORDER BY timestamp, id
      `).all().map((row) => {
        const audit = row as Omit<AuditRecord, 'details'> & { details: string | null }
        return { ...audit, details: audit.details === null ? null : JSON.parse(audit.details) }
      }),
      listPage: (page, limit, search) => {
        const whereClause = search ? 'WHERE user LIKE ? OR action LIKE ? OR details LIKE ?' : ''
        const searchValues = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
        const total = (sqlite.prepare(`SELECT COUNT(*) AS count FROM audit_log ${whereClause}`).get(...searchValues) as { count: number }).count
        const logs = sqlite.prepare(`SELECT id, timestamp, user, action, details FROM audit_log ${whereClause} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`)
          .all(...searchValues, limit, (page - 1) * limit) as Array<Omit<AuditRecord, 'details'> & { details: string | null }>
        return { logs, total }
      },
      record: (record) => {
        sqlite.prepare(`
          INSERT INTO audit_log (id, timestamp, user, action, details)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.timestamp,
          record.user,
          record.action,
          record.details === undefined ? null : JSON.stringify(record.details),
        )
      },
    },
    clearCompetitionAndRuntime: (updatedAt) => {
      const summary = {
        fireBrigadesCount: (sqlite.prepare('SELECT COUNT(*) AS count FROM fire_brigades').get() as { count: number }).count,
        groupsCount: (sqlite.prepare('SELECT COUNT(*) AS count FROM groups').get() as { count: number }).count,
        categoryEntriesCount: (sqlite.prepare('SELECT COUNT(*) AS count FROM category_entries').get() as { count: number }).count,
      }
      sqlite.prepare('DELETE FROM category_entries').run()
      sqlite.prepare('DELETE FROM groups').run()
      sqlite.prepare('DELETE FROM fire_brigades').run()
      sqlite.prepare(`UPDATE tv_runtime_state SET mode = 'ROTATION', selected_category_id = NULL, updated_at = ? WHERE id = 'default'`).run(updatedAt)
      return summary
    },
    scoring: {
      listEntries: () => sqlite.prepare(`
        SELECT e.id, e.group_id AS groupId, e.category_type_id AS categoryTypeId,
          e.run_status AS runStatus, e.start_order_position AS startOrderPosition,
          e.attack_time_hundredths AS attackTimeHundredths,
          e.attack_time_errors AS attackTimeErrors,
          e.relay_race_hundredths AS relayRaceHundredths,
          e.relay_race_errors AS relayRaceErrors,
          ct.name AS categoryTypeName,
          ct.has_relay_race AS hasRelayRace,
          g.name AS groupName,
          cc.name AS competitionClass,
          g.fire_brigade_id AS fireBrigadeId,
          b.name AS fireBrigadeName
        FROM category_entries e
        JOIN groups g ON g.id = e.group_id
        JOIN competition_classes cc ON cc.id = g.competition_class_id
        JOIN fire_brigades b ON b.id = g.fire_brigade_id
        JOIN category_types ct ON ct.id = e.category_type_id
      `).all() as CategoryEntryDetails[],
      findEntry: (id) => sqlite.prepare(`
        SELECT id, group_id AS groupId, category_type_id AS categoryTypeId,
          run_status AS runStatus, start_order_position AS startOrderPosition,
          attack_time_hundredths AS attackTimeHundredths,
          attack_time_errors AS attackTimeErrors,
          relay_race_hundredths AS relayRaceHundredths,
          relay_race_errors AS relayRaceErrors
        FROM category_entries WHERE id = ?
      `).get(id) as CategoryEntry | undefined,
      findGroup: (id) => sqlite.prepare(`
        SELECT g.id, g.fire_brigade_id AS fireBrigadeId, g.name, g.competition_class_id AS competitionClassId, cc.name AS competitionClass
        FROM groups g
        JOIN competition_classes cc ON cc.id = g.competition_class_id
        WHERE g.id = ?
      `).get(id) as Group | undefined,
      findDuplicateEntry: (groupId, categoryTypeId) => sqlite.prepare(
        'SELECT 1 FROM category_entries WHERE group_id = ? AND category_type_id = ?'
      ).get(groupId, categoryTypeId) !== undefined,
      nextOpenPosition: (categoryTypeId) => (sqlite.prepare(
        "SELECT COALESCE(MAX(start_order_position), 0) + 1 AS position FROM category_entries WHERE category_type_id = ? AND run_status = 'OPEN'"
      ).get(categoryTypeId) as { position: number }).position,
      createEntry: (entry) => sqlite.prepare(
        'INSERT INTO category_entries (id, group_id, category_type_id, run_status, start_order_position, attack_time_hundredths, attack_time_errors, relay_race_hundredths, relay_race_errors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(entry.id, entry.groupId, entry.categoryTypeId, entry.runStatus, entry.startOrderPosition, entry.attackTimeHundredths, entry.attackTimeErrors, entry.relayRaceHundredths, entry.relayRaceErrors),
      updateEntry: (entry) => sqlite.prepare(
        'UPDATE category_entries SET run_status = ?, start_order_position = ?, attack_time_hundredths = ?, attack_time_errors = ?, relay_race_hundredths = ?, relay_race_errors = ? WHERE id = ?'
      ).run(entry.runStatus, entry.startOrderPosition, entry.attackTimeHundredths, entry.attackTimeErrors, entry.relayRaceHundredths, entry.relayRaceErrors, entry.id),
      deleteEntry: (id) => sqlite.prepare('DELETE FROM category_entries WHERE id = ?').run(id),
      compactOpenEntries: (categoryTypeId, excludedId) => {
        const entries = sqlite.prepare(
          `SELECT id FROM category_entries WHERE category_type_id = ? AND run_status = 'OPEN' ${excludedId ? 'AND id != ?' : ''} ORDER BY start_order_position`
        ).all(...(excludedId ? [categoryTypeId, excludedId] : [categoryTypeId])) as { id: string }[]
        const update = sqlite.prepare('UPDATE category_entries SET start_order_position = ? WHERE id = ?')
        entries.forEach((entry, index) => update.run(index + 1, entry.id))
      },
    },
    catalog: {
      listCategoryTypes: () => sqlite.prepare(
        'SELECT id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace FROM category_types ORDER BY name'
      ).all().map((r: any) => ({ ...r, hasRelayRace: Boolean(r.hasRelayRace) })) as CategoryType[],
      findCategoryTypeById: (id) => {
        const r = sqlite.prepare('SELECT id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace FROM category_types WHERE id = ?').get(id) as any
        return r ? { ...r, hasRelayRace: Boolean(r.hasRelayRace) } as CategoryType : undefined
      },
      findCategoryTypeByName: (name) => {
        const r = sqlite.prepare(`
          SELECT id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace
          FROM category_types
          WHERE name = ? COLLATE NOCASE OR id = ? OR replace(lower(name), ' ', '-') = lower(?)
          ORDER BY CASE
            WHEN id = ? THEN 0
            WHEN name = ? COLLATE NOCASE THEN 1
            ELSE 2
          END
          LIMIT 1
        `).get(name, name, name, name, name) as any
        return r ? { ...r, hasRelayRace: Boolean(r.hasRelayRace) } as CategoryType : undefined
      },
      createCategoryType: (ct) => {
        sqlite.prepare('INSERT INTO category_types (id, name, competition_class_id, has_relay_race) VALUES (?, ?, ?, ?)').run(ct.id, ct.name, ct.competitionClassId, ct.hasRelayRace ? 1 : 0)
        return ct
      },
      updateCategoryType: (id, data) => {
        const current = sqlite.prepare('SELECT id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace FROM category_types WHERE id = ?').get(id) as any
        if (!current) return undefined
        const sets: string[] = []
        const values: unknown[] = []
        if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
        if (data.competitionClassId !== undefined) { sets.push('competition_class_id = ?'); values.push(data.competitionClassId) }
        if (data.hasRelayRace !== undefined) { sets.push('has_relay_race = ?'); values.push(data.hasRelayRace ? 1 : 0) }
        if (sets.length > 0) {
          values.push(id)
          sqlite.prepare(`UPDATE category_types SET ${sets.join(', ')} WHERE id = ?`).run(...values)
        }
        const updated = sqlite.prepare('SELECT id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace FROM category_types WHERE id = ?').get(id) as any
        return updated ? { ...updated, hasRelayRace: Boolean(updated.hasRelayRace) } : undefined
      },
      deleteCategoryType: (id) => {
        const r = sqlite.prepare('DELETE FROM category_types WHERE id = ? RETURNING id, name, competition_class_id AS competitionClassId, has_relay_race AS hasRelayRace').get(id) as any
        return r ? { ...r, hasRelayRace: Boolean(r.hasRelayRace) } as CategoryType : undefined
      },
      hasEntriesForCategoryType: (ctId) => sqlite.prepare('SELECT 1 FROM category_entries WHERE category_type_id = ? LIMIT 1').get(ctId) !== undefined,
      hasEvaluationsForCategoryType: (ctId) => sqlite.prepare('SELECT 1 FROM evaluation_types WHERE category_type_id_1 = ? OR category_type_id_2 = ? LIMIT 1').get(ctId, ctId) !== undefined,
      listEvaluationTypes: () => (sqlite.prepare(`
        SELECT
          et.id, et.name,
          et.category_type_id_1 AS categoryTypeId1, ct1.name AS categoryTypeName1, ct1.has_relay_race AS hasRelayRace1, ct1.competition_class_id AS competitionClassId1,
          et.category_type_id_2 AS categoryTypeId2, ct2.name AS categoryTypeName2, ct2.has_relay_race AS hasRelayRace2, ct2.competition_class_id AS competitionClassId2,
          et.exclude_relay_race AS excludeRelayRace, et.is_brigade_pairing AS isBrigadePairing,
          et.public AS public, et.public_tv AS publicTv,
          COALESCE(et.display_duration_seconds, 10) AS displayDurationSeconds,
          COALESCE(et."order", 1) AS "order"
        FROM evaluation_types et
        JOIN category_types ct1 ON ct1.id = et.category_type_id_1
        LEFT JOIN category_types ct2 ON ct2.id = et.category_type_id_2
        ORDER BY et."order", et.name
      `).all() as any[]).map(mapEvaluationTypeRow),
      findEvaluationTypeById: (id) => {
        const row = sqlite.prepare(`
          SELECT
            et.id, et.name,
            et.category_type_id_1 AS categoryTypeId1, ct1.name AS categoryTypeName1, ct1.has_relay_race AS hasRelayRace1, ct1.competition_class_id AS competitionClassId1,
            et.category_type_id_2 AS categoryTypeId2, ct2.name AS categoryTypeName2, ct2.has_relay_race AS hasRelayRace2, ct2.competition_class_id AS competitionClassId2,
            et.exclude_relay_race AS excludeRelayRace, et.is_brigade_pairing AS isBrigadePairing,
            et.public AS public, et.public_tv AS publicTv,
            COALESCE(et.display_duration_seconds, 10) AS displayDurationSeconds,
            COALESCE(et."order", 1) AS "order"
          FROM evaluation_types et
          JOIN category_types ct1 ON ct1.id = et.category_type_id_1
          LEFT JOIN category_types ct2 ON ct2.id = et.category_type_id_2
          WHERE et.id = ?
        `).get(id) as any
        return row ? mapEvaluationTypeRow(row) : undefined
      },
      createEvaluationType: (et) => {
        sqlite.prepare(`
          INSERT INTO evaluation_types (id, name, category_type_id_1, category_type_id_2, exclude_relay_race, is_brigade_pairing, public, public_tv, display_duration_seconds, "order")
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          et.id,
          et.name,
          et.categoryTypeId1,
          et.categoryTypeId2 ?? null,
          et.excludeRelayRace ? 1 : 0,
          et.isBrigadePairing ? 1 : 0,
          et.public ? 1 : 0,
          et.publicTv ? 1 : 0,
          et.displayDurationSeconds ?? 10,
          et.order ?? 1,
        )
        const row = sqlite.prepare(`
          SELECT
            et.id, et.name,
            et.category_type_id_1 AS categoryTypeId1, ct1.name AS categoryTypeName1, ct1.has_relay_race AS hasRelayRace1, ct1.competition_class_id AS competitionClassId1,
            et.category_type_id_2 AS categoryTypeId2, ct2.name AS categoryTypeName2, ct2.has_relay_race AS hasRelayRace2, ct2.competition_class_id AS competitionClassId2,
            et.exclude_relay_race AS excludeRelayRace, et.is_brigade_pairing AS isBrigadePairing,
            et.public AS public, et.public_tv AS publicTv,
            COALESCE(et.display_duration_seconds, 10) AS displayDurationSeconds,
            COALESCE(et."order", 1) AS "order"
          FROM evaluation_types et
          JOIN category_types ct1 ON ct1.id = et.category_type_id_1
          LEFT JOIN category_types ct2 ON ct2.id = et.category_type_id_2
          WHERE et.id = ?
        `).get(et.id) as any
        return mapEvaluationTypeRow(row)
      },
      updateEvaluationType: (id, data) => {
        const current = sqlite.prepare('SELECT id FROM evaluation_types WHERE id = ?').get(id)
        if (!current) return undefined
        const sets: string[] = []
        const values: unknown[] = []
        if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
        if (data.categoryTypeId1 !== undefined) { sets.push('category_type_id_1 = ?'); values.push(data.categoryTypeId1) }
        if ('categoryTypeId2' in data) { sets.push('category_type_id_2 = ?'); values.push(data.categoryTypeId2) }
        if (data.excludeRelayRace !== undefined) { sets.push('exclude_relay_race = ?'); values.push(data.excludeRelayRace ? 1 : 0) }
        if (data.isBrigadePairing !== undefined) { sets.push('is_brigade_pairing = ?'); values.push(data.isBrigadePairing ? 1 : 0) }
        if (data.public !== undefined) { sets.push('public = ?'); values.push(data.public ? 1 : 0) }
        if (data.publicTv !== undefined) { sets.push('public_tv = ?'); values.push(data.publicTv ? 1 : 0) }
        if (data.displayDurationSeconds !== undefined) { sets.push('display_duration_seconds = ?'); values.push(data.displayDurationSeconds) }
        if (data.order !== undefined) { sets.push('"order" = ?'); values.push(data.order) }

        if (sets.length > 0) {
          values.push(id)
          sqlite.prepare(`UPDATE evaluation_types SET ${sets.join(', ')} WHERE id = ?`).run(...values)
        }
        const row = sqlite.prepare(`
          SELECT
            et.id, et.name,
            et.category_type_id_1 AS categoryTypeId1, ct1.name AS categoryTypeName1, ct1.has_relay_race AS hasRelayRace1, ct1.competition_class_id AS competitionClassId1,
            et.category_type_id_2 AS categoryTypeId2, ct2.name AS categoryTypeName2, ct2.has_relay_race AS hasRelayRace2, ct2.competition_class_id AS competitionClassId2,
            et.exclude_relay_race AS excludeRelayRace, et.is_brigade_pairing AS isBrigadePairing,
            et.public AS public, et.public_tv AS publicTv,
            COALESCE(et.display_duration_seconds, 10) AS displayDurationSeconds,
            COALESCE(et."order", 1) AS "order"
          FROM evaluation_types et
          JOIN category_types ct1 ON ct1.id = et.category_type_id_1
          LEFT JOIN category_types ct2 ON ct2.id = et.category_type_id_2
          WHERE et.id = ?
        `).get(id) as any
        return row ? mapEvaluationTypeRow(row) : undefined
      },
      deleteEvaluationType: (id) => {
        const existing = sqlite.prepare('SELECT id, name FROM evaluation_types WHERE id = ?').get(id) as { id: string; name: string } | undefined
        if (!existing) return undefined
        sqlite.prepare('DELETE FROM evaluation_types WHERE id = ?').run(id)
        return existing as any
      },
    },
    getConnectionSettings: () => ({
      busyTimeoutMilliseconds: pragmaValue(sqlite, 'busy_timeout'),
      foreignKeys: pragmaValue(sqlite, 'foreign_keys') === 1,
      journalMode: pragmaTextValue(sqlite, 'journal_mode'),
      synchronous: synchronousMode(sqlite),
    }),
    getTvRuntimeState: () => {
      const state = sqlite.prepare(`
        SELECT id, mode, selected_category_id AS selectedCategoryId, updated_at AS updatedAt
        FROM tv_runtime_state
        WHERE id = 'default'
      `).get() as TvRuntimeState | undefined
      return state
    },
    setTvRuntimeState: (state) => {
      sqlite.prepare(`UPDATE tv_runtime_state SET mode = ?, selected_category_id = ?, updated_at = ? WHERE id = 'default'`)
        .run(state.mode, state.selectedCategoryId, state.updatedAt)
      return { id: 'default', ...state }
    },
    listTables: () => sqlite.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `).all().map((row) => (row as { name: string }).name),
    transaction: (work) => sqlite.transaction(work)(),
  }
}

function pragmaValue(sqlite: Database.Database, name: string): number {
  const row = sqlite.pragma(name, { simple: true })
  if (typeof row !== 'number') {
    throw new Error(`SQLite pragma ${name} did not return a numeric value`)
  }
  return row
}

function pragmaTextValue(sqlite: Database.Database, name: string): string {
  const row = sqlite.pragma(name, { simple: true })
  if (typeof row !== 'string') {
    throw new Error(`SQLite pragma ${name} did not return a text value`)
  }
  return row
}

function synchronousMode(sqlite: Database.Database): 'full' {
  if (pragmaValue(sqlite, 'synchronous') !== 2) {
    throw new Error('SQLite synchronous mode is not FULL')
  }
  return 'full'
}
