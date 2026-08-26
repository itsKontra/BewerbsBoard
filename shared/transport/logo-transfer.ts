import {
  MAX_LOGO_FILE_SIZE_BYTES,
  validateAndProcessLogo,
  base64ToUint8Array,
  type ProcessLogoResult,
} from '../domain/tv-presentation.js';

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1'
  ) {
    return true;
  }

  // IPv4 check
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1s, o2s, o3s, o4s] = ipv4Match;
    const o1 = Number(o1s);
    const o2 = Number(o2s);
    const o3 = Number(o3s);
    const o4 = Number(o4s);

    if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
      return true;
    }

    // 127.0.0.0/8 (Loopback)
    if (o1 === 127) return true;
    // 0.0.0.0/8
    if (o1 === 0) return true;
    // 10.0.0.0/8 (Private)
    if (o1 === 10) return true;
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (o1 === 192 && o2 === 168) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (o1 === 169 && o2 === 254) return true;
    // 100.64.0.0/10 (CGNAT)
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
    // 192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    if (o1 === 192 && o2 === 0 && (o3 === 0 || o3 === 2)) return true;
    if (o1 === 198 && o2 === 51 && o3 === 100) return true;
    if (o1 === 203 && o2 === 0 && o3 === 113) return true;
    // 224.0.0.0/4 (Multicast) or 240.0.0.0/4 (Reserved)
    if (o1 >= 224) return true;

    return false;
  }

  // IPv6 check
  if (
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe8') ||
    host.startsWith('fe9') ||
    host.startsWith('fea') ||
    host.startsWith('feb') ||
    host.startsWith('ff') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    host.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
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

  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    return {
      isValid: false,
      error: 'Private und lokale IP-Adressen sind aus Sicherheitsgründen nicht erlaubt.',
    };
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
        Accept: 'image/png,image/jpeg,image/webp,image/svg+xml,*/*',
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
      const item = formData.get('file') ?? formData.get('logo');
      if (!item || typeof item !== 'object' || typeof (item as Blob).arrayBuffer !== 'function') {
        return { bytes: null, error: 'Keine Datei im Upload gefunden.' };
      }

      const fileBlob = item as Blob;
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

      let rawData = (body.base64Data ?? body.data) as string | undefined;
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
