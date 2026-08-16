import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from './utils';

export async function onRequestPost(context: EventContext) {
  try {
    const body = (await context.request.json().catch(() => ({}))) as {
      confirmationKeyword?: string;
    };

    if (body.confirmationKeyword !== 'LÖSCHEN') {
      return jsonError("Ungültiges Bestätigungswort. Es muss exakt 'LÖSCHEN' eingegeben werden.", 400);
    }

    const db = getDb(context.env);
    const user = context.data.adminUser || 'system';

    // 1. Fetch pre-clear counts for audit log snapshot
    const [brigades, grps, entries] = await Promise.all([
      db.select().from(schema.fireBrigades),
      db.select().from(schema.groups),
      db.select().from(schema.categoryEntries),
    ]);

    const preClearSnapshot = {
      summary: {
        fireBrigadesCount: brigades.length,
        groupsCount: grps.length,
        categoryEntriesCount: entries.length,
      },
      clearedAt: new Date().toISOString(),
    };

    // 2. Prepare operations for atomic batch
    const deleteEntries = db.delete(schema.categoryEntries);
    const deleteGroups = db.delete(schema.groups);
    const deleteBrigades = db.delete(schema.fireBrigades);

    const tvReset = db
      .update(schema.tvRuntimeState)
      .set({
        mode: 'ROTATION',
        selectedCategoryId: null,
        updatedAt: Date.now(),
      })
      .where(eq(schema.tvRuntimeState.id, 'default'));

    const auditInsert = db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      user,
      action: 'DATABASE_CLEAR',
      details: JSON.stringify(preClearSnapshot),
    });

    // 3. Execute atomic transaction batch
    await db.batch([deleteEntries, deleteGroups, deleteBrigades, tvReset, auditInsert] as any);

    return jsonResponse({
      message: 'Datenbank erfolgreich zurückgesetzt',
      summary: preClearSnapshot.summary,
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
