import type { Context, Hono } from 'hono'

import { computeEntryScore } from '../shared/domain/scoring.js'
import { buildCategoriesResultMap } from '../shared/api-mappers/results-builder.js'
import { createEvaluationTypeViews } from '../shared/seed/seed-data.js'
import { parseGermanTimeToHundredths } from '../shared/utils/time-parser.js'
import type { CategoryEntry, SelfHostedDatabase } from './database.js'
import type { SelfHostedAppEnvironment } from './app.js'

export function registerScoringRoutes(app: Hono<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  // Category Types CRUD
  app.get('/api/admin/category-types', (context) => context.json(database.catalog.listCategoryTypes()))

  app.post('/api/admin/category-types', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      if (!nonEmpty(body.name)) return error(context, 'Name is required and must be a string', 400)
      if (!nonEmpty(body.competitionClassId)) return error(context, 'competitionClassId is required', 400)
      const name = body.name as string
      const competitionClassId = body.competitionClassId as string
      const id = (typeof body.id === 'string' && body.id.trim()) ? body.id.trim() : crypto.randomUUID()
      const hasRelayRace = typeof body.hasRelayRace === 'boolean' ? body.hasRelayRace : true

      const categoryType = database.transaction(() => {
        if (!database.administration.findCompetitionClassById(competitionClassId)) {
          throw new InvalidCompetitionClassReferenceError(`Competition class '${competitionClassId}' not found`)
        }
        if (database.catalog.findCategoryTypeByName(name)) {
          throw new DuplicateCategoryTypeError()
        }
        const created = database.catalog.createCategoryType({ id, name, competitionClassId, hasRelayRace })
        audit(database, context, 'CREATE_CATEGORY_TYPE', created)
        return created
      })
      return context.json(categoryType, 201)
    } catch (exception) {
      if (exception instanceof DuplicateCategoryTypeError) return error(context, 'A category type with this name already exists', 409)
      if (exception instanceof InvalidCompetitionClassReferenceError) return error(context, exception.message, 400)
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  app.put('/api/admin/category-types/:id', async (context) => {
    try {
      const id = context.req.param('id')
      const body = await context.req.json() as Record<string, unknown>
      if (body.name !== undefined && !nonEmpty(body.name)) {
        return error(context, 'Name cannot be empty', 400)
      }

      const updated = database.transaction(() => {
        const existing = database.catalog.findCategoryTypeById(id)
        if (!existing) return undefined

        if (typeof body.name === 'string' && body.name.trim() !== existing.name) {
          const duplicate = database.catalog.findCategoryTypeByName(body.name.trim())
          if (duplicate && duplicate.id !== id) {
            throw new DuplicateCategoryTypeError()
          }
        }

        const payload: Parameters<typeof database.catalog.updateCategoryType>[1] = {}
        if (typeof body.name === 'string' && body.name.trim()) payload.name = body.name.trim()
        if (typeof body.hasRelayRace === 'boolean') payload.hasRelayRace = body.hasRelayRace
        if (nonEmpty(body.competitionClassId)) {
          if (!database.administration.findCompetitionClassById(body.competitionClassId as string)) {
            throw new InvalidCompetitionClassReferenceError(`Competition class '${body.competitionClassId}' not found`)
          }
          payload.competitionClassId = body.competitionClassId as string
        }

        const result = database.catalog.updateCategoryType(id, payload)
        if (result) audit(database, context, 'UPDATE_CATEGORY_TYPE', { id, ...payload })
        return result
      })
      return updated ? context.json(updated) : error(context, 'Category type not found', 404)
    } catch (exception) {
      if (exception instanceof DuplicateCategoryTypeError) return error(context, 'A category type with this name already exists', 409)
      if (exception instanceof InvalidCompetitionClassReferenceError) return error(context, exception.message, 400)
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  app.delete('/api/admin/category-types/:id', (context) => {
    try {
      const id = context.req.param('id')
      const outcome = database.transaction(() => {
        if (database.catalog.hasEntriesForCategoryType(id)) return 'has-entries' as const
        if (database.catalog.hasEvaluationsForCategoryType(id)) return 'has-evaluations' as const
        const deleted = database.catalog.deleteCategoryType(id)
        if (!deleted) return undefined
        audit(database, context, 'DELETE_CATEGORY_TYPE', { id, name: deleted.name })
        return deleted
      })
      if (outcome === 'has-entries') return error(context, 'Cannot delete category type with registered entries', 400)
      if (outcome === 'has-evaluations') return error(context, 'Cannot delete category type referenced by evaluation types', 400)
      return outcome ? context.json({ success: true, deletedId: id }) : error(context, 'Category type not found', 404)
    } catch (exception) {
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  // Evaluation Types CRUD
  app.get('/api/admin/evaluation-types', (context) => context.json(database.catalog.listEvaluationTypes()))

  app.post('/api/admin/evaluation-types', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      if (!nonEmpty(body.name)) return error(context, 'Name is required and must be a string', 400)
      if (!nonEmpty(body.categoryTypeId1)) return error(context, 'categoryTypeId1 is required', 400)

      const name = body.name as string
      const categoryTypeId1 = body.categoryTypeId1 as string
      const categoryTypeId2 = nonEmpty(body.categoryTypeId2) ? body.categoryTypeId2 as string : null
      const id = (typeof body.id === 'string' && body.id.trim()) ? body.id.trim() : crypto.randomUUID()
      const excludeRelayRace = typeof body.excludeRelayRace === 'boolean' ? body.excludeRelayRace : false
      const isBrigadePairing = Boolean(categoryTypeId2) && typeof body.isBrigadePairing === 'boolean' ? body.isBrigadePairing : false
      const publicVisibility = typeof body.public === 'boolean' ? body.public : true
      const publicTvVisibility = typeof body.publicTv === 'boolean' ? body.publicTv : (typeof body.public_tv === 'boolean' ? body.public_tv : true)
      const displayDurationSeconds = typeof body.displayDurationSeconds === 'number' && Number.isInteger(body.displayDurationSeconds) && body.displayDurationSeconds > 0
        ? body.displayDurationSeconds
        : 10
      const order = typeof body.order === 'number' && Number.isInteger(body.order) ? body.order : 1

      const evaluationType = database.transaction(() => {
        if (!database.catalog.findCategoryTypeById(categoryTypeId1)) {
          throw new InvalidCategoryReferenceError(`Category type '${categoryTypeId1}' not found`)
        }
        if (categoryTypeId2 && !database.catalog.findCategoryTypeById(categoryTypeId2)) {
          throw new InvalidCategoryReferenceError(`Category type '${categoryTypeId2}' not found`)
        }
        const existing = database.catalog.listEvaluationTypes().find((e) => e.name.toLowerCase() === name.toLowerCase())
        if (existing) throw new DuplicateEvaluationTypeError()

        const created = database.catalog.createEvaluationType({
          id,
          name,
          categoryTypeId1,
          categoryTypeId2,
          excludeRelayRace,
          isBrigadePairing,
          public: publicVisibility,
          publicTv: publicTvVisibility,
          displayDurationSeconds,
          order,
        })
        audit(database, context, 'CREATE_EVALUATION_TYPE', created)
        return created
      })
      return context.json(evaluationType, 201)
    } catch (exception) {
      if (exception instanceof DuplicateEvaluationTypeError) return error(context, 'An evaluation type with this name already exists', 409)
      if (exception instanceof InvalidCategoryReferenceError) return error(context, exception.message, 400)
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  app.put('/api/admin/evaluation-types/:id', async (context) => {
    try {
      const id = context.req.param('id')
      const body = await context.req.json() as Record<string, unknown>
      const updated = database.transaction(() => {
        const existing = database.catalog.findEvaluationTypeById(id)
        if (!existing) return undefined

        if (nonEmpty(body.categoryTypeId1) && !database.catalog.findCategoryTypeById(body.categoryTypeId1 as string)) {
          throw new InvalidCategoryReferenceError(`Category type '${body.categoryTypeId1}' not found`)
        }
        if (nonEmpty(body.categoryTypeId2) && !database.catalog.findCategoryTypeById(body.categoryTypeId2 as string)) {
          throw new InvalidCategoryReferenceError(`Category type '${body.categoryTypeId2}' not found`)
        }

        const payload: Parameters<typeof database.catalog.updateEvaluationType>[1] = {}
        if (typeof body.name === 'string' && body.name.trim()) payload.name = body.name.trim()
        if (typeof body.categoryTypeId1 === 'string' && body.categoryTypeId1.trim()) payload.categoryTypeId1 = body.categoryTypeId1.trim()
        if ('categoryTypeId2' in body) payload.categoryTypeId2 = nonEmpty(body.categoryTypeId2) ? body.categoryTypeId2 as string : null
        if (typeof body.excludeRelayRace === 'boolean') payload.excludeRelayRace = body.excludeRelayRace
        if (typeof body.public === 'boolean') payload.public = body.public
        if (typeof body.publicTv === 'boolean') payload.publicTv = body.publicTv
        if (typeof body.public_tv === 'boolean') payload.publicTv = body.public_tv
        if (typeof body.displayDurationSeconds === 'number' && Number.isInteger(body.displayDurationSeconds) && body.displayDurationSeconds > 0) {
          payload.displayDurationSeconds = body.displayDurationSeconds
        }
        if (typeof body.order === 'number' && Number.isInteger(body.order)) payload.order = body.order

        const result = database.catalog.updateEvaluationType(id, payload)
        if (result) audit(database, context, 'UPDATE_EVALUATION_TYPE', { id, ...payload })
        return result
      })
      return updated ? context.json(updated) : error(context, 'Evaluation type not found', 404)
    } catch (exception) {
      if (exception instanceof InvalidCategoryReferenceError) return error(context, exception.message, 400)
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  app.delete('/api/admin/evaluation-types/:id', (context) => {
    try {
      const id = context.req.param('id')
      const outcome = database.transaction(() => {
        const deleted = database.catalog.deleteEvaluationType(id)
        if (!deleted) return undefined
        audit(database, context, 'DELETE_EVALUATION_TYPE', { id, name: deleted.name })
        return deleted
      })
      return outcome ? context.json({ success: true, deletedId: id }) : error(context, 'Evaluation type not found', 404)
    } catch (exception) {
      return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
    }
  })

  app.get('/api/admin/category-entries', (context) => context.json(database.scoring.listEntries()))

  app.post('/api/admin/category-entries', async (context) => {
    const body = await context.req.json() as Record<string, unknown>
    if (!nonEmpty(body.groupId) || !nonEmpty(body.categoryTypeId)) return error(context, 'Missing groupId or categoryTypeId', 400)
    const groupId = body.groupId
    const categoryTypeId = body.categoryTypeId

    const result = database.transaction(() => {
      const group = database.scoring.findGroup(groupId)
      if (!group) return { error: 'Group not found', status: 404 }

      const categoryType = database.catalog.findCategoryTypeById(categoryTypeId)
      if (!categoryType) return { error: `Unknown category type '${categoryTypeId}'`, status: 400 }

      if (categoryType.competitionClassId !== group.competitionClassId) {
        return { error: `Incompatible category type '${categoryType.name}' for group type '${group.competitionClass}'`, status: 400 }
      }

      if (database.scoring.findDuplicateEntry(groupId, categoryType.id)) return { error: 'Group is already registered in this category', status: 409 }

      const id = crypto.randomUUID()
      database.scoring.createEntry({
        id,
        groupId,
        categoryTypeId: categoryType.id,
        runStatus: 'OPEN',
        startOrderPosition: database.scoring.nextOpenPosition(categoryType.id),
        attackTimeHundredths: null,
        attackTimeErrors: null,
        relayRaceHundredths: null,
        relayRaceErrors: null,
      })
      audit(database, context, 'CREATE_CATEGORY_ENTRY', { entryId: id, groupId, categoryTypeId: categoryType.id })
      return { id }
    })
    return 'error' in result ? error(context, result.error ?? 'Internal Server Error', result.status ?? 500) : context.json({ message: 'Category entry added successfully', id: result.id }, 201)
  })

  app.post('/api/admin/category-entries/reorder', async (context) => {
    const body = await context.req.json() as { categoryTypeId?: unknown, orderedIds?: unknown }
    if (!nonEmpty(body.categoryTypeId) || !Array.isArray(body.orderedIds) || body.orderedIds.length === 0 || !body.orderedIds.every(nonEmpty)) return error(context, 'Missing categoryTypeId or orderedIds array', 400)
    const categoryTypeId = body.categoryTypeId
    const orderedIds = body.orderedIds

    const categoryType = database.catalog.findCategoryTypeById(categoryTypeId)
    if (!categoryType) return error(context, `Unknown category type '${categoryTypeId}'`, 400)

    const entries = database.scoring.listEntries().filter((entry) => orderedIds.includes(entry.id))
    if (entries.length !== orderedIds.length || entries.some((entry) => entry.categoryTypeId !== categoryType.id)) return error(context, 'Some entries were not found in this category', 400)
    if (entries.some((entry) => entry.runStatus !== 'OPEN')) return error(context, 'Can only reorder OPEN entries', 400)

    database.transaction(() => {
      orderedIds.forEach((id, index) => { const entry = database.scoring.findEntry(id)!; database.scoring.updateEntry({ ...entry, startOrderPosition: index + 1 }) })
      audit(database, context, 'REORDER_CATEGORY_ENTRIES', { categoryTypeId: categoryType.id, count: orderedIds.length })
    })
    return context.json({ message: 'Start order reordered successfully' })
  })

  app.put('/api/admin/category-entries/:id', (context) => updateEntry(context, database))
  app.patch('/api/admin/category-entries/:id', (context) => updateEntry(context, database))

  app.delete('/api/admin/category-entries/:id', (context) => {
    const entry = database.scoring.findEntry(context.req.param('id') ?? '')
    if (!entry) return error(context, 'Category entry not found', 404)
    if (entry.runStatus !== 'OPEN') return error(context, 'Only OPEN entries can be removed', 400)
    database.transaction(() => {
      database.scoring.deleteEntry(entry.id)
      database.scoring.compactOpenEntries(entry.categoryTypeId)
      audit(database, context, 'DELETE_CATEGORY_ENTRY', { entryId: entry.id, categoryTypeId: entry.categoryTypeId, groupId: entry.groupId })
    })
    return context.json({ message: 'Category entry removed successfully' })
  })

  app.get('/api/public/results', (context) => {
    try {
      return context.json(publicResults(database))
    } catch (e) {
      console.error('ERROR in publicResults:', e)
      return error(context, e instanceof Error ? e.message : 'Internal Server Error', 500)
    }
  })
}

async function updateEntry(context: Context<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  const existing = database.scoring.findEntry(context.req.param('id') ?? '')
  if (!existing) return error(context, 'Category entry not found', 404)
  const body = await context.req.json() as Record<string, unknown>

  // Attack time
  let attackTime = existing.attackTimeHundredths
  if ('attackTimeStr' in body) {
    attackTime = (body.attackTimeStr === null || (typeof body.attackTimeStr === 'string' && body.attackTimeStr.trim() === ''))
      ? null
      : typeof body.attackTimeStr === 'string' ? parseGermanTimeToHundredths(body.attackTimeStr) : null
    if (attackTime === null && body.attackTimeStr && !(typeof body.attackTimeStr === 'string' && body.attackTimeStr.trim() === '')) {
      return error(context, 'Invalid German decimal time format. Example valid inputs: 42, 42,3, 42,38 (0.01 to 999.99)', 400)
    }
  } else if ('attackTimeHundredths' in body) {
    attackTime = typeof body.attackTimeHundredths === 'number' ? body.attackTimeHundredths : null
  }

  // Attack errors
  let attackErrors = existing.attackTimeErrors
  if ('errors' in body) {
    attackErrors = (body.errors === null || (typeof body.errors === 'string' && body.errors.trim() === '')) ? null : Number(body.errors)
    if (attackErrors !== null && (!Number.isInteger(attackErrors) || attackErrors < 0)) return error(context, 'Error count must be a non-negative integer', 400)
  } else if ('attackTimeErrors' in body) {
    attackErrors = (body.attackTimeErrors === null || (typeof body.attackTimeErrors === 'string' && (body.attackTimeErrors as string).trim() === '')) ? null : Number(body.attackTimeErrors)
    if (attackErrors !== null && (!Number.isInteger(attackErrors) || attackErrors < 0)) return error(context, 'Error count must be a non-negative integer', 400)
  }

  // Relay race fields
  let relayHundredths = existing.relayRaceHundredths
  if ('relayRaceHundredths' in body) {
    relayHundredths = typeof body.relayRaceHundredths === 'number' ? body.relayRaceHundredths : null
  }
  let relayErrors = existing.relayRaceErrors
  if ('relayRaceErrors' in body) {
    relayErrors = (body.relayRaceErrors === null || (typeof body.relayRaceErrors === 'string' && (body.relayRaceErrors as string).trim() === '')) ? null : Number(body.relayRaceErrors)
    if (relayErrors !== null && (!Number.isInteger(relayErrors) || relayErrors < 0)) return error(context, 'Relay error count must be a non-negative integer', 400)
  }

  // Run status — look up the category type to know the relay descriptor for auto-promotion
  let runStatus = existing.runStatus
  const categoryType = database.catalog.listCategoryTypes().find((ct) => ct.id === existing.categoryTypeId)
  if ('runStatus' in body) {
    if (!['OPEN', 'VALID', 'DNF'].includes(body.runStatus as string)) return error(context, 'Invalid runStatus value', 400)
    runStatus = body.runStatus as CategoryEntry['runStatus']
  } else if (runStatus === 'OPEN' && attackTime !== null && attackErrors !== null) {
    // Auto-promote to VALID when all required fields are present
    const needsRelay = categoryType?.hasRelayRace ?? false
    const hasRelay = relayHundredths !== null && relayErrors !== null
    if (!needsRelay || hasRelay) {
      runStatus = 'VALID'
    }
  }

  const next: CategoryEntry = {
    ...existing,
    attackTimeHundredths: attackTime,
    attackTimeErrors: attackErrors,
    relayRaceHundredths: relayHundredths,
    relayRaceErrors: relayErrors,
    runStatus,
    startOrderPosition: runStatus === 'OPEN'
      ? (existing.runStatus === 'OPEN' ? existing.startOrderPosition : database.scoring.nextOpenPosition(existing.categoryTypeId))
      : null,
  }

  // Compute score for the response (not stored; computed on-the-fly for display)
  const scoreHundredths = runStatus === 'VALID' && attackTime !== null && attackErrors !== null
    ? computeEntryScore(
        { attackTimeHundredths: attackTime, attackTimeErrors: attackErrors, relayRaceHundredths: relayHundredths, relayRaceErrors: relayErrors },
        { hasRelayRace: categoryType?.hasRelayRace ?? false, excludeRelayRace: false },
      )
    : null

  database.transaction(() => {
    database.scoring.updateEntry(next)
    if (existing.runStatus === 'OPEN' && runStatus !== 'OPEN') database.scoring.compactOpenEntries(existing.categoryTypeId, existing.id)
    audit(database, context, 'UPDATE', { operation: 'UPDATE', previous_value: existing, new_value: next })
  })
  return context.json({ message: 'Category entry updated successfully', entry: { ...next, scoreHundredths } })
}

function publicResults(database: SelfHostedDatabase) {
  const allEntries = database.scoring.listEntries()
  const configuration = database.configuration.read()
  const evaluationTypes = database.catalog.listEvaluationTypes()

  const categories = buildCategoriesResultMap(
    evaluationTypes.length > 0 ? evaluationTypes : createEvaluationTypeViews(),
    allEntries,
  )

  return { eventTitle: configuration.eventName, publicUrl: configuration.publicUrl, timestamp: Date.now(), categories }
}

function audit(database: SelfHostedDatabase, context: Context<SelfHostedAppEnvironment>, action: string, details: unknown) {
  database.audit.record({ id: crypto.randomUUID(), timestamp: Date.now(), user: context.get('adminUser') ?? 'system', action, details })
}
function nonEmpty(value: unknown): value is string { return typeof value === 'string' && value.length > 0 }
function error(context: Context<SelfHostedAppEnvironment>, message: string, status: number) { return context.json({ error: message }, status as never) }

class DuplicateCategoryTypeError extends Error {}
class InvalidCompetitionClassReferenceError extends Error {}
class DuplicateEvaluationTypeError extends Error {}
class InvalidCategoryReferenceError extends Error {}
