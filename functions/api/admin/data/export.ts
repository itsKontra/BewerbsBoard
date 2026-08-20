import { getDb, jsonError, logAudit, type EventContext } from '../utils';
import * as schema from '../../../../shared/db/schema';
import type { DataExportEnvelope, CategoryEntryRecord } from '../../../../shared/domain/data-management';

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);
    const user = (context.data?.adminUser as string) || 'system';

    const [appConfigRows, compClasses, brigades, catTypes, evalTypes, grps, entries] = await Promise.all([
      db.select().from(schema.appConfig).orderBy(schema.appConfig.key),
      db.select().from(schema.competitionClasses).orderBy(schema.competitionClasses.id),
      db.select().from(schema.fireBrigades).orderBy(schema.fireBrigades.id),
      db.select().from(schema.categoryTypes).orderBy(schema.categoryTypes.id),
      db.select().from(schema.evaluationTypes).orderBy(schema.evaluationTypes.order, schema.evaluationTypes.id),
      db.select().from(schema.groups).orderBy(schema.groups.id),
      db.select().from(schema.categoryEntries).orderBy(schema.categoryEntries.id),
    ]);

    const totalEntities =
      appConfigRows.length +
      compClasses.length +
      brigades.length +
      catTypes.length +
      evalTypes.length +
      grps.length +
      entries.length;

    const exportedAt = new Date().toISOString();

    await logAudit(db, user, 'DATA_EXPORT', {
      operation: 'EXPORT',
      new_value: {
        totalEntities,
        exportedAt,
      },
    });

    const envelope: DataExportEnvelope = {
      version: 1,
      exportedAt,
      appVersion: '1.0.0',
      data: {
        appConfig: appConfigRows,
        competitionClasses: compClasses,
        fireBrigades: brigades,
        categoryTypes: catTypes,
        evaluationTypes: evalTypes,
        groups: grps,
        categoryEntries: entries as CategoryEntryRecord[],
      },
    };

    const timestampStr = exportedAt.replace(/[:.]/g, '-').slice(0, 16);
    const filename = `bewerbsboard-export-${timestampStr}.json`;

    return new Response(JSON.stringify(envelope, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return jsonError(err.message || 'Export fehlgeschlagen', 500);
  }
}
