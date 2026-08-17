import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getDemoTvState, DEMO_RESULTS_DATA } from './src/mock/demo-scoreboard-data.ts'
import {
  mockBrigades,
  mockGroups,
  mockCategoryEntries,
  mockCompetitionClasses,
  mockCategoryTypes,
  mockEvaluationTypes,
  mockConfig,
  mockTvState,
  mockAuditLogs,
  type MockBrigade,
  type MockGroup,
  type MockCategoryEntry,
  type MockCompetitionClass,
  type MockCategoryType,
  type MockEvaluationType,
  type MockAuditLog,
} from './src/mock/demo-admin-data.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || 'null')) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function addAuditLog(action: string, details?: unknown) {
  mockAuditLogs.unshift({
    id: uid(),
    timestamp: Date.now(),
    user: 'dev@localhost',
    action,
    details: details !== undefined ? JSON.stringify(details) : null,
  } satisfies MockAuditLog)
}

// ---------------------------------------------------------------------------
// Public mock (TV state + results)
// ---------------------------------------------------------------------------

function viteDevPublicMockPlugin(): Plugin {
  return {
    name: 'vite-dev-public-mock',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const fullUrl = req.url ?? ''
        const url = fullUrl.split('?')[0]
        if (url === '/api/public/tv-state') {
          return json(res, 200, getDemoTvState(fullUrl))
        }
        if (url === '/api/public/results') {
          return json(res, 200, DEMO_RESULTS_DATA)
        }
        next()
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Admin mock
// ---------------------------------------------------------------------------

function viteDevAdminMockPlugin(): Plugin {
  return {
    name: 'vite-dev-admin-mock',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const fullUrl = req.url ?? ''
        const [path, qs] = fullUrl.split('?')
        const method = req.method?.toUpperCase() ?? 'GET'

        // ---- /api/admin/competition-classes & category-types & evaluation-types ----
        if (path === '/api/admin/competition-classes' && method === 'GET') {
          return json(res, 200, mockCompetitionClasses)
        }
        if (path === '/api/admin/competition-classes' && method === 'POST') {
          const body = await readBody(req) as { id?: string; name?: string }
          if (!body?.name) return json(res, 400, { error: 'Name is required and must be a string' })
          if (mockCompetitionClasses.some(c => c.name.toLowerCase() === body.name!.toLowerCase())) {
            return json(res, 409, { error: 'A competition class with this name already exists' })
          }
          const cc: MockCompetitionClass = { id: body.id || `cc-${uid()}`, name: body.name }
          mockCompetitionClasses.push(cc)
          addAuditLog('COMPETITION_CLASS_CREATE', cc)
          return json(res, 201, cc)
        }
        const ccIdMatch = path.match(/^\/api\/admin\/competition-classes\/([^/]+)$/)
        if (ccIdMatch && method === 'DELETE') {
          const id = ccIdMatch[1]
          const idx = mockCompetitionClasses.findIndex(c => c.id === id)
          if (idx === -1) return json(res, 404, { error: 'Competition class not found' })
          const cls = mockCompetitionClasses[idx]
          if (mockGroups.some(g => g.competitionClass === cls.name || (g as any).competitionClassId === cls.id)) {
            return json(res, 400, { error: 'Cannot delete competition class assigned to groups' })
          }
          const [removed] = mockCompetitionClasses.splice(idx, 1)
          addAuditLog('COMPETITION_CLASS_DELETE', { id, name: removed.name })
          return json(res, 200, { success: true, deletedId: id })
        }

        if (path === '/api/admin/category-types' && method === 'GET') {
          return json(res, 200, mockCategoryTypes)
        }
        if (path === '/api/admin/category-types' && method === 'POST') {
          const body = await readBody(req) as { id?: string; name?: string; competitionClassId?: string; hasRelayRace?: boolean }
          if (!body?.name) return json(res, 400, { error: 'Name is required and must be a string' })
          if (!body.competitionClassId || !mockCompetitionClasses.some(c => c.id === body.competitionClassId)) {
            return json(res, 400, { error: 'competitionClassId is required and must reference a competition class' })
          }
          if (mockCategoryTypes.some(c => c.name.toLowerCase() === body.name!.toLowerCase())) {
            return json(res, 409, { error: 'A category type with this name already exists' })
          }
          const ct: MockCategoryType = { id: body.id || `cat-${uid()}`, name: body.name, competitionClassId: body.competitionClassId, hasRelayRace: body.hasRelayRace ?? true }
          mockCategoryTypes.push(ct)
          addAuditLog('CATEGORY_TYPE_CREATE', ct)
          return json(res, 201, ct)
        }
        const ctIdMatch = path.match(/^\/api\/admin\/category-types\/([^/]+)$/)
        if (ctIdMatch && method === 'PUT') {
          const id = ctIdMatch[1]
          const ct = mockCategoryTypes.find(c => c.id === id)
          if (!ct) return json(res, 404, { error: 'Category type not found' })
          const body = await readBody(req) as Partial<MockCategoryType>
          if (body.name !== undefined) {
            if (!body.name.trim()) return json(res, 400, { error: 'Name cannot be empty' })
            if (mockCategoryTypes.some(c => c.id !== id && c.name.toLowerCase() === body.name!.trim().toLowerCase())) {
              return json(res, 409, { error: 'A category type with this name already exists' })
            }
            ct.name = body.name.trim()
          }
          if (body.hasRelayRace !== undefined) {
            ct.hasRelayRace = body.hasRelayRace
          }
          addAuditLog('CATEGORY_TYPE_UPDATE', { id, ...body })
          return json(res, 200, ct)
        }
        if (ctIdMatch && method === 'DELETE') {
          const id = ctIdMatch[1]
          const idx = mockCategoryTypes.findIndex(c => c.id === id)
          if (idx === -1) return json(res, 404, { error: 'Category type not found' })
          const cat = mockCategoryTypes[idx]
          if (mockCategoryEntries.some(e => e.categoryTypeId === id || e.categoryType === cat.name)) {
            return json(res, 400, { error: 'Cannot delete category type with registered entries' })
          }
          if (mockEvaluationTypes.some(e => e.categoryTypeId1 === id || e.categoryTypeId2 === id)) {
            return json(res, 400, { error: 'Cannot delete category type referenced by evaluation types' })
          }
          const [removed] = mockCategoryTypes.splice(idx, 1)
          delete (mockConfig.categories as any)[id]
          delete (mockConfig.categories as any)[removed.name]
          addAuditLog('CATEGORY_TYPE_DELETE', { id, name: removed.name })
          return json(res, 200, { success: true, deletedId: id })
        }

        if (path === '/api/admin/evaluation-types' && method === 'GET') {
          return json(res, 200, mockEvaluationTypes)
        }
        if (path === '/api/admin/evaluation-types' && method === 'POST') {
          const body = await readBody(req) as Partial<MockEvaluationType> & { categoryTypeId1?: string; categoryTypeId2?: string | null; name?: string; excludeRelayRace?: boolean; public?: boolean; publicTv?: boolean; displayDurationSeconds?: number; order?: number }
          if (!body?.name || !body?.categoryTypeId1) return json(res, 400, { error: 'Name and categoryTypeId1 required' })
          const cat1 = mockCategoryTypes.find(c => c.id === body.categoryTypeId1)
          if (!cat1) return json(res, 400, { error: `Category type '${body.categoryTypeId1}' not found` })
          const cat2 = body.categoryTypeId2 ? mockCategoryTypes.find(c => c.id === body.categoryTypeId2) : null
          if (body.categoryTypeId2 && !cat2) return json(res, 400, { error: `Category type '${body.categoryTypeId2}' not found` })
          if (mockEvaluationTypes.some(e => e.name.toLowerCase() === body.name!.toLowerCase())) {
            return json(res, 409, { error: 'An evaluation type with this name already exists' })
          }
          const evalType: MockEvaluationType = {
            id: body.id || `eval-${uid()}`,
            name: body.name,
            categoryTypeId1: cat1.id,
            categoryTypeName1: cat1.name,
            hasRelayRace1: cat1.hasRelayRace,
            categoryTypeId2: cat2 ? cat2.id : null,
            categoryTypeName2: cat2 ? cat2.name : null,
            hasRelayRace2: cat2 ? cat2.hasRelayRace : false,
            excludeRelayRace: body.excludeRelayRace ?? false,
            isBrigadePairing: cat2 ? (body.isBrigadePairing ?? false) : false,
            public: body.public ?? true,
            publicTv: body.publicTv ?? true,
            displayDurationSeconds: body.displayDurationSeconds ?? 10,
            order: body.order ?? (mockEvaluationTypes.length + 1),
          }
          mockEvaluationTypes.push(evalType)
          addAuditLog('EVALUATION_TYPE_CREATE', evalType)
          return json(res, 201, evalType)
        }
        const evalIdMatch = path.match(/^\/api\/admin\/evaluation-types\/([^/]+)$/)
        if (evalIdMatch && method === 'PUT') {
          const id = evalIdMatch[1]
          const evalItem = mockEvaluationTypes.find(e => e.id === id)
          if (!evalItem) return json(res, 404, { error: 'Evaluation type not found' })
          const body = await readBody(req) as Partial<MockEvaluationType>
          if (body.name !== undefined) evalItem.name = body.name
          if (body.categoryTypeId1 !== undefined) {
            const cat1 = mockCategoryTypes.find(c => c.id === body.categoryTypeId1)
            if (cat1) {
              evalItem.categoryTypeId1 = cat1.id
              evalItem.categoryTypeName1 = cat1.name
              evalItem.hasRelayRace1 = cat1.hasRelayRace
            }
          }
          if ('categoryTypeId2' in body) {
            const cat2 = body.categoryTypeId2 ? mockCategoryTypes.find(c => c.id === body.categoryTypeId2) : null
            evalItem.categoryTypeId2 = cat2 ? cat2.id : null
            evalItem.categoryTypeName2 = cat2 ? cat2.name : null
            evalItem.hasRelayRace2 = cat2 ? cat2.hasRelayRace : false
          }
          if (body.excludeRelayRace !== undefined) evalItem.excludeRelayRace = body.excludeRelayRace
          if (body.public !== undefined) evalItem.public = body.public
          if (body.publicTv !== undefined) evalItem.publicTv = body.publicTv
          if (body.displayDurationSeconds !== undefined) evalItem.displayDurationSeconds = body.displayDurationSeconds
          if (body.order !== undefined) evalItem.order = body.order
          addAuditLog('EVALUATION_TYPE_UPDATE', { id, ...body })
          return json(res, 200, evalItem)
        }
        if (evalIdMatch && method === 'DELETE') {
          const id = evalIdMatch[1]
          const idx = mockEvaluationTypes.findIndex(e => e.id === id)
          if (idx === -1) return json(res, 404, { error: 'Evaluation type not found' })
          const [removed] = mockEvaluationTypes.splice(idx, 1)
          delete (mockConfig.categories as any)[id]
          delete (mockConfig.categories as any)[removed.name]
          addAuditLog('EVALUATION_TYPE_DELETE', { id, name: removed.name })
          return json(res, 200, { success: true, deletedId: id })
        }

        // ---- /api/admin/brigades[/:id] ------------------------------------
        if (path === '/api/admin/brigades' && method === 'GET') {
          return json(res, 200, mockBrigades)
        }
        if (path === '/api/admin/brigades' && method === 'POST') {
          const body = await readBody(req) as { name?: string }
          if (!body?.name) return json(res, 400, { error: 'name required' })
          const brigade: MockBrigade = { id: uid(), name: body.name }
          mockBrigades.push(brigade)
          addAuditLog('BRIGADE_CREATE', { name: body.name })
          return json(res, 201, brigade)
        }
        const brigadeIdMatch = path.match(/^\/api\/admin\/brigades\/([^/]+)$/)
        if (brigadeIdMatch && method === 'DELETE') {
          const id = brigadeIdMatch[1]
          const idx = mockBrigades.findIndex(b => b.id === id)
          if (idx === -1) return json(res, 404, { error: 'Not found' })
          const [removed] = mockBrigades.splice(idx, 1)
          addAuditLog('BRIGADE_DELETE', { id, name: removed.name })
          return json(res, 200, { ok: true })
        }

        // ---- /api/admin/groups[/:id] -------------------------------------
        if (path === '/api/admin/groups' && method === 'GET') {
          return json(res, 200, mockGroups)
        }
        if (path === '/api/admin/groups' && method === 'POST') {
          const body = await readBody(req) as { fireBrigadeId?: string; name?: string; competitionClass?: string; competitionClassId?: string }
          if (!body?.fireBrigadeId || !body?.name) return json(res, 400, { error: 'fireBrigadeId and name required' })
          const brigade = mockBrigades.find(b => b.id === body.fireBrigadeId)
          const competitionClass = mockCompetitionClasses.find((c) => c.id === body.competitionClassId || c.name === body.competitionClass) ?? mockCompetitionClasses[0]
          if (!competitionClass) return json(res, 400, { error: 'Invalid competition class' })
          const group: MockGroup = {
            id: uid(),
            name: body.name,
            competitionClass: competitionClass.name as MockGroup['competitionClass'],
            competitionClassId: competitionClass.id,
            fireBrigadeId: body.fireBrigadeId,
            fireBrigadeName: brigade?.name ?? 'Unbekannt',
          }
          mockGroups.push(group)
          addAuditLog('GROUP_CREATE', { name: body.name, fireBrigadeId: body.fireBrigadeId })
          return json(res, 201, group)
        }
        const groupIdMatch = path.match(/^\/api\/admin\/groups\/([^/]+)$/)
        if (groupIdMatch && method === 'DELETE') {
          const id = groupIdMatch[1]
          const idx = mockGroups.findIndex(g => g.id === id)
          if (idx === -1) return json(res, 404, { error: 'Not found' })
          const [removed] = mockGroups.splice(idx, 1)
          addAuditLog('GROUP_DELETE', { id, name: removed.name })
          return json(res, 200, { ok: true })
        }

        // ---- /api/admin/category-entries[/reorder | /:id] ----------------
        if (path === '/api/admin/category-entries' && method === 'GET') {
          return json(res, 200, mockCategoryEntries)
        }
        if (path === '/api/admin/category-entries' && method === 'POST') {
          const body = await readBody(req) as Partial<MockCategoryEntry> & { groupId?: string; categoryType?: string; categoryTypeId?: string }
          if (!body?.groupId || (!body?.categoryType && !body?.categoryTypeId)) return json(res, 400, { error: 'groupId and categoryType required' })
          const catType = mockCategoryTypes.find(ct => ct.id === body.categoryTypeId || ct.name === body.categoryType)
          const group = mockGroups.find(g => g.id === body.groupId)
          if (!catType) return json(res, 400, { error: `Unknown category type '${body.categoryType ?? body.categoryTypeId}'` })
          if (!group || catType.competitionClassId !== group.competitionClassId) {
            return json(res, 400, { error: `Incompatible category type '${catType.name}' for this group` })
          }
          const maxPos = mockCategoryEntries
            .filter(e => e.categoryTypeId === catType?.id || e.categoryType === (catType?.name ?? body.categoryType))
            .reduce((m, e) => Math.max(m, e.startOrderPosition ?? 0), 0)
          const entry: MockCategoryEntry = {
            id: uid(),
            groupId: body.groupId,
            categoryTypeId: catType?.id ?? body.categoryTypeId ?? mockCategoryTypes[0]?.id ?? '',
            categoryType: catType?.name ?? body.categoryType ?? mockCategoryTypes[0]?.name ?? '',
            categoryTypeName: catType?.name ?? body.categoryType ?? mockCategoryTypes[0]?.name ?? '',
            hasRelayRace: catType?.hasRelayRace ?? false,
            runStatus: 'OPEN',
            startOrderPosition: maxPos + 1,
            scoreHundredths: null,
            errors: null,
            attackTimeHundredths: null,
            attackTimeErrors: null,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            groupName: group?.name ?? '?',
            competitionClass: group?.competitionClass ?? '',
            fireBrigadeId: group?.fireBrigadeId ?? '',
            fireBrigadeName: group?.fireBrigadeName ?? 'Unbekannt',
          }
          mockCategoryEntries.push(entry)
          addAuditLog('ENTRY_CREATE', { groupId: body.groupId, categoryType: body.categoryType })
          return json(res, 201, entry)
        }
        if (path === '/api/admin/category-entries/reorder' && method === 'POST') {
          const body = await readBody(req) as { orderedIds?: string[] }
          if (!Array.isArray(body?.orderedIds)) return json(res, 400, { error: 'orderedIds required' })
          body.orderedIds.forEach((id, idx) => {
            const entry = mockCategoryEntries.find(e => e.id === id)
            if (entry) entry.startOrderPosition = idx + 1
          })
          return json(res, 200, { ok: true })
        }
        const ceIdMatch = path.match(/^\/api\/admin\/category-entries\/([^/]+)$/)
        if (ceIdMatch && method === 'PUT') {
          const id = ceIdMatch[1]
          const entry = mockCategoryEntries.find(e => e.id === id)
          if (!entry) return json(res, 404, { error: 'Not found' })
          const body = await readBody(req) as Partial<MockCategoryEntry>
          if (body.attackTimeHundredths !== undefined) entry.attackTimeHundredths = body.attackTimeHundredths
          if (body.errors !== undefined) entry.errors = body.errors
          if (body.runStatus !== undefined) entry.runStatus = body.runStatus
          // Recompute score: attackTime + errors * 500 centiseconds (5 s each)
          if (entry.runStatus === 'VALID' && entry.attackTimeHundredths !== null) {
            entry.scoreHundredths = entry.attackTimeHundredths + (entry.errors ?? 0) * 500
          } else {
            entry.scoreHundredths = null
          }
          addAuditLog('RESULT_ENTRY', { entryId: id, attackTimeHundredths: entry.attackTimeHundredths, errors: entry.errors })
          return json(res, 200, entry)
        }
        if (ceIdMatch && method === 'DELETE') {
          const id = ceIdMatch[1]
          const idx = mockCategoryEntries.findIndex(e => e.id === id)
          if (idx === -1) return json(res, 404, { error: 'Not found' })
          mockCategoryEntries.splice(idx, 1)
          addAuditLog('ENTRY_DELETE', { entryId: id })
          return json(res, 200, { ok: true })
        }

        // ---- /api/admin/config -------------------------------------------
        if (path === '/api/admin/config' && method === 'GET') {
          return json(res, 200, mockConfig)
        }
        if (path === '/api/admin/config' && method === 'PUT') {
          const body = await readBody(req) as typeof mockConfig
          Object.assign(mockConfig, body)
          addAuditLog('CONFIG_UPDATE', body)
          return json(res, 200, mockConfig)
        }

        // ---- /api/admin/tv-state ----------------------------------------
        if (path === '/api/admin/tv-state' && method === 'GET') {
          return json(res, 200, mockTvState)
        }
        if (path === '/api/admin/tv-state' && method === 'PUT') {
          const body = await readBody(req) as { mode?: string; selectedCategoryId?: string | null }
          if (body?.mode) mockTvState.mode = body.mode as typeof mockTvState.mode
          if ('selectedCategoryId' in (body ?? {})) mockTvState.selectedCategoryId = body.selectedCategoryId ?? null
          mockTvState.updatedAt = Date.now()
          addAuditLog('TV_STATE_UPDATE', { mode: mockTvState.mode, selectedCategoryId: mockTvState.selectedCategoryId })
          return json(res, 200, mockTvState)
        }

        // ---- /api/admin/audit-logs --------------------------------------
        if (path === '/api/admin/audit-logs' && method === 'GET') {
          const params = new URLSearchParams(qs ?? '')
          const page = Math.max(1, Number(params.get('page') ?? 1))
          const limit = Math.min(100, Math.max(1, Number(params.get('limit') ?? 20)))
          const search = (params.get('search') ?? '').toLowerCase()
          const filtered = search
            ? mockAuditLogs.filter(l =>
                l.action.toLowerCase().includes(search) ||
                l.user.toLowerCase().includes(search) ||
                (l.details ?? '').toLowerCase().includes(search)
              )
            : mockAuditLogs
          const total = filtered.length
          const totalPages = Math.max(1, Math.ceil(total / limit))
          const logs = filtered.slice((page - 1) * limit, page * limit)
          return json(res, 200, { logs, total, totalPages })
        }

        // ---- /api/admin/reset -------------------------------------------
        if (path === '/api/admin/reset' && method === 'POST') {
          const body = (await readBody(req)) as {
            scopes?: {
              categoryEntries?: boolean
              groups?: boolean
              fireBrigades?: boolean
              evaluationTypes?: boolean
              categoryTypes?: boolean
            }
          }
          const rawScopes = body?.scopes
          const scopes = {
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

          if (scopes.categoryEntries) mockCategoryEntries.length = 0
          if (scopes.groups) mockGroups.length = 0
          if (scopes.fireBrigades) mockBrigades.length = 0
          if (scopes.evaluationTypes) mockEvaluationTypes.length = 0
          if (scopes.categoryTypes) mockCategoryTypes.length = 0

          addAuditLog('DATABASE_CLEAR', { scopes })
          return json(res, 200, { ok: true, message: 'Datenbank erfolgreich zurückgesetzt' })
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteDevPublicMockPlugin(), viteDevAdminMockPlugin()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-server/**', 'tests/**'],
  },
})
