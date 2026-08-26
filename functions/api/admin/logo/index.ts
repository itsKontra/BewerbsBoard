import { getDb, getKvStore, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { normalizeTvPresentation } from '../../../../shared/domain/tv-presentation';
import * as schema from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestDelete(context: EventContext) {
  try {
    const kv = getKvStore(context.env);
    if (kv && typeof kv.delete === 'function') {
      await kv.delete('tv:custom-logo');
      const storedPresentation = await kv.get('tv:presentation');
      if (storedPresentation) {
        const presentation = normalizeTvPresentation(storedPresentation);
        if (presentation.logoOverride.startsWith('/api/public/logo')) {
          presentation.logoOverride = '';
          await kv.put('tv:presentation', JSON.stringify(presentation));
        }
      }
    }

    let db;
    try {
      db = getDb(context.env);
      await db.delete(schema.appConfig).where(eq(schema.appConfig.key, 'tv:custom-logo'));
      const presRows = await db
        .select()
        .from(schema.appConfig)
        .where(eq(schema.appConfig.key, 'tv:presentation'))
        .limit(1);

      if (presRows.length > 0) {
        const pres = normalizeTvPresentation(JSON.parse(presRows[0].valueJson));
        if (pres.logoOverride.startsWith('/api/public/logo')) {
          pres.logoOverride = '';
          await db
            .update(schema.appConfig)
            .set({
              valueJson: JSON.stringify(pres),
              updatedAt: Date.now(),
            })
            .where(eq(schema.appConfig.key, 'tv:presentation'));
        }
      }
    } catch {
      // ignore db error if db binding not present
    }

    if (db) {
      const adminUser = context.data?.adminUser || 'system';
      await logAudit(db, adminUser, 'DELETE_CUSTOM_LOGO', {
        operation: 'DELETE',
        target: 'tv:custom-logo',
      });
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
