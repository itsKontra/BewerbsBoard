import { getDb, getKvStore, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import {
  extractImageBytesFromRequest,
  validateAndProcessLogo,
  normalizeTvPresentation,
} from '../../../../shared/domain/tv-presentation';
import * as schema from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestPost(context: EventContext) {
  try {
    const extracted = await extractImageBytesFromRequest(context.request);
    if (extracted.error || !extracted.bytes) {
      return jsonError(extracted.error || 'Fehler beim Lesen der Bilddaten.', 400);
    }

    const processed = validateAndProcessLogo(extracted.bytes, extracted.declaredMime);
    if (!processed.success) {
      return jsonError(processed.error, 400);
    }

    const timestamp = Date.now();
    const logoUrl = `/api/public/logo?v=${timestamp}`;
    const storedLogo = {
      mimeType: processed.mimeType,
      base64Data: processed.base64Data,
      updatedAt: timestamp,
    };

    const kv = getKvStore(context.env);
    if (kv && typeof kv.put === 'function') {
      await kv.put('tv:custom-logo', JSON.stringify(storedLogo));
      const storedPresentation = await kv.get('tv:presentation');
      const presentation = normalizeTvPresentation(storedPresentation);
      presentation.logoOverride = logoUrl;
      await kv.put('tv:presentation', JSON.stringify(presentation));
    }

    let db;
    try {
      db = getDb(context.env);
      await db
        .insert(schema.appConfig)
        .values({
          key: 'tv:custom-logo',
          valueJson: JSON.stringify(storedLogo),
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: schema.appConfig.key,
          set: {
            valueJson: JSON.stringify(storedLogo),
            updatedAt: timestamp,
          },
        });

      const presRows = await db
        .select()
        .from(schema.appConfig)
        .where(eq(schema.appConfig.key, 'tv:presentation'))
        .limit(1);

      if (presRows.length > 0) {
        const pres = normalizeTvPresentation(JSON.parse(presRows[0].valueJson));
        pres.logoOverride = logoUrl;
        await db
          .update(schema.appConfig)
          .set({
            valueJson: JSON.stringify(pres),
            updatedAt: timestamp,
          })
          .where(eq(schema.appConfig.key, 'tv:presentation'));
      }
    } catch {
      // fallback if DB binding not available
    }

    if (db) {
      const adminUser = context.data?.adminUser || 'system';
      await logAudit(db, adminUser, 'UPLOAD_CUSTOM_LOGO', {
        operation: 'UPLOAD',
        mimeType: processed.mimeType,
        logoUrl,
      });
    }

    return jsonResponse({ success: true, logoUrl });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
