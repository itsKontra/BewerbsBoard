import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from '../admin/utils';
import { DEFAULT_RANKING_PAGE_DURATION_MS, getKvStore, normalizeRankingPageDurationMs, normalizeTvAnnouncement } from '../admin/config';
import { DEFAULT_TV_PRESENTATION, normalizeTvPresentation } from '../../../shared/domain/tv-presentation';

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);

    // Read tv_runtime_state
    const rows = await db
      .select()
      .from(schema.tvRuntimeState)
      .where(eq(schema.tvRuntimeState.id, 'default'))
      .all();

    const tvState = rows.length > 0
      ? rows[0]
      : { id: 'default', mode: 'ROTATION', selectedCategoryId: null, updatedAt: null };

    // Read KV config for display settings. Evaluation Types live in D1.
    let tvAnnouncement = { headline: '', message: '' };
    let eventTitle = 'Feuerwehr Leistungsbewerb';
    let rankingPageDurationMs = DEFAULT_RANKING_PAGE_DURATION_MS;
    let tvPresentation = { ...DEFAULT_TV_PRESENTATION };

    const kv = getKvStore(context.env);
    if (kv && typeof kv.get === 'function') {
      try {
        const storedAnnouncement = await kv.get('tv:announcement');
        if (storedAnnouncement) {
          tvAnnouncement = normalizeTvAnnouncement(storedAnnouncement);
        }

        const storedTitle = await kv.get('event:name');
        if (storedTitle) eventTitle = storedTitle;

        const storedRankingPageDuration = await kv.get('tv:ranking-page-duration-ms');
        if (storedRankingPageDuration) {
          rankingPageDurationMs = normalizeRankingPageDurationMs(storedRankingPageDuration);
        }

        const storedPresentation = await kv.get('tv:presentation');
        if (storedPresentation) {
          tvPresentation = normalizeTvPresentation(storedPresentation);
        }
      } catch {
        // KV read errors ignored, fallback used
      }
    }

    const categoriesConfig: Record<string, { name: string; publicEnabled: boolean; tvEnabled: boolean; displayDuration: number; order: number }> = {};
    try {
      const dbEvalTypes = await db.select().from(schema.evaluationTypes).all();
      for (const et of dbEvalTypes) {
        categoriesConfig[et.id] = {
          name: et.name,
          publicEnabled: Boolean(et.public),
          tvEnabled: et.public_tv,
          order: et.order ?? 99,
          displayDuration: et.displayDurationSeconds,
        };
      }
    } catch {
      // Ignore if DB not ready
    }

    let serverInfo = {
      serverIp: '127.0.0.1',
      serverPort: 80,
      adminUrl: '/admin',
      availableIps: [{ interfaceName: 'host', ip: '127.0.0.1' }],
    };
    try {
      const reqUrl = new URL(context.request.url);
      serverInfo = {
        serverIp: reqUrl.hostname,
        serverPort: reqUrl.port ? Number.parseInt(reqUrl.port, 10) : (reqUrl.protocol === 'https:' ? 443 : 80),
        adminUrl: `${reqUrl.origin}/admin`,
        availableIps: [{ interfaceName: 'host', ip: reqUrl.hostname }],
      };
    } catch {
      // fallback
    }

    return jsonResponse({
      mode: tvState.mode,
      selectedCategoryId: tvState.selectedCategoryId,
      updatedAt: tvState.updatedAt,
      tvAnnouncement,
      categoriesConfig,
      eventTitle,
      rankingPageDurationMs,
      serverInfo,
      tvPresentation: {
        theme: tvPresentation.theme,
        logoUrl: tvPresentation.logoOverride || '/logo.png',
        headerLabel: tvPresentation.headerLabel,
        qrCodeEnabled: tvPresentation.qrCodeEnabled,
        qrCodeAlwaysVisible: tvPresentation.qrCodeAlwaysVisible,
        qrCodeIntervalSeconds: tvPresentation.qrCodeIntervalSeconds,
        qrCodeDurationSeconds: tvPresentation.qrCodeDurationSeconds,
        adminSplashEnabled: tvPresentation.adminSplashEnabled,
      },
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
