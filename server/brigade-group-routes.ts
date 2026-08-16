import type { Context, Hono } from 'hono'

import type { SelfHostedAppEnvironment } from './app.js'
import type { GroupWrite, SelfHostedDatabase } from './database.js'

const DUPLICATE_GROUP_ERROR = 'A group with this name and competition class already exists in the selected fire brigade'
const DUPLICATE_BRIGADE_ERROR = 'Eine Feuerwehr mit diesem Namen ist bereits vorhanden.'

export function registerBrigadeAndGroupRoutes(app: Hono<SelfHostedAppEnvironment>, database: SelfHostedDatabase) {
  app.get('/api/admin/competition-classes', (context) => context.json(database.administration.listCompetitionClasses()))
  app.post('/api/admin/competition-classes', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      if (!nonEmptyString(body.name)) return error(context, 'Name is required and must be a string', 400)
      const name = body.name
      const id = (typeof body.id === 'string' && body.id.trim()) ? body.id.trim() : crypto.randomUUID()
      const competitionClass = database.transaction(() => {
        if (database.administration.findCompetitionClassByName(name)) {
          throw new DuplicateCompetitionClassError()
        }
        const created = database.administration.createCompetitionClass({ id, name })
        recordAudit(database, context.get('adminUser'), 'CREATE_COMPETITION_CLASS', created)
        return created
      })
      return context.json(competitionClass, 201)
    } catch (exception) {
      if (exception instanceof DuplicateCompetitionClassError) return error(context, 'A competition class with this name already exists', 409)
      return exceptionResponse(context, exception)
    }
  })
  app.delete('/api/admin/competition-classes/:id', (context) => {
    try {
      const id = context.req.param('id')
      const outcome = database.transaction(() => {
        if (database.administration.hasGroupsForCompetitionClass(id)) return 'has-groups' as const
        const deleted = database.administration.deleteCompetitionClass(id)
        if (!deleted) return undefined
        recordAudit(database, context.get('adminUser'), 'DELETE_COMPETITION_CLASS', { id, name: deleted.name })
        return deleted
      })
      if (outcome === 'has-groups') return error(context, 'Cannot delete competition class assigned to groups', 400)
      return outcome ? context.json({ success: true, deletedId: id }) : error(context, 'Competition class not found', 404)
    } catch (exception) { return exceptionResponse(context, exception) }
  })

  app.get('/api/admin/brigades', (context) => context.json(database.administration.listBrigades()))
  app.post('/api/admin/brigades', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      if (!nonEmptyString(body.name)) return error(context, 'Name is required and must be a string', 400)
      const name = body.name.trim()
      if (!name) return error(context, 'Name is required and must be a string', 400)
      const brigade = database.transaction(() => {
        if (database.administration.findDuplicateBrigade(name)) throw new DuplicateBrigadeError()
        const created = database.administration.createBrigade({ id: crypto.randomUUID(), name })
        recordAudit(database, context.get('adminUser'), 'CREATE_BRIGADE', created)
        return created
      })
      return context.json(brigade, 201)
    } catch (exception) { return exceptionResponse(context, exception) }
  })
  app.put('/api/admin/brigades/:id', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      if (!nonEmptyString(body.name)) return error(context, 'Name is required and must be a string', 400)
      const name = body.name.trim()
      if (!name) return error(context, 'Name is required and must be a string', 400)
      const id = context.req.param('id')
      const brigade = database.transaction(() => {
        if (database.administration.findDuplicateBrigade(name, id)) throw new DuplicateBrigadeError()
        const updated = database.administration.updateBrigade(id, name)
        if (!updated) return undefined
        recordAudit(database, context.get('adminUser'), 'UPDATE_BRIGADE', { id: updated.id, name })
        return updated
      })
      return brigade ? context.json(brigade) : error(context, 'Fire brigade not found', 404)
    } catch (exception) { return exceptionResponse(context, exception) }
  })
  app.delete('/api/admin/brigades/:id', (context) => {
    try {
      const id = context.req.param('id')
      const outcome = database.transaction(() => {
        if (database.administration.hasGroups(id)) return 'has-groups' as const
        const deleted = database.administration.deleteBrigade(id)
        if (!deleted) return undefined
        recordAudit(database, context.get('adminUser'), 'DELETE_BRIGADE', { id, name: deleted.name })
        return deleted
      })
      if (outcome === 'has-groups') return error(context, 'Cannot delete fire brigade with registered groups', 400)
      return outcome ? context.json({ success: true, deletedId: id }) : error(context, 'Fire brigade not found', 404)
    } catch (exception) { return exceptionResponse(context, exception) }
  })

  app.get('/api/admin/groups', (context) => context.json(database.administration.listGroups()))
  app.post('/api/admin/groups', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      const validation = groupValidation(body, true, database)
      if (validation) return error(context, validation, 400)
      const group = database.transaction(() => {
        const candidate = groupFrom(body)
        if (database.administration.findDuplicateGroup(candidate)) throw new DuplicateGroupError()
        const created = database.administration.createGroup(candidate)
        recordAudit(database, context.get('adminUser'), 'CREATE_GROUP', created)
        return created
      })
      return context.json(group, 201)
    } catch (exception) { return exceptionResponse(context, exception) }
  })
  app.put('/api/admin/groups/:id', async (context) => {
    try {
      const body = await context.req.json() as Record<string, unknown>
      const validation = groupValidation(body, true, database)
      if (validation) return error(context, validation, 400)
      const id = context.req.param('id')
      const group = database.transaction(() => {
        const candidate = groupFrom(body, id)
        if (database.administration.findDuplicateGroup(candidate, id)) throw new DuplicateGroupError()
        const updated = database.administration.updateGroup(id, candidate)
        if (!updated) return undefined
        recordAudit(database, context.get('adminUser'), 'UPDATE_GROUP', { id, ...body })
        return updated
      })
      return group ? context.json(group) : error(context, 'Group not found', 404)
    } catch (exception) { return exceptionResponse(context, exception) }
  })
  app.delete('/api/admin/groups/:id', (context) => {
    try {
      const id = context.req.param('id')
      const group = database.transaction(() => {
        const deleted = database.administration.deleteGroup(id)
        if (!deleted) return undefined
        recordAudit(database, context.get('adminUser'), 'DELETE_GROUP', { id, name: deleted.name })
        return deleted
      })
      return group ? context.json({ success: true, deletedId: id }) : error(context, 'Group not found', 404)
    } catch (exception) { return exceptionResponse(context, exception) }
  })
}

function groupValidation(body: Record<string, unknown>, requireBrigade: boolean, database: SelfHostedDatabase) {
  if (!nonEmptyString(body.name)) return 'Name is required and must be a string'
  if (requireBrigade && !nonEmptyString(body.fireBrigadeId)) return 'Fire brigade ID is required'
  if (!nonEmptyString(body.competitionClassId) || !database.administration.findCompetitionClassById(body.competitionClassId)) return 'Invalid competition class'
  return undefined
}

function groupFrom(body: Record<string, unknown>, id: string = crypto.randomUUID()): GroupWrite {
  return {
    id,
    fireBrigadeId: body.fireBrigadeId as string,
    name: body.name as string,
    competitionClassId: body.competitionClassId as string,
  }
}

function nonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.length > 0 }
function error(context: Context<SelfHostedAppEnvironment>, message: string, status: number) { return context.json({ error: message }, status as never) }
function recordAudit(database: SelfHostedDatabase, user: string | undefined, action: string, details: unknown) { database.audit.record({ id: crypto.randomUUID(), timestamp: Date.now(), user: user ?? 'system', action, details }) }

class DuplicateGroupError extends Error { }
class DuplicateBrigadeError extends Error { }
class DuplicateCompetitionClassError extends Error { }
function exceptionResponse(context: Context<SelfHostedAppEnvironment>, exception: unknown) {
  if (exception instanceof DuplicateBrigadeError) return error(context, DUPLICATE_BRIGADE_ERROR, 409)
  if (exception instanceof Error && exception.message.includes('fire_brigades.name')) return error(context, DUPLICATE_BRIGADE_ERROR, 409)
  if (exception instanceof DuplicateGroupError || exception instanceof Error && exception.message.includes('UNIQUE constraint failed')) return error(context, DUPLICATE_GROUP_ERROR, 409)
  return error(context, exception instanceof Error ? exception.message : 'Internal Server Error', 500)
}
