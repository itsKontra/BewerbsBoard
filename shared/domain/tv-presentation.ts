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

export function validateRemoteLogoUrl(urlInput: unknown): {
  isValid: boolean;
  error?: string;
  url?: URL;
} {
  if (typeof urlInput !== 'string' || !urlInput.trim()) {
    return { isValid: false, error: 'URL ist erforderlich.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlInput.trim());
  } catch {
    return { isValid: false, error: 'Ungültiges URL-Format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Nur HTTP- und HTTPS-URLs werden unterstützt.' };
  }

  if (!parsed.hostname || parsed.hostname.length > 253) {
    return { isValid: false, error: 'Ungültiger Hostname in URL.' };
  }

  return { isValid: true, url: parsed };
}

export async function fetchAndProcessRemoteLogo(
  urlInput: string,
  fetchFn: typeof fetch = fetch
): Promise<ProcessLogoResult> {
  const urlValidation = validateRemoteLogoUrl(urlInput);
  if (!urlValidation.isValid || !urlValidation.url) {
    return {
      success: false,
      error: urlValidation.error || 'Ungültige URL.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetchFn(urlValidation.url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BewerbsBoard-LogoFetcher/1.0',
        'Accept': 'image/png,image/jpeg,image/webp,image/svg+xml,*/*',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Fehler beim Abrufen der URL: HTTP ${response.status}`,
      };
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const parsedLen = Number.parseInt(contentLength, 10);
      if (Number.isFinite(parsedLen) && parsedLen > MAX_LOGO_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: 'Die Datei überschreitet die maximale Größe von 2 MB.',
        };
      }
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const declaredMime = response.headers.get('content-type') || undefined;

    return validateAndProcessLogo(bytes, declaredMime);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        error: 'Zeitüberschreitung beim Herunterladen des Logos.',
      };
    }
    return {
      success: false,
      error: `Verbindungsfehler beim Herunterladen: ${err?.message || 'Unbekannter Fehler'}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractImageBytesFromRequest(request: Request): Promise<{
  bytes: Uint8Array | null;
  declaredMime?: string;
  error?: string;
}> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      let fileBlob: Blob | null = null;

      for (const fieldName of ['file', 'logo', 'image', 'upload']) {
        const item = formData.get(fieldName);
        if (item && typeof item === 'object' && typeof (item as Blob).arrayBuffer === 'function') {
          fileBlob = item as Blob;
          break;
        }
      }

      if (!fileBlob) {
        for (const [, item] of formData.entries()) {
          if (item && typeof item === 'object' && typeof (item as Blob).arrayBuffer === 'function') {
            fileBlob = item as Blob;
            break;
          }
        }
      }

      if (!fileBlob) {
        return { bytes: null, error: 'Keine Datei im Upload gefunden.' };
      }

      const buffer = await fileBlob.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        declaredMime: fileBlob.type || undefined,
      };
    }

    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) {
        return { bytes: null, error: 'Ungültiger JSON-Payload.' };
      }

      let rawData = (body.base64Data ?? body.data ?? body.file ?? body.image) as string | undefined;
      let declaredMime = (body.mimeType ?? body.contentType) as string | undefined;

      if (typeof rawData !== 'string' || !rawData.trim()) {
        return { bytes: null, error: 'Keine Bilddaten im JSON-Payload vorhanden.' };
      }

      rawData = rawData.trim();
      const dataUriMatch = rawData.match(/^data:([^;]+);base64,(.+)$/i);
      if (dataUriMatch) {
        declaredMime = declaredMime || dataUriMatch[1];
        rawData = dataUriMatch[2];
      }

      try {
        const bytes = base64ToUint8Array(rawData);
        return { bytes, declaredMime };
      } catch {
        return { bytes: null, error: 'Ungültige Base64-Codierung der Bilddaten.' };
      }
    }

    const buffer = await request.arrayBuffer().catch(() => null);
    if (!buffer || buffer.byteLength === 0) {
      return { bytes: null, error: 'Keine Bilddaten empfangen.' };
    }

    const declaredMime = request.headers.get('content-type') || undefined;
    return {
      bytes: new Uint8Array(buffer),
      declaredMime,
    };
  } catch (err: any) {
    return { bytes: null, error: err?.message || 'Fehler beim Lesen der Bilddaten.' };
  }
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

