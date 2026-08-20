import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, buildAuditLog, type EventContext } from './utils';

export interface ResetScopes {
  categoryEntries?: boolean;
  groups?: boolean;
  fireBrigades?: boolean;
  evaluationTypes?: boolean;
  categoryTypes?: boolean;
}

export async function onRequestPost(context: EventContext) {
  try {
    const body = (await context.request.json().catch(() => ({}))) as {
      confirmationKeyword?: string;
      scopes?: ResetScopes;
    };

    if (body.confirmationKeyword !== 'LÖSCHEN') {
      return jsonError("Ungültiges Bestätigungswort. Es muss exakt 'LÖSCHEN' eingegeben werden.", 400);
    }

    const db = getDb(context.env);
    const user = context.data.adminUser || 'system';

    const rawScopes = body.scopes;
    const scopes = {
      categoryEntries: rawScopes?.categoryEntries ?? (rawScopes ? false : true),
      groups: rawScopes?.groups ?? (rawScopes ? false : true),
      fireBrigades: rawScopes?.fireBrigades ?? (rawScopes ? false : true),
      evaluationTypes: rawScopes?.evaluationTypes ?? false,
      categoryTypes: rawScopes?.categoryTypes ?? false,
    };

    if (scopes.fireBrigades) {
      scopes.groups = true;
      scopes.categoryEntries = true;
    }
    if (scopes.groups) {
      scopes.categoryEntries = true;
    }
    if (scopes.categoryTypes) {
      scopes.evaluationTypes = true;
      scopes.categoryEntries = true;
    }
    if (scopes.evaluationTypes) {
      scopes.categoryEntries = true;
    }

    const summary: Record<string, number> = {};
    const batchOps: any[] = [];

    // 1. Fetch pre-clear counts & schedule delete ops in dependency order
    if (scopes.categoryEntries) {
      const entries = await db.select().from(schema.categoryEntries);
      summary.categoryEntriesCount = entries.length;
      batchOps.push(db.delete(schema.categoryEntries));
    }
    if (scopes.evaluationTypes) {
      const evals = await db.select().from(schema.evaluationTypes);
      summary.evaluationTypesCount = evals.length;
      batchOps.push(db.delete(schema.evaluationTypes));
    }
    if (scopes.groups) {
      const grps = await db.select().from(schema.groups);
      summary.groupsCount = grps.length;
      batchOps.push(db.delete(schema.groups));
    }
    if (scopes.fireBrigades) {
      const brigades = await db.select().from(schema.fireBrigades);
      summary.fireBrigadesCount = brigades.length;
      batchOps.push(db.delete(schema.fireBrigades));
    }
    if (scopes.categoryTypes) {
      const catTypes = await db.select().from(schema.categoryTypes);
      summary.categoryTypesCount = catTypes.length;
      batchOps.push(db.delete(schema.categoryTypes));
    }

    const preClearSnapshot = {
      summary,
      scopes: body.scopes,
      clearedAt: new Date().toISOString(),
    };

    const tvReset = db
      .update(schema.tvRuntimeState)
      .set({
        mode: 'ROTATION',
        selectedCategoryId: null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.tvRuntimeState.id, 'default'));

    const auditInsert = buildAuditLog(db, user, 'DATABASE_CLEAR', preClearSnapshot);

    batchOps.push(tvReset, auditInsert);

    // 2. Execute atomic transaction batch
    await db.batch(batchOps as any);

    return jsonResponse({
      message: 'Datenbank erfolgreich zurückgesetzt',
      summary,
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
