import Database from 'better-sqlite3'
import { and, asc, count, desc, eq, like, max, ne, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { resolve } from 'node:path'

import * as schema from '../shared/db/schema.js'
import { createConfigurationRepository, type ConfigurationRepository } from './configuration.js'
import type {
  DataExportEnvelope,
  PreflightSummary,
  EntityImportCount,
} from '../shared/domain/data-management.js'
import { validateDataExportEnvelope } from '../shared/domain/data-management.js'

// ---------------------------------------------------------------------------
// Catalog constraint errors — thrown by catalog mutation methods; callers
// catch and map to HTTP responses. Exported so callers can use instanceof.
// ---------------------------------------------------------------------------

export class DuplicateCatalogItemError extends Error {
  constructor(message = 'An item with this name already exists') { super(message); this.name = 'DuplicateCatalogItemError' }
}
export class InvalidCatalogReferenceError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidCatalogReferenceError' }
}
export class CatalogItemHasEntriesError extends Error {
  constructor(message = 'Cannot delete: entries exist for this catalog item') { super(message); this.name = 'CatalogItemHasEntriesError' }
}
export class CatalogItemHasEvaluationsError extends Error {
  constructor(message = 'Cannot delete: evaluation types reference this catalog item') { super(message); this.name = 'CatalogItemHasEvaluationsError' }
}

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

export interface ResetScopes {
  categoryEntries?: boolean
  groups?: boolean
  fireBrigades?: boolean
  evaluationTypes?: boolean
  categoryTypes?: boolean
}

export interface ResetSummary {
  fireBrigadesCount?: number
  groupsCount?: number
  categoryEntriesCount?: number
  evaluationTypesCount?: number
  categoryTypesCount?: number
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
  showSingleResults: boolean
  public: boolean
  publicTv: boolean
  displayDurationSeconds: number
  order: number
}

export type EvaluationTypeWrite = Pick<
  EvaluationType,
  | 'id'
  | 'name'
  | 'categoryTypeId1'
  | 'excludeRelayRace'
  | 'public'
  | 'publicTv'
> & {
  categoryTypeId2?: string | null
  isBrigadePairing?: boolean
  showSingleResults?: boolean
  displayDurationSeconds?: number
  order?: number
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
  readonly drizzle: ReturnType<typeof drizzle<typeof schema>>
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
    listPage(page: number, limit: number, search?: string): AuditLogPage
    record(record: AuditRecord): void
  }
  clearCompetitionAndRuntime(updatedAt: number, scopes?: ResetScopes): ResetSummary
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
    /**
     * Creates a category type. Validates uniqueness and ref-integrity internally.
     * @throws {DuplicateCatalogItemError} if name already exists
     * @throws {InvalidCatalogReferenceError} if competitionClassId does not exist
     */
    createCategoryType(categoryType: CategoryType): CategoryType
    /**
     * Updates a category type. Returns undefined if id not found.
     * @throws {DuplicateCatalogItemError} if the new name conflicts with an existing type
     * @throws {InvalidCatalogReferenceError} if the new competitionClassId does not exist
     */
    updateCategoryType(id: string, data: Partial<Omit<CategoryType, 'id'>>): CategoryType | undefined
    /**
     * Deletes a category type. Returns undefined if id not found.
     * @throws {CatalogItemHasEntriesError} if entries exist for this type
     * @throws {CatalogItemHasEvaluationsError} if evaluation types reference this type
     */
    deleteCategoryType(id: string): CategoryType | undefined
    listEvaluationTypes(): EvaluationType[]
    findEvaluationTypeById(id: string): EvaluationType | undefined
    /**
     * Creates an evaluation type. Validates ref-integrity and name uniqueness internally.
     * @throws {DuplicateCatalogItemError} if name already exists
     * @throws {InvalidCatalogReferenceError} if a referenced categoryTypeId does not exist
     */
    createEvaluationType(evaluationType: EvaluationTypeWrite): EvaluationType
    /**
     * Updates an evaluation type. Returns undefined if id not found.
     * @throws {InvalidCatalogReferenceError} if a referenced categoryTypeId does not exist
     */
    updateEvaluationType(id: string, data: Partial<{
      name: string
      categoryTypeId1: string
      categoryTypeId2: string | null
      excludeRelayRace: boolean
      isBrigadePairing: boolean
      showSingleResults: boolean
      public: boolean
      publicTv: boolean
      displayDurationSeconds: number
      order: number
    }>): EvaluationType | undefined
    /** Deletes an evaluation type. Returns undefined if id not found. */
    deleteEvaluationType(id: string): EvaluationType | undefined
  }
  readonly dataManagement: {
    exportAll(): DataExportEnvelope
    preflightImport(envelope: DataExportEnvelope): PreflightSummary
    importAll(envelope: DataExportEnvelope, user: string): PreflightSummary
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
  const database = drizzle(sqlite, { schema })
  migrate(database, { migrationsFolder: resolve('server/migrations') })

  const mapEvaluationTypeRow = (
    et: typeof schema.evaluationTypes.$inferSelect,
    catMap: Map<string, typeof schema.categoryTypes.$inferSelect>
  ): EvaluationType => {
    const c1 = catMap.get(et.categoryTypeId1)
    const c2 = et.categoryTypeId2 ? catMap.get(et.categoryTypeId2) : undefined
    return {
      id: et.id,
      name: et.name,
      categoryTypeId1: et.categoryTypeId1,
      categoryTypeName1: c1?.name ?? '',
      hasRelayRace1: Boolean(c1?.hasRelayRace),
      competitionClassId1: c1?.competitionClassId ?? null,
      categoryTypeId2: et.categoryTypeId2 ?? null,
      categoryTypeName2: c2?.name ?? null,
      hasRelayRace2: Boolean(c2?.hasRelayRace),
      competitionClassId2: c2?.competitionClassId ?? null,
      excludeRelayRace: Boolean(et.excludeRelayRace),
      isBrigadePairing: Boolean(et.isBrigadePairing),
      showSingleResults: Boolean(et.showSingleResults),
      public: Boolean(et.public),
      publicTv: Boolean(et.public_tv),
      displayDurationSeconds: Number(et.displayDurationSeconds ?? 10),
      order: Number(et.order ?? 1),
    }
  }

  const self: SelfHostedDatabase = {
    drizzle: database,
    close: () => sqlite.close(),
    configuration: createConfigurationRepository(sqlite),
    administration: {
      listBrigades: () => database.select().from(schema.fireBrigades).all(),
      findDuplicateBrigade: (name, excludedId) => {
        const normalizedName = name.trim().toLocaleLowerCase('de-AT')
        return database.select().from(schema.fireBrigades).all().some(
          (brigade) => brigade.id !== excludedId && brigade.name.trim().toLocaleLowerCase('de-AT') === normalizedName,
        )
      },
      createBrigade: (brigade) => {
        database.insert(schema.fireBrigades).values({ id: brigade.id, name: brigade.name }).run()
        return brigade
      },
      updateBrigade: (id, name) => {
        const result = database.update(schema.fireBrigades).set({ name }).where(eq(schema.fireBrigades.id, id)).returning({ id: schema.fireBrigades.id, name: schema.fireBrigades.name }).get()
        return result
      },
      deleteBrigade: (id) => {
        return database.delete(schema.fireBrigades).where(eq(schema.fireBrigades.id, id)).returning({ id: schema.fireBrigades.id, name: schema.fireBrigades.name }).get()
      },
      hasGroups: (brigadeId) => {
        const row = database.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.fireBrigadeId, brigadeId)).limit(1).get()
        return row !== undefined
      },
      listGroups: () => {
        return database
          .select({
            id: schema.groups.id,
            fireBrigadeId: schema.groups.fireBrigadeId,
            name: schema.groups.name,
            competitionClassId: schema.groups.competitionClassId,
            competitionClass: schema.competitionClasses.name,
          })
          .from(schema.groups)
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .all()
      },
      createGroup: (group) => {
        database.insert(schema.groups).values({
          id: group.id,
          fireBrigadeId: group.fireBrigadeId,
          name: group.name,
          competitionClassId: group.competitionClassId,
        }).run()
        return database
          .select({
            id: schema.groups.id,
            fireBrigadeId: schema.groups.fireBrigadeId,
            name: schema.groups.name,
            competitionClassId: schema.groups.competitionClassId,
            competitionClass: schema.competitionClasses.name,
          })
          .from(schema.groups)
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .where(eq(schema.groups.id, group.id))
          .get()!
      },
      findDuplicateGroup: (group, excludedId) => {
        const conditions = [
          eq(schema.groups.fireBrigadeId, group.fireBrigadeId),
          eq(schema.groups.name, group.name),
          eq(schema.groups.competitionClassId, group.competitionClassId),
        ]
        if (excludedId !== undefined) {
          conditions.push(ne(schema.groups.id, excludedId))
        }
        const row = database.select({ id: schema.groups.id }).from(schema.groups).where(and(...conditions)).limit(1).get()
        return row !== undefined
      },
      updateGroup: (id, group) => {
        const rowsChanged = database.update(schema.groups).set({
          name: group.name,
          competitionClassId: group.competitionClassId,
        }).where(eq(schema.groups.id, id)).run().changes
        if (rowsChanged === 0) return undefined
        return database
          .select({
            id: schema.groups.id,
            fireBrigadeId: schema.groups.fireBrigadeId,
            name: schema.groups.name,
            competitionClassId: schema.groups.competitionClassId,
            competitionClass: schema.competitionClasses.name,
          })
          .from(schema.groups)
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .where(eq(schema.groups.id, id))
          .get()
      },
      deleteGroup: (id) => {
        const existing = database
          .select({
            id: schema.groups.id,
            fireBrigadeId: schema.groups.fireBrigadeId,
            name: schema.groups.name,
            competitionClassId: schema.groups.competitionClassId,
            competitionClass: schema.competitionClasses.name,
          })
          .from(schema.groups)
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .where(eq(schema.groups.id, id))
          .get()
        if (!existing) return undefined
        database.delete(schema.groups).where(eq(schema.groups.id, id)).run()
        return existing
      },
      listCompetitionClasses: () => database.select().from(schema.competitionClasses).orderBy(asc(schema.competitionClasses.name)).all(),
      findCompetitionClassByName: (name) => {
        return database
          .select()
          .from(schema.competitionClasses)
          .where(
            or(
              sql`${schema.competitionClasses.name} = ${name} COLLATE NOCASE`,
              eq(schema.competitionClasses.id, name),
              sql`replace(lower(${schema.competitionClasses.name}), ' ', '-') = lower(${name})`
            )
          )
          .get()
      },
      findCompetitionClassById: (id) => database.select().from(schema.competitionClasses).where(eq(schema.competitionClasses.id, id)).get(),
      createCompetitionClass: (cc) => {
        database.insert(schema.competitionClasses).values(cc).run()
        return cc
      },
      deleteCompetitionClass: (id) => {
        return database.delete(schema.competitionClasses).where(eq(schema.competitionClasses.id, id)).returning({ id: schema.competitionClasses.id, name: schema.competitionClasses.name }).get()
      },
      hasGroupsForCompetitionClass: (ccId) => {
        const row = database.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.competitionClassId, ccId)).limit(1).get()
        return row !== undefined
      },
    },
    audit: {
      list: () => {
        return database
          .select()
          .from(schema.auditLog)
          .orderBy(asc(schema.auditLog.timestamp), asc(schema.auditLog.id))
          .all()
          .map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            user: row.user,
            action: row.action,
            details: row.details === null ? null : JSON.parse(row.details),
          }))
      },
      listPage: (page, limit, search) => {
        const whereClause = search
          ? or(
              like(schema.auditLog.user, `%${search}%`),
              like(schema.auditLog.action, `%${search}%`),
              like(schema.auditLog.details, `%${search}%`)
            )
          : undefined
        const total = database.select({ count: count() }).from(schema.auditLog).where(whereClause).get()?.count ?? 0
        const logs = database
          .select({
            id: schema.auditLog.id,
            timestamp: schema.auditLog.timestamp,
            user: schema.auditLog.user,
            action: schema.auditLog.action,
            details: schema.auditLog.details,
          })
          .from(schema.auditLog)
          .where(whereClause)
          .orderBy(desc(schema.auditLog.timestamp), desc(schema.auditLog.id))
          .limit(limit)
          .offset((page - 1) * limit)
          .all()
        return { logs, total }
      },
      record: (record) => {
        database.insert(schema.auditLog).values({
          id: record.id,
          timestamp: record.timestamp,
          user: record.user,
          action: record.action,
          details: record.details === undefined ? null : JSON.stringify(record.details),
        }).run()
      },
    },
    clearCompetitionAndRuntime: (updatedAt, rawScopes) => {
      const scopes: Required<ResetScopes> = {
        categoryEntries: rawScopes?.categoryEntries ?? (rawScopes ? false : true),
        groups: rawScopes?.groups ?? (rawScopes ? false : true),
        fireBrigades: rawScopes?.fireBrigades ?? (rawScopes ? false : true),
        evaluationTypes: rawScopes?.evaluationTypes ?? false,
        categoryTypes: rawScopes?.categoryTypes ?? false,
      }

      if (scopes.fireBrigades) {
        scopes.groups = true
        scopes.categoryEntries = true
      }
      if (scopes.groups) {
        scopes.categoryEntries = true
      }
      if (scopes.categoryTypes) {
        scopes.evaluationTypes = true
        scopes.categoryEntries = true
      }
      if (scopes.evaluationTypes) {
        scopes.categoryEntries = true
      }

      const summary: ResetSummary = {}

      if (scopes.categoryEntries) {
        summary.categoryEntriesCount = database.select({ count: count() }).from(schema.categoryEntries).get()?.count ?? 0
        database.delete(schema.categoryEntries).run()
      }
      if (scopes.evaluationTypes) {
        summary.evaluationTypesCount = database.select({ count: count() }).from(schema.evaluationTypes).get()?.count ?? 0
        database.delete(schema.evaluationTypes).run()
      }
      if (scopes.groups) {
        summary.groupsCount = database.select({ count: count() }).from(schema.groups).get()?.count ?? 0
        database.delete(schema.groups).run()
      }
      if (scopes.fireBrigades) {
        summary.fireBrigadesCount = database.select({ count: count() }).from(schema.fireBrigades).get()?.count ?? 0
        database.delete(schema.fireBrigades).run()
      }
      if (scopes.categoryTypes) {
        summary.categoryTypesCount = database.select({ count: count() }).from(schema.categoryTypes).get()?.count ?? 0
        database.delete(schema.categoryTypes).run()
      }

      database.update(schema.tvRuntimeState).set({
        mode: 'ROTATION',
        selectedCategoryId: null,
        updatedAt,
      }).where(eq(schema.tvRuntimeState.id, 'default')).run()

      return summary
    },
    scoring: {
      listEntries: () => {
        return database
          .select({
            id: schema.categoryEntries.id,
            groupId: schema.categoryEntries.groupId,
            categoryTypeId: schema.categoryEntries.categoryTypeId,
            runStatus: schema.categoryEntries.runStatus,
            startOrderPosition: schema.categoryEntries.startOrderPosition,
            attackTimeHundredths: schema.categoryEntries.attackTimeHundredths,
            attackTimeErrors: schema.categoryEntries.attackTimeErrors,
            relayRaceHundredths: schema.categoryEntries.relayRaceHundredths,
            relayRaceErrors: schema.categoryEntries.relayRaceErrors,
            categoryTypeName: schema.categoryTypes.name,
            hasRelayRace: schema.categoryTypes.hasRelayRace,
            groupName: schema.groups.name,
            competitionClass: schema.competitionClasses.name,
            fireBrigadeId: schema.groups.fireBrigadeId,
            fireBrigadeName: schema.fireBrigades.name,
          })
          .from(schema.categoryEntries)
          .innerJoin(schema.groups, eq(schema.categoryEntries.groupId, schema.groups.id))
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .innerJoin(schema.fireBrigades, eq(schema.groups.fireBrigadeId, schema.fireBrigades.id))
          .innerJoin(schema.categoryTypes, eq(schema.categoryEntries.categoryTypeId, schema.categoryTypes.id))
          .all() as unknown as CategoryEntryDetails[]
      },
      findEntry: (id) => {
        const row = database.select().from(schema.categoryEntries).where(eq(schema.categoryEntries.id, id)).get()
        return row ? { ...row, runStatus: row.runStatus as 'OPEN' | 'VALID' | 'DNF' } : undefined
      },
      findGroup: (id) => {
        return database
          .select({
            id: schema.groups.id,
            fireBrigadeId: schema.groups.fireBrigadeId,
            name: schema.groups.name,
            competitionClassId: schema.groups.competitionClassId,
            competitionClass: schema.competitionClasses.name,
          })
          .from(schema.groups)
          .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
          .where(eq(schema.groups.id, id))
          .get()
      },
      findDuplicateEntry: (groupId, categoryTypeId) => {
        const row = database
          .select({ id: schema.categoryEntries.id })
          .from(schema.categoryEntries)
          .where(
            and(
              eq(schema.categoryEntries.groupId, groupId),
              eq(schema.categoryEntries.categoryTypeId, categoryTypeId)
            )
          )
          .limit(1)
          .get()
        return row !== undefined
      },
      nextOpenPosition: (categoryTypeId) => {
        const row = database
          .select({ maxPos: max(schema.categoryEntries.startOrderPosition) })
          .from(schema.categoryEntries)
          .where(
            and(
              eq(schema.categoryEntries.categoryTypeId, categoryTypeId),
              eq(schema.categoryEntries.runStatus, 'OPEN')
            )
          )
          .get()
        return (row?.maxPos ?? 0) + 1
      },
      createEntry: (entry) => {
        database.insert(schema.categoryEntries).values(entry).run()
      },
      updateEntry: (entry) => {
        database.update(schema.categoryEntries).set(entry).where(eq(schema.categoryEntries.id, entry.id)).run()
      },
      deleteEntry: (id) => {
        database.delete(schema.categoryEntries).where(eq(schema.categoryEntries.id, id)).run()
      },
      compactOpenEntries: (categoryTypeId, excludedId) => {
        const conditions = [
          eq(schema.categoryEntries.categoryTypeId, categoryTypeId),
          eq(schema.categoryEntries.runStatus, 'OPEN'),
        ]
        if (excludedId) {
          conditions.push(ne(schema.categoryEntries.id, excludedId))
        }
        const entries = database
          .select({ id: schema.categoryEntries.id })
          .from(schema.categoryEntries)
          .where(and(...conditions))
          .orderBy(asc(schema.categoryEntries.startOrderPosition))
          .all()
        for (let i = 0; i < entries.length; i++) {
          database
            .update(schema.categoryEntries)
            .set({ startOrderPosition: i + 1 })
            .where(eq(schema.categoryEntries.id, entries[i].id))
            .run()
        }
      },
    },
    catalog: {
      listCategoryTypes: () => database.select().from(schema.categoryTypes).orderBy(asc(schema.categoryTypes.name)).all(),
      findCategoryTypeById: (id) => database.select().from(schema.categoryTypes).where(eq(schema.categoryTypes.id, id)).get(),
      createCategoryType: (ct) => {
        if (!database.select({ id: schema.competitionClasses.id }).from(schema.competitionClasses).where(eq(schema.competitionClasses.id, ct.competitionClassId)).get()) {
          throw new InvalidCatalogReferenceError(`Competition class '${ct.competitionClassId}' not found`)
        }
        const duplicate = database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes)
          .where(sql`lower(${schema.categoryTypes.name}) = lower(${ct.name})`).limit(1).get()
        if (duplicate) throw new DuplicateCatalogItemError('A category type with this name already exists')
        sqlite.transaction(() => { database.insert(schema.categoryTypes).values(ct).run() })()
        return ct
      },
      updateCategoryType: (id, data) => {
        const current = database.select().from(schema.categoryTypes).where(eq(schema.categoryTypes.id, id)).get()
        if (!current) return undefined
        if (data.competitionClassId !== undefined && data.competitionClassId !== current.competitionClassId) {
          if (!database.select({ id: schema.competitionClasses.id }).from(schema.competitionClasses).where(eq(schema.competitionClasses.id, data.competitionClassId)).get()) {
            throw new InvalidCatalogReferenceError(`Competition class '${data.competitionClassId}' not found`)
          }
        }
        if (data.name !== undefined && data.name.trim() !== current.name) {
          const dup = database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes)
            .where(and(sql`lower(${schema.categoryTypes.name}) = lower(${data.name})`, ne(schema.categoryTypes.id, id))).limit(1).get()
          if (dup) throw new DuplicateCatalogItemError('A category type with this name already exists')
        }
        return sqlite.transaction(() =>
          database.update(schema.categoryTypes).set(data).where(eq(schema.categoryTypes.id, id)).returning().get()
        )()
      },
      deleteCategoryType: (id) => {
        const hasEntries = database.select({ id: schema.categoryEntries.id }).from(schema.categoryEntries).where(eq(schema.categoryEntries.categoryTypeId, id)).limit(1).get() !== undefined
        if (hasEntries) throw new CatalogItemHasEntriesError('Cannot delete category type with registered entries')
        const hasEvals = database.select({ id: schema.evaluationTypes.id }).from(schema.evaluationTypes)
          .where(or(eq(schema.evaluationTypes.categoryTypeId1, id), eq(schema.evaluationTypes.categoryTypeId2, id))).limit(1).get() !== undefined
        if (hasEvals) throw new CatalogItemHasEvaluationsError('Cannot delete category type referenced by evaluation types')
        return sqlite.transaction(() =>
          database.delete(schema.categoryTypes).where(eq(schema.categoryTypes.id, id)).returning().get()
        )()
      },
      listEvaluationTypes: () => {
        const rawEvalTypes = database.select().from(schema.evaluationTypes).orderBy(asc(schema.evaluationTypes.order), asc(schema.evaluationTypes.name)).all()
        const catTypes = database.select().from(schema.categoryTypes).all()
        const catMap = new Map(catTypes.map((c) => [c.id, c]))
        return rawEvalTypes.map((et) => mapEvaluationTypeRow(et, catMap))
      },
      findEvaluationTypeById: (id) => {
        const row = database.select().from(schema.evaluationTypes).where(eq(schema.evaluationTypes.id, id)).get()
        if (!row) return undefined
        const catTypes = database.select().from(schema.categoryTypes).all()
        const catMap = new Map(catTypes.map((c) => [c.id, c]))
        return mapEvaluationTypeRow(row, catMap)
      },
      createEvaluationType: (et) => {
        if (!database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes).where(eq(schema.categoryTypes.id, et.categoryTypeId1)).get()) {
          throw new InvalidCatalogReferenceError(`Category type '${et.categoryTypeId1}' not found`)
        }
        if (et.categoryTypeId2 && !database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes).where(eq(schema.categoryTypes.id, et.categoryTypeId2)).get()) {
          throw new InvalidCatalogReferenceError(`Category type '${et.categoryTypeId2}' not found`)
        }
        const dup = database.select({ id: schema.evaluationTypes.id }).from(schema.evaluationTypes)
          .where(sql`lower(${schema.evaluationTypes.name}) = lower(${et.name})`).limit(1).get()
        if (dup) throw new DuplicateCatalogItemError('An evaluation type with this name already exists')
        sqlite.transaction(() => {
          database.insert(schema.evaluationTypes).values({
            id: et.id,
            name: et.name,
            categoryTypeId1: et.categoryTypeId1,
            categoryTypeId2: et.categoryTypeId2 ?? null,
            excludeRelayRace: et.excludeRelayRace,
            isBrigadePairing: et.isBrigadePairing ?? false,
            showSingleResults: et.showSingleResults ?? false,
            public: et.public,
            public_tv: et.publicTv,
            displayDurationSeconds: et.displayDurationSeconds ?? 10,
            order: et.order ?? 1,
          }).run()
        })()
        return self.catalog.findEvaluationTypeById(et.id)!
      },
      updateEvaluationType: (id, data) => {
        const current = database.select().from(schema.evaluationTypes).where(eq(schema.evaluationTypes.id, id)).get()
        if (!current) return undefined
        if (data.categoryTypeId1 !== undefined && !database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes).where(eq(schema.categoryTypes.id, data.categoryTypeId1)).get()) {
          throw new InvalidCatalogReferenceError(`Category type '${data.categoryTypeId1}' not found`)
        }
        if (data.categoryTypeId2 !== undefined && data.categoryTypeId2 !== null && !database.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes).where(eq(schema.categoryTypes.id, data.categoryTypeId2)).get()) {
          throw new InvalidCatalogReferenceError(`Category type '${data.categoryTypeId2}' not found`)
        }
        const updateValues: Record<string, unknown> = {}
        if (data.name !== undefined) updateValues.name = data.name
        if (data.categoryTypeId1 !== undefined) updateValues.categoryTypeId1 = data.categoryTypeId1
        if ('categoryTypeId2' in data) updateValues.categoryTypeId2 = data.categoryTypeId2
        if (data.excludeRelayRace !== undefined) updateValues.excludeRelayRace = data.excludeRelayRace
        if (data.isBrigadePairing !== undefined) updateValues.isBrigadePairing = data.isBrigadePairing
        if (data.showSingleResults !== undefined) updateValues.showSingleResults = data.showSingleResults
        if (data.public !== undefined) updateValues.public = data.public
        if (data.publicTv !== undefined) updateValues.public_tv = data.publicTv
        if (data.displayDurationSeconds !== undefined) updateValues.displayDurationSeconds = data.displayDurationSeconds
        if (data.order !== undefined) updateValues.order = data.order
        if (Object.keys(updateValues).length > 0) {
          sqlite.transaction(() => {
            database.update(schema.evaluationTypes).set(updateValues).where(eq(schema.evaluationTypes.id, id)).run()
          })()
        }
        return self.catalog.findEvaluationTypeById(id)
      },
      deleteEvaluationType: (id) => {
        const existing = self.catalog.findEvaluationTypeById(id)
        if (!existing) return undefined
        sqlite.transaction(() => { database.delete(schema.evaluationTypes).where(eq(schema.evaluationTypes.id, id)).run() })()
        return existing
      },
    },
    dataManagement: {
      exportAll: (): DataExportEnvelope => {
        const appConfigRows = database.select().from(schema.appConfig).orderBy(asc(schema.appConfig.key)).all()
        const compClasses = database.select().from(schema.competitionClasses).orderBy(asc(schema.competitionClasses.id)).all()
        const brigades = database.select().from(schema.fireBrigades).orderBy(asc(schema.fireBrigades.id)).all()
        const catTypes = database.select().from(schema.categoryTypes).orderBy(asc(schema.categoryTypes.id)).all()
        const rawEvalTypes = database.select().from(schema.evaluationTypes).orderBy(asc(schema.evaluationTypes.order), asc(schema.evaluationTypes.id)).all()
        const evalTypes = rawEvalTypes.map((et) => ({
          id: et.id,
          name: et.name,
          categoryTypeId1: et.categoryTypeId1,
          categoryTypeId2: et.categoryTypeId2,
          excludeRelayRace: et.excludeRelayRace,
          isBrigadePairing: et.isBrigadePairing,
          showSingleResults: et.showSingleResults,
          public: et.public,
          publicTv: et.public_tv,
          displayDurationSeconds: et.displayDurationSeconds,
          order: et.order,
        }))
        const grps = database.select().from(schema.groups).orderBy(asc(schema.groups.id)).all()
        const entries = database.select().from(schema.categoryEntries).orderBy(asc(schema.categoryEntries.id)).all().map((e) => ({
          id: e.id,
          groupId: e.groupId,
          categoryTypeId: e.categoryTypeId,
          runStatus: e.runStatus as 'OPEN' | 'VALID' | 'DNF',
          startOrderPosition: e.startOrderPosition,
          attackTimeHundredths: e.attackTimeHundredths,
          attackTimeErrors: e.attackTimeErrors,
          relayRaceHundredths: e.relayRaceHundredths,
          relayRaceErrors: e.relayRaceErrors,
        }))

        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          appVersion: '1.0.0',
          data: {
            appConfig: appConfigRows,
            competitionClasses: compClasses,
            fireBrigades: brigades,
            categoryTypes: catTypes,
            evaluationTypes: evalTypes,
            groups: grps,
            categoryEntries: entries,
          },
        }
      },
      preflightImport: (envelope: DataExportEnvelope): PreflightSummary => {
        const validation = validateDataExportEnvelope(envelope)
        if (!validation.isValid || !validation.envelope) {
          return {
            isValid: false,
            errors: validation.errors,
            summary: {
              appConfig: { total: 0, toInsert: 0, toUpdate: 0 },
              competitionClasses: { total: 0, toInsert: 0, toUpdate: 0 },
              fireBrigades: { total: 0, toInsert: 0, toUpdate: 0 },
              categoryTypes: { total: 0, toInsert: 0, toUpdate: 0 },
              evaluationTypes: { total: 0, toInsert: 0, toUpdate: 0 },
              groups: { total: 0, toInsert: 0, toUpdate: 0 },
              categoryEntries: { total: 0, toInsert: 0, toUpdate: 0 },
            },
            totalEntities: 0,
          }
        }

        const data = validation.envelope.data

        const countTable = (
          items: any[],
          table: any,
          pkCol: any,
          itemKey: (item: any) => string = (item) => item.id
        ): EntityImportCount => {
          let toUpdate = 0
          let toInsert = 0
          for (const item of items) {
            const keyVal = itemKey(item)
            const exists = database.select({ id: pkCol }).from(table).where(eq(pkCol, keyVal)).limit(1).get() !== undefined
            if (exists) {
              toUpdate++
            } else {
              toInsert++
            }
          }
          return { total: items.length, toInsert, toUpdate }
        }

        const summary = {
          appConfig: countTable(data.appConfig, schema.appConfig, schema.appConfig.key, (item) => item.key),
          competitionClasses: countTable(data.competitionClasses, schema.competitionClasses, schema.competitionClasses.id),
          fireBrigades: countTable(data.fireBrigades, schema.fireBrigades, schema.fireBrigades.id),
          categoryTypes: countTable(data.categoryTypes, schema.categoryTypes, schema.categoryTypes.id),
          evaluationTypes: countTable(data.evaluationTypes, schema.evaluationTypes, schema.evaluationTypes.id),
          groups: countTable(data.groups, schema.groups, schema.groups.id),
          categoryEntries: countTable(data.categoryEntries, schema.categoryEntries, schema.categoryEntries.id),
        }

        const totalEntities = Object.values(summary).reduce((sum, item) => sum + item.total, 0)

        return {
          isValid: true,
          errors: [],
          summary,
          totalEntities,
        }
      },
      importAll: (envelope: DataExportEnvelope, user: string): PreflightSummary => {
        const preflight = self.dataManagement.preflightImport(envelope)
        if (!preflight.isValid || !envelope.data) {
          throw new Error(`Ungültige Importdaten: ${preflight.errors.join('; ')}`)
        }

        const data = envelope.data

        sqlite.transaction(() => {
          // 1. app_config
          for (const item of data.appConfig) {
            database.insert(schema.appConfig).values({
              key: item.key,
              valueJson: item.valueJson,
              updatedAt: item.updatedAt ?? Date.now(),
            }).onConflictDoUpdate({
              target: schema.appConfig.key,
              set: {
                valueJson: item.valueJson,
                updatedAt: item.updatedAt ?? Date.now(),
              },
            }).run()
          }

          // 2. competition_classes
          for (const item of data.competitionClasses) {
            database.insert(schema.competitionClasses).values({
              id: item.id,
              name: item.name,
            }).onConflictDoUpdate({
              target: schema.competitionClasses.id,
              set: { name: item.name },
            }).run()
          }

          // 3. fire_brigades
          for (const item of data.fireBrigades) {
            database.insert(schema.fireBrigades).values({
              id: item.id,
              name: item.name,
            }).onConflictDoUpdate({
              target: schema.fireBrigades.id,
              set: { name: item.name },
            }).run()
          }

          // 4. category_types
          for (const item of data.categoryTypes) {
            database.insert(schema.categoryTypes).values({
              id: item.id,
              name: item.name,
              competitionClassId: item.competitionClassId,
              hasRelayRace: item.hasRelayRace,
            }).onConflictDoUpdate({
              target: schema.categoryTypes.id,
              set: {
                name: item.name,
                competitionClassId: item.competitionClassId,
                hasRelayRace: item.hasRelayRace,
              },
            }).run()
          }

          // 5. evaluation_types
          for (const item of data.evaluationTypes) {
            const publicTv = item.publicTv !== undefined ? item.publicTv : item.public_tv
            const showSingleResults = item.showSingleResults !== undefined
              ? item.showSingleResults
              : Boolean(item.show_single_results)
            database.insert(schema.evaluationTypes).values({
              id: item.id,
              name: item.name,
              categoryTypeId1: item.categoryTypeId1,
              categoryTypeId2: item.categoryTypeId2 ?? null,
              excludeRelayRace: item.excludeRelayRace,
              isBrigadePairing: item.isBrigadePairing,
              showSingleResults,
              public: item.public !== false,
              public_tv: publicTv !== false,
              displayDurationSeconds: item.displayDurationSeconds ?? 10,
              order: item.order ?? 1,
            }).onConflictDoUpdate({
              target: schema.evaluationTypes.id,
              set: {
                name: item.name,
                categoryTypeId1: item.categoryTypeId1,
                categoryTypeId2: item.categoryTypeId2 ?? null,
                excludeRelayRace: item.excludeRelayRace,
                isBrigadePairing: item.isBrigadePairing,
                showSingleResults,
                public: item.public !== false,
                public_tv: publicTv !== false,
                displayDurationSeconds: item.displayDurationSeconds ?? 10,
                order: item.order ?? 1,
              },
            }).run()
          }

          // 6. groups
          for (const item of data.groups) {
            database.insert(schema.groups).values({
              id: item.id,
              fireBrigadeId: item.fireBrigadeId,
              competitionClassId: item.competitionClassId,
              name: item.name,
            }).onConflictDoUpdate({
              target: schema.groups.id,
              set: {
                fireBrigadeId: item.fireBrigadeId,
                competitionClassId: item.competitionClassId,
                name: item.name,
              },
            }).run()
          }

          // 7. category_entries
          for (const item of data.categoryEntries) {
            database.insert(schema.categoryEntries).values({
              id: item.id,
              groupId: item.groupId,
              categoryTypeId: item.categoryTypeId,
              runStatus: item.runStatus ?? 'OPEN',
              startOrderPosition: item.startOrderPosition ?? null,
              attackTimeHundredths: item.attackTimeHundredths ?? null,
              attackTimeErrors: item.attackTimeErrors ?? null,
              relayRaceHundredths: item.relayRaceHundredths ?? null,
              relayRaceErrors: item.relayRaceErrors ?? null,
            }).onConflictDoUpdate({
              target: schema.categoryEntries.id,
              set: {
                groupId: item.groupId,
                categoryTypeId: item.categoryTypeId,
                runStatus: item.runStatus ?? 'OPEN',
                startOrderPosition: item.startOrderPosition ?? null,
                attackTimeHundredths: item.attackTimeHundredths ?? null,
                attackTimeErrors: item.attackTimeErrors ?? null,
                relayRaceHundredths: item.relayRaceHundredths ?? null,
                relayRaceErrors: item.relayRaceErrors ?? null,
              },
            }).run()
          }

          // 8. Record DATA_IMPORT in audit log
          const timestamp = Date.now()
          database.insert(schema.auditLog).values({
            id: crypto.randomUUID(),
            timestamp,
            user,
            action: 'DATA_IMPORT',
            details: JSON.stringify({
              summary: preflight.summary,
              totalEntities: preflight.totalEntities,
              importedAt: new Date(timestamp).toISOString(),
            }),
          }).run()
        })()

        return preflight
      },
    },
    getConnectionSettings: () => ({
      busyTimeoutMilliseconds: pragmaValue(sqlite, 'busy_timeout'),
      foreignKeys: pragmaValue(sqlite, 'foreign_keys') === 1,
      journalMode: pragmaTextValue(sqlite, 'journal_mode'),
      synchronous: synchronousMode(sqlite),
    }),
    getTvRuntimeState: () => {
      const state = database.select().from(schema.tvRuntimeState).where(eq(schema.tvRuntimeState.id, 'default')).get()
      return state as TvRuntimeState | undefined
    },
    setTvRuntimeState: (state) => {
      database.update(schema.tvRuntimeState).set({
        mode: state.mode,
        selectedCategoryId: state.selectedCategoryId,
        updatedAt: state.updatedAt,
      }).where(eq(schema.tvRuntimeState.id, 'default')).run()
      return { id: 'default', ...state }
    },
    listTables: () => {
      const rows = sqlite.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
      `).all() as Array<{ name: string }>
      return rows.map((row) => row.name)
    },
    transaction: (work) => sqlite.transaction(work)(),
  }

  return self
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
