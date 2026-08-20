import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from './utils';
import {
  normalizeTvPresentation,
  DEFAULT_TV_PRESENTATION,
} from '../../../shared/domain/tv-presentation';

export { normalizeLogoOverride, normalizeTvPresentation } from '../../../shared/domain/tv-presentation';

export const DEFAULT_RANKING_PAGE_DURATION_MS = 8000;

export function normalizeRankingPageDurationMs(value: unknown): number {
  const duration = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(duration) && duration >= 1000 && duration <= 300_000
    ? duration
    : DEFAULT_RANKING_PAGE_DURATION_MS;
}

export function getKvStore(env: any) {
  return env?.KV || env?.APP_CONFIG || null;
}

export function normalizeTvAnnouncement(input: any): { headline: string; message: string } {
  if (!input) return { headline: '', message: '' };
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object') {
        return {
          headline: typeof parsed.headline === 'string' ? parsed.headline : '',
          message: typeof parsed.message === 'string' ? parsed.message : '',
        };
      }
    } catch {
      return { headline: '', message: input };
    }
  }
  if (typeof input === 'object') {
    return {
      headline: typeof input.headline === 'string' ? input.headline : '',
      message: typeof input.message === 'string' ? input.message : '',
    };
  }
  return { headline: '', message: '' };
}

export async function onRequestGet(context: EventContext) {
  try {
    const kv = getKvStore(context.env);

    let eventTitle = 'Feuerwehr Leistungsbewerb';
    let publicUrl = 'https://bewerb.feuerwehr.at';
    let rankingPageDurationMs = DEFAULT_RANKING_PAGE_DURATION_MS;
    let tvAnnouncement = { headline: '', message: '' };
    let tvPresentation = { ...DEFAULT_TV_PRESENTATION };

    if (kv && typeof kv.get === 'function') {
      const storedTitle = await kv.get('event:name');
      if (storedTitle) eventTitle = storedTitle;

      const storedUrl = await kv.get('public:url');
      if (storedUrl) publicUrl = storedUrl;

      const storedRankingPageDuration = await kv.get('tv:ranking-page-duration-ms');
      if (storedRankingPageDuration) {
        rankingPageDurationMs = normalizeRankingPageDurationMs(storedRankingPageDuration);
      }

      const storedAnnouncement = await kv.get('tv:announcement');
      if (storedAnnouncement) {
        tvAnnouncement = normalizeTvAnnouncement(storedAnnouncement);
      }

      const storedPresentation = await kv.get('tv:presentation');
      if (storedPresentation) {
        tvPresentation = normalizeTvPresentation(storedPresentation);
      }

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
      eventTitle,
      publicUrl,
      rankingPageDurationMs,
      tvAnnouncement,
      tvPresentation,
      serverInfo,
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}

export async function onRequestPut(context: EventContext) {
  try {
    const body = await context.request.json();
    const kv = getKvStore(context.env);

    const eventTitle = body.eventTitle ?? body['event:name'] ?? 'Feuerwehr Leistungsbewerb';
    const publicUrl = body.publicUrl ?? body['public:url'] ?? 'https://bewerb.feuerwehr.at';
    const rankingPageDurationMs = normalizeRankingPageDurationMs(body.rankingPageDurationMs);
    const tvAnnouncement = normalizeTvAnnouncement(body.tvAnnouncement ?? body['tv:announcement']);
    const tvPresentation = normalizeTvPresentation(body.tvPresentation ?? body['tv:presentation']);

    let prevEventTitle = 'Feuerwehr Leistungsbewerb';
    let prevPublicUrl = 'https://bewerb.feuerwehr.at';
    let prevRankingPageDurationMs = DEFAULT_RANKING_PAGE_DURATION_MS;
    let prevTvAnnouncement = { headline: '', message: '' };
    let prevTvPresentation = { ...DEFAULT_TV_PRESENTATION };

    if (kv && typeof kv.get === 'function') {
      const storedTitle = await kv.get('event:name');
      if (storedTitle) prevEventTitle = storedTitle;
      const storedUrl = await kv.get('public:url');
      if (storedUrl) prevPublicUrl = storedUrl;
      const storedRankingPageDuration = await kv.get('tv:ranking-page-duration-ms');
      if (storedRankingPageDuration) prevRankingPageDurationMs = normalizeRankingPageDurationMs(storedRankingPageDuration);
      const storedAnnouncement = await kv.get('tv:announcement');
      if (storedAnnouncement) prevTvAnnouncement = normalizeTvAnnouncement(storedAnnouncement);
      const storedPresentation = await kv.get('tv:presentation');
      if (storedPresentation) prevTvPresentation = normalizeTvPresentation(storedPresentation);
    }

    if (kv && typeof kv.put === 'function') {
      await kv.put('event:name', eventTitle);
      await kv.put('public:url', publicUrl);
      await kv.put('tv:ranking-page-duration-ms', String(rankingPageDurationMs));
      await kv.put('tv:announcement', JSON.stringify(tvAnnouncement));
      await kv.put('tv:presentation', JSON.stringify(tvPresentation));
    }

    const db = getDb(context.env);
    const adminUser = context.data.adminUser || 'system';
    await logAudit(db, adminUser, 'UPDATE_CONFIG', {
      operation: 'UPDATE',
      previous_value: {
        eventTitle: prevEventTitle,
        publicUrl: prevPublicUrl,
        rankingPageDurationMs: prevRankingPageDurationMs,
        tvAnnouncement: prevTvAnnouncement,
        tvPresentation: prevTvPresentation,
      },
      new_value: {
        eventTitle,
        publicUrl,
        rankingPageDurationMs,
        tvAnnouncement,
        tvPresentation,
      },
    });

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
      eventTitle,
      publicUrl,
      rankingPageDurationMs,
      tvAnnouncement,
      tvPresentation,
      serverInfo,
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
