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

export interface LogoPresetDefinition {
  id: string;
  path: string;
  label: string;
  subtitle: string;
  description: string;
}

export const BUNDLED_LOGO_PRESETS: readonly LogoPresetDefinition[] = [
  {
    id: 'default',
    path: '/logo.png',
    label: 'Standard',
    subtitle: 'Offizielles Logo',
    description: 'Bundesfeuerwehrverband-Wappen',
  },
  {
    id: 'alt-1',
    path: '/logo-options/logo_alt_1.png',
    label: 'Alternative 1',
    subtitle: 'Design 1',
    description: 'Korpsabzeichen Rot / Gold',
  },
  {
    id: 'alt-2',
    path: '/logo-options/logo_alt_2.png',
    label: 'Alternative 2',
    subtitle: 'Design 2',
    description: 'Bundeswappen Emblem',
  },
  {
    id: 'alt-3',
    path: '/logo-options/logo_alt_3.png',
    label: 'Alternative 3',
    subtitle: 'Design 3',
    description: 'Landesfeuerwehr Wappen',
  },
] as const;

export function getLogoPresetId(logoOverride: string): string {
  const trimmed = (logoOverride || '').trim();
  if (!trimmed || trimmed === '/logo.png') {
    return 'default';
  }
  const found = BUNDLED_LOGO_PRESETS.find((p) => p.path === trimmed);
  if (found) {
    return found.id;
  }
  return 'custom';
}

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

export type AllowedLogoMimeType = typeof ALLOWED_LOGO_MIME_TYPES[number];

export interface StoredCustomLogo {
  mimeType: AllowedLogoMimeType;
  base64Data: string;
  updatedAt: number;
}

export function isAllowedLogoMimeType(mime: string): mime is AllowedLogoMimeType {
  return (ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}

export const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const globalObj = globalThis as unknown as {
    Buffer?: { from: (b: any, offset: number, len: number) => { toString: (enc: string) => string } };
  };
  if (globalObj.Buffer) {
    return globalObj.Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const globalObj = globalThis as unknown as {
    Buffer?: { from: (str: string, enc: string) => { buffer: any; byteOffset: number; byteLength: number } };
  };
  if (globalObj.Buffer) {
    const buf = globalObj.Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function normalizeStoredCustomLogo(input: unknown): StoredCustomLogo | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.mimeType !== 'string' ||
    !isAllowedLogoMimeType(candidate.mimeType) ||
    typeof candidate.base64Data !== 'string' ||
    !candidate.base64Data.trim()
  ) {
    return null;
  }
  const updatedAt = typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
    ? candidate.updatedAt
    : Date.now();

  return {
    mimeType: candidate.mimeType.toLowerCase() as AllowedLogoMimeType,
    base64Data: candidate.base64Data.trim(),
    updatedAt,
  };
}

export function detectLogoMimeType(
  bytes: Uint8Array,
  declaredMime?: string
): AllowedLogoMimeType | null {
  const cleanDeclared = declaredMime
    ? declaredMime.split(';')[0].trim().toLowerCase()
    : undefined;

  // Check magic bytes for PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // Check magic bytes for JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // Check magic bytes for WebP: 'RIFF' .... 'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Check declared MIME aliases
  if (cleanDeclared === 'image/png' || cleanDeclared === 'image/x-png') {
    return 'image/png';
  }
  if (cleanDeclared === 'image/jpeg' || cleanDeclared === 'image/jpg' || cleanDeclared === 'image/pjpeg') {
    return 'image/jpeg';
  }
  if (cleanDeclared === 'image/webp' || cleanDeclared === 'image/x-webp') {
    return 'image/webp';
  }

  // Check SVG: Text-based XML/SVG check
  if (
    cleanDeclared === 'image/svg+xml' ||
    cleanDeclared === 'image/svg' ||
    cleanDeclared === 'text/xml' ||
    cleanDeclared === 'application/xml' ||
    !cleanDeclared
  ) {
    try {
      const sampleLength = Math.min(bytes.length, 1024);
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const prefix = decoder.decode(bytes.subarray(0, sampleLength)).trim();
      if (/<svg[\s>]/i.test(prefix) || (prefix.startsWith('<?xml') && /<svg[\s>]/i.test(prefix))) {
        return 'image/svg+xml';
      }
      // If entire content is relatively short, check full string
      if (bytes.length <= 64 * 1024) {
        const full = decoder.decode(bytes);
        if (/<svg[\s>]/i.test(full)) {
          return 'image/svg+xml';
        }
      }
    } catch {
      // not text/svg
    }
  }

  return null;
}

export function sanitizeSvg(svgText: string): string {
  let clean = svgText;

  // Strip DOCTYPE and XML entities (prevents XXE)
  clean = clean.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  clean = clean.replace(/<!ENTITY[\s\S]*?>/gi, '');

  // Strip XML processing instructions except basic <?xml ...?>
  clean = clean.replace(/<\?(?!xml\s)[\s\S]*?\?>/gi, '');

  // Strip <script> tags and content
  clean = clean.replace(/<script\b[\s\S]*?(?:<\/script\s*>|\/>)/gi, '');
  clean = clean.replace(/<script\b[^>]*>/gi, '');
  clean = clean.replace(/<\/script\s*>/gi, '');

  // Strip dangerous elements
  const dangerousTags = [
    'object',
    'embed',
    'iframe',
    'foreignObject',
    'applet',
    'meta',
    'link',
    'audio',
    'video',
  ];
  for (const tag of dangerousTags) {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?(?:<\\/${tag}\\s*>|\\/>)`, 'gi');
    clean = clean.replace(re, '');
    clean = clean.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '');
    clean = clean.replace(new RegExp(`<\\/${tag}\\s*>`, 'gi'), '');
  }

  // Strip inline event handlers (onload, onerror, onclick, onmouseover, etc.)
  clean = clean.replace(/\s+on[a-z0-9_]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip dangerous href / xlink:href / src attributes containing javascript: or data:text/html
  clean = clean.replace(
    /\s+(?:(?:xlink:)?href|src|action|formaction)\s*=\s*(?:"\s*(?:javascript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|data\s*:\s*text\/html)[^']*'|[^\s>]+javascript:[^\s>]+)/gi,
    ''
  );

  // Strip style attributes containing expression(...) or javascript: or url(javascript:...)
  clean = clean.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, (match) => {
    if (/expression|javascript:|@import/i.test(match)) {
      return '';
    }
    return match;
  });

  // Strip dangerous content inside <style> blocks
  clean = clean.replace(/<style\b[\s\S]*?<\/style>/gi, (match) => {
    if (/expression|javascript:|@import/i.test(match)) {
      return '';
    }
    return match;
  });

  return clean.trim();
}

export interface ProcessLogoSuccess {
  success: true;
  mimeType: AllowedLogoMimeType;
  base64Data: string;
}

export interface ProcessLogoFailure {
  success: false;
  error: string;
}

export type ProcessLogoResult = ProcessLogoSuccess | ProcessLogoFailure;

export function validateAndProcessLogo(
  bytes: Uint8Array,
  declaredMime?: string
): ProcessLogoResult {
  if (!bytes || bytes.length === 0) {
    return { success: false, error: 'Die Datei ist leer.' };
  }

  if (bytes.length > MAX_LOGO_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: 'Die Datei überschreitet die maximale Größe von 2 MB.',
    };
  }

  const mimeType = detectLogoMimeType(bytes, declaredMime);
  if (!mimeType) {
    return {
      success: false,
      error: 'Nicht unterstützter Dateityp. Erlaubt sind PNG, JPEG, WebP und SVG.',
    };
  }

  if (mimeType === 'image/svg+xml') {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { success: false, error: 'Ungültiges SVG UTF-8 Format.' };
    }

    if (!/<svg[\s>]/i.test(text)) {
      return { success: false, error: 'Die Datei enthält kein gültiges SVG-Element.' };
    }

    const sanitized = sanitizeSvg(text);
    if (!/<svg[\s>]/i.test(sanitized)) {
      return {
        success: false,
        error: 'Die SVG-Datei enthält nach der Bereinigung keine gültigen SVG-Elemente.',
      };
    }

    const sanitizedBytes = new TextEncoder().encode(sanitized);
    if (sanitizedBytes.length > MAX_LOGO_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: 'Die bereinigte Datei überschreitet die maximale Größe von 2 MB.',
      };
    }

    const base64Data = uint8ArrayToBase64(sanitizedBytes);
    return {
      success: true,
      mimeType,
      base64Data,
    };
  }

  // Binary image: PNG, JPEG, WebP
  const base64Data = uint8ArrayToBase64(bytes);
  return {
    success: true,
    mimeType,
    base64Data,
  };
}

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

