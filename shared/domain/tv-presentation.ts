export const TV_THEMES = ['broadcast', 'ceremony', 'outdoor'] as const;

export type TvTheme = typeof TV_THEMES[number];

export interface TvPresentationConfig {
  theme: TvTheme;
  logoOverride: string;
  headerLabel: string;
  qrCodeEnabled: boolean;
  qrCodeAlwaysVisible: boolean;
  qrCodeIntervalSeconds: number;
  qrCodeDurationSeconds: number;
  adminSplashEnabled: boolean;
}

export const DEFAULT_TV_PRESENTATION: TvPresentationConfig = {
  theme: 'broadcast',
  logoOverride: '',
  headerLabel: 'Feuerwehr Leistungsbewerb',
  qrCodeEnabled: true,
  qrCodeAlwaysVisible: false,
  qrCodeIntervalSeconds: 30,
  qrCodeDurationSeconds: 10,
  adminSplashEnabled: true,
};

const SAME_ORIGIN_VALIDATION_BASE = 'https://same-origin.invalid';

export function normalizeLogoOverride(input: unknown): string {
  if (typeof input !== 'string') return '';

  const value = input.trim();
  if (value.startsWith('/') && !value.startsWith('//')) {
    try {
      const resolved = new URL(value, SAME_ORIGIN_VALIDATION_BASE);
      return resolved.origin === SAME_ORIGIN_VALIDATION_BASE ? value : '';
    } catch {
      return '';
    }
  }

  if (!/^https:\/\//i.test(value)) return '';

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

function normalizeHeaderLabel(input: unknown): string {
  if (typeof input !== 'string') return DEFAULT_TV_PRESENTATION.headerLabel;

  const value = input.trim();
  return value || DEFAULT_TV_PRESENTATION.headerLabel;
}

export function normalizeQrCodeEnabled(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (input === 'false') return false;
  if (input === 'true') return true;
  return DEFAULT_TV_PRESENTATION.qrCodeEnabled;
}

export function normalizeQrCodeAlwaysVisible(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (input === 'false') return false;
  if (input === 'true') return true;
  return DEFAULT_TV_PRESENTATION.qrCodeAlwaysVisible;
}

export function normalizeQrCodeIntervalSeconds(input: unknown): number {
  const num = typeof input === 'number' ? input : Number(input);
  return Number.isInteger(num) && num >= 5 && num <= 3600
    ? num
    : DEFAULT_TV_PRESENTATION.qrCodeIntervalSeconds;
}

export function normalizeQrCodeDurationSeconds(input: unknown): number {
  const num = typeof input === 'number' ? input : Number(input);
  return Number.isInteger(num) && num >= 2 && num <= 300
    ? num
    : DEFAULT_TV_PRESENTATION.qrCodeDurationSeconds;
}

export function normalizeAdminSplashEnabled(input: unknown): boolean {
  if (typeof input === 'boolean') return input;
  if (input === 'false') return false;
  if (input === 'true') return true;
  return DEFAULT_TV_PRESENTATION.adminSplashEnabled;
}

export function normalizeTvPresentation(input: unknown): TvPresentationConfig {
  let parsed = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_TV_PRESENTATION };

  const candidate = parsed as Record<string, unknown>;
  return {
    theme: candidate.theme === 'ceremony' || candidate.theme === 'outdoor' ? candidate.theme : 'broadcast',
    logoOverride: normalizeLogoOverride(candidate.logoOverride),
    headerLabel: normalizeHeaderLabel(candidate.headerLabel),
    qrCodeEnabled: normalizeQrCodeEnabled(candidate.qrCodeEnabled),
    qrCodeAlwaysVisible: normalizeQrCodeAlwaysVisible(candidate.qrCodeAlwaysVisible),
    qrCodeIntervalSeconds: normalizeQrCodeIntervalSeconds(candidate.qrCodeIntervalSeconds),
    qrCodeDurationSeconds: normalizeQrCodeDurationSeconds(candidate.qrCodeDurationSeconds),
    adminSplashEnabled: normalizeAdminSplashEnabled(candidate.adminSplashEnabled),
  };
}

export function parseThemeParam(input: string | null | undefined): TvTheme | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  if ((TV_THEMES as readonly string[]).includes(raw)) {
    return raw as TvTheme;
  }

  const num = parseInt(raw, 10);
  if (!isNaN(num)) {
    if (num === 0) {
      return TV_THEMES[0];
    }
    const index = num - 1;
    if (index >= 0 && index < TV_THEMES.length) {
      return TV_THEMES[index];
    }
  }

  return null;
}

