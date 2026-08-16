import type Database from 'better-sqlite3'

export interface TvAnnouncement {
  headline: string
  message: string
}

export interface TvPresentation {
  theme: 'broadcast' | 'ceremony' | 'outdoor'
  logoOverride: string
  headerLabel: string
  qrCodeEnabled: boolean
  qrCodeAlwaysVisible: boolean
  qrCodeIntervalSeconds: number
  qrCodeDurationSeconds: number
  adminSplashEnabled: boolean
}

export interface ApplicationConfiguration {
  eventName: string
  publicUrl: string
  rankingPageDurationMs: number
  tvAnnouncement: TvAnnouncement
  tvPresentation: TvPresentation
}

export type ApplicationConfigurationInput = ApplicationConfiguration

const DEFAULT_CONFIGURATION: ApplicationConfiguration = {
  eventName: 'Feuerwehr Leistungsbewerb',
  publicUrl: 'https://bewerb.feuerwehr.at',
  rankingPageDurationMs: 8000,
  tvAnnouncement: { headline: '', message: '' },
  tvPresentation: {
    theme: 'broadcast',
    logoOverride: '',
    headerLabel: 'Feuerwehr Leistungsbewerb',
    qrCodeEnabled: true,
    qrCodeAlwaysVisible: false,
    qrCodeIntervalSeconds: 30,
    qrCodeDurationSeconds: 10,
    adminSplashEnabled: true,
  },
}

export interface ConfigurationRepository {
  read(): ApplicationConfiguration
  save(configuration: ApplicationConfigurationInput): void
}

export function createConfigurationRepository(sqlite: Database.Database): ConfigurationRepository {
  return {
    read: () => ({
      eventName: readValue(sqlite, 'event:name', DEFAULT_CONFIGURATION.eventName, normalizeText),
      publicUrl: readValue(sqlite, 'public:url', DEFAULT_CONFIGURATION.publicUrl, normalizeText),
      rankingPageDurationMs: readValue(sqlite, 'tv:ranking-page-duration-ms', DEFAULT_CONFIGURATION.rankingPageDurationMs, normalizeRankingPageDurationMs),
      tvAnnouncement: readValue(sqlite, 'tv:announcement', DEFAULT_CONFIGURATION.tvAnnouncement, normalizeAnnouncement),
      tvPresentation: readValue(sqlite, 'tv:presentation', DEFAULT_CONFIGURATION.tvPresentation, normalizePresentation),
    }),
    save: (configuration) => {
      const values = {
        'event:name': normalizeText(configuration.eventName, DEFAULT_CONFIGURATION.eventName),
        'public:url': normalizeText(configuration.publicUrl, DEFAULT_CONFIGURATION.publicUrl),
        'tv:ranking-page-duration-ms': normalizeRankingPageDurationMs(configuration.rankingPageDurationMs, DEFAULT_CONFIGURATION.rankingPageDurationMs),
        'tv:announcement': normalizeAnnouncement(configuration.tvAnnouncement, DEFAULT_CONFIGURATION.tvAnnouncement),
        'tv:presentation': normalizePresentation(configuration.tvPresentation, DEFAULT_CONFIGURATION.tvPresentation),
      }
      const upsert = sqlite.prepare(`
        INSERT INTO app_config (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `)

      sqlite.transaction(() => {
        const updatedAt = Date.now()
        for (const [key, value] of Object.entries(values)) {
          upsert.run(key, JSON.stringify(value), updatedAt)
        }
      })()
    },
  }
}

function readValue<T>(
  sqlite: Database.Database,
  key: string,
  defaultValue: T,
  normalize: (value: unknown, defaultValue: T) => T,
): T {
  const row = sqlite.prepare('SELECT value_json FROM app_config WHERE key = ?').get(key) as { value_json: string } | undefined
  if (!row) {
    return defaultValue
  }

  try {
    return normalize(JSON.parse(row.value_json), defaultValue)
  } catch {
    return defaultValue
  }
}

function normalizeText(value: unknown, defaultValue: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : defaultValue
}

function normalizeAnnouncement(value: unknown, defaultValue: TvAnnouncement): TvAnnouncement {
  if (!isRecord(value)) {
    return defaultValue
  }
  return {
    headline: typeof value.headline === 'string' ? value.headline : '',
    message: typeof value.message === 'string' ? value.message : '',
  }
}

function normalizePresentation(value: unknown, defaultValue: TvPresentation): TvPresentation {
  if (!isRecord(value)) {
    return defaultValue
  }
  const interval = typeof value.qrCodeIntervalSeconds === 'number' && Number.isInteger(value.qrCodeIntervalSeconds) && value.qrCodeIntervalSeconds >= 5 && value.qrCodeIntervalSeconds <= 3600
    ? value.qrCodeIntervalSeconds
    : defaultValue.qrCodeIntervalSeconds
  const duration = typeof value.qrCodeDurationSeconds === 'number' && Number.isInteger(value.qrCodeDurationSeconds) && value.qrCodeDurationSeconds >= 2 && value.qrCodeDurationSeconds <= 300
    ? value.qrCodeDurationSeconds
    : defaultValue.qrCodeDurationSeconds

  return {
    theme: value.theme === 'ceremony' || value.theme === 'outdoor' ? value.theme : 'broadcast',
    logoOverride: normalizeLogoOverride(value.logoOverride),
    headerLabel: normalizeText(value.headerLabel, defaultValue.headerLabel),
    qrCodeEnabled: typeof value.qrCodeEnabled === 'boolean' ? value.qrCodeEnabled : (value.qrCodeEnabled === 'false' ? false : (value.qrCodeEnabled === 'true' ? true : defaultValue.qrCodeEnabled)),
    qrCodeAlwaysVisible: typeof value.qrCodeAlwaysVisible === 'boolean' ? value.qrCodeAlwaysVisible : (value.qrCodeAlwaysVisible === 'false' ? false : (value.qrCodeAlwaysVisible === 'true' ? true : defaultValue.qrCodeAlwaysVisible)),
    qrCodeIntervalSeconds: interval,
    qrCodeDurationSeconds: duration,
    adminSplashEnabled: typeof value.adminSplashEnabled === 'boolean' ? value.adminSplashEnabled : (value.adminSplashEnabled === 'false' ? false : (value.adminSplashEnabled === 'true' ? true : defaultValue.adminSplashEnabled)),
  }
}

function normalizeRankingPageDurationMs(value: unknown, defaultValue: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 300_000
    ? value
    : defaultValue
}

function normalizeLogoOverride(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  const candidate = value.trim()
  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate
  }
  try {
    return new URL(candidate).protocol === 'https:' ? candidate : ''
  } catch {
    return ''
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
