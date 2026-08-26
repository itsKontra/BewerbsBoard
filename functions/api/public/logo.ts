import { getKvStore, getDb, type EventContext } from '../admin/utils';
import { normalizeStoredCustomLogo, base64ToUint8Array } from '../../../shared/domain/tv-presentation';
import * as schema from '../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestGet(context: EventContext) {
  try {
    let logo = null;
    const kv = getKvStore(context.env);
    if (kv && typeof kv.get === 'function') {
      try {
        const stored = await kv.get('tv:custom-logo');
        if (stored) {
          logo = normalizeStoredCustomLogo(JSON.parse(stored));
        }
      } catch {
        // fallback
      }
    }

    if (!logo) {
      try {
        const db = getDb(context.env);
        const rows = await db
          .select()
          .from(schema.appConfig)
          .where(eq(schema.appConfig.key, 'tv:custom-logo'))
          .limit(1);
        if (rows.length > 0) {
          logo = normalizeStoredCustomLogo(JSON.parse(rows[0].valueJson));
        }
      } catch {
        // fallback
      }
    }

    if (!logo) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const binaryData = base64ToUint8Array(logo.base64Data);
    return new Response(binaryData.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': logo.mimeType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return new Response(err?.message || 'Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
