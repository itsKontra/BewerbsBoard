import { getDb, jsonResponse, jsonError, type EventContext } from '../../utils';
import * as schema from '../../../../../shared/db/schema';
import { validateDataExportEnvelope, type EntityImportCount, type PreflightSummary } from '../../../../../shared/domain/data-management';

export async function onRequestPost(context: EventContext) {
  try {
    const body = await context.request.json().catch(() => null);
    const validation = validateDataExportEnvelope(body);
    if (!validation.isValid || !validation.envelope) {
      return jsonResponse({
        isValid: false,
        error: 'Dateiformat ist ungültig.',
        errors: validation.errors,
      }, 400);
    }

    const db = getDb(context.env);
    const data = validation.envelope.data;

    const [existingAppConfig, existingCompClasses, existingBrigades, existingCatTypes, existingEvalTypes, existingGroups, existingEntries] = await Promise.all([
      db.select({ key: schema.appConfig.key }).from(schema.appConfig),
      db.select({ id: schema.competitionClasses.id }).from(schema.competitionClasses),
      db.select({ id: schema.fireBrigades.id }).from(schema.fireBrigades),
      db.select({ id: schema.categoryTypes.id }).from(schema.categoryTypes),
      db.select({ id: schema.evaluationTypes.id }).from(schema.evaluationTypes),
      db.select({ id: schema.groups.id }).from(schema.groups),
      db.select({ id: schema.categoryEntries.id }).from(schema.categoryEntries),
    ]);

    const countTable = (
      items: any[],
      existingSet: Set<string>,
      keyFn: (item: any) => string = (item) => item.id
    ): EntityImportCount => {
      let toUpdate = 0;
      let toInsert = 0;
      for (const item of items) {
        if (existingSet.has(keyFn(item))) {
          toUpdate++;
        } else {
          toInsert++;
        }
      }
      return { total: items.length, toInsert, toUpdate };
    };

    const summary = {
      appConfig: countTable(data.appConfig, new Set(existingAppConfig.map((r) => r.key)), (item) => item.key),
      competitionClasses: countTable(data.competitionClasses, new Set(existingCompClasses.map((r) => r.id))),
      fireBrigades: countTable(data.fireBrigades, new Set(existingBrigades.map((r) => r.id))),
      categoryTypes: countTable(data.categoryTypes, new Set(existingCatTypes.map((r) => r.id))),
      evaluationTypes: countTable(data.evaluationTypes, new Set(existingEvalTypes.map((r) => r.id))),
      groups: countTable(data.groups, new Set(existingGroups.map((r) => r.id))),
      categoryEntries: countTable(data.categoryEntries, new Set(existingEntries.map((r) => r.id))),
    };

    const totalEntities = Object.values(summary).reduce((sum, s) => sum + s.total, 0);

    const preflight: PreflightSummary = {
      isValid: true,
      errors: [],
      summary,
      totalEntities,
    };

    return jsonResponse(preflight);
  } catch (err: any) {
    return jsonError(err.message || 'Preflight-Prüfung fehlgeschlagen', 500);
  }
}
