import { describe, expect, it, vi } from 'vitest';
import {
  parseThemeParam,
  normalizeTvPresentation,
  normalizeLogoOverride,
  isAllowedLogoMimeType,
  normalizeStoredCustomLogo,
  normalizeQrCodeEnabled,
  normalizeQrCodeAlwaysVisible,
  normalizeQrCodeIntervalSeconds,
  normalizeQrCodeDurationSeconds,
  uint8ArrayToBase64,
  base64ToUint8Array,
  detectLogoMimeType,
  sanitizeSvg,
  validateAndProcessLogo,
  validateRemoteLogoUrl,
  fetchAndProcessRemoteLogo,
  extractImageBytesFromRequest,
  BUNDLED_LOGO_PRESETS,
  getLogoPresetId,
} from './tv-presentation';
import { getDemoTvState } from '../../src/mock/demo-scoreboard-data';

describe('parseThemeParam', () => {
  it('parses numeric theme parameters correctly', () => {
    expect(parseThemeParam('1')).toBe('broadcast');
    expect(parseThemeParam('2')).toBe('ceremony');
    expect(parseThemeParam('3')).toBe('outdoor');
    expect(parseThemeParam('0')).toBe('broadcast');
  });

  it('parses string theme parameters case-insensitively', () => {
    expect(parseThemeParam('broadcast')).toBe('broadcast');
    expect(parseThemeParam('Ceremony')).toBe('ceremony');
    expect(parseThemeParam('OUTDOOR')).toBe('outdoor');
  });

  it('returns null for invalid theme parameters', () => {
    expect(parseThemeParam('4')).toBeNull();
    expect(parseThemeParam('invalid')).toBeNull();
    expect(parseThemeParam('')).toBeNull();
    expect(parseThemeParam(null)).toBeNull();
    expect(parseThemeParam(undefined)).toBeNull();
  });
});

describe('getDemoTvState', () => {
  it('returns default demo state theme when no theme param is specified', () => {
    const state = getDemoTvState('?demo=true');
    expect(state.tvPresentation.theme).toBe('broadcast');
  });

  it('overrides theme when ?theme=2 is provided', () => {
    const state = getDemoTvState('?demo=true&theme=2');
    expect(state.tvPresentation.theme).toBe('ceremony');
  });

  it('overrides theme when ?theme=outdoor is provided', () => {
    const state = getDemoTvState('?demo=true&theme=outdoor');
    expect(state.tvPresentation.theme).toBe('outdoor');
  });
});

describe('QR code presentation normalization', () => {
  it('normalizes valid QR configuration inputs', () => {
    const normalized = normalizeTvPresentation({
      theme: 'ceremony',
      logoOverride: '',
      headerLabel: 'Test',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: true,
      qrCodeIntervalSeconds: 45,
      qrCodeDurationSeconds: 15,
    });
    expect(normalized.qrCodeEnabled).toBe(false);
    expect(normalized.qrCodeAlwaysVisible).toBe(true);
    expect(normalized.qrCodeIntervalSeconds).toBe(45);
    expect(normalized.qrCodeDurationSeconds).toBe(15);
  });

  it('falls back to defaults for missing or invalid QR values', () => {
    const normalized = normalizeTvPresentation({});
    expect(normalized.qrCodeEnabled).toBe(true);
    expect(normalized.qrCodeAlwaysVisible).toBe(false);
    expect(normalized.qrCodeIntervalSeconds).toBe(30);
    expect(normalized.qrCodeDurationSeconds).toBe(10);

    const outOfBounds = normalizeTvPresentation({
      qrCodeIntervalSeconds: 2, // below min (5)
      qrCodeDurationSeconds: 400, // above max (300)
    });
    expect(outOfBounds.qrCodeIntervalSeconds).toBe(30);
    expect(outOfBounds.qrCodeDurationSeconds).toBe(10);
  });

  it('parses string values for boolean and numbers', () => {
    expect(normalizeQrCodeEnabled('false')).toBe(false);
    expect(normalizeQrCodeEnabled('true')).toBe(true);
    expect(normalizeQrCodeAlwaysVisible('false')).toBe(false);
    expect(normalizeQrCodeAlwaysVisible('true')).toBe(true);
    expect(normalizeQrCodeIntervalSeconds('60')).toBe(60);
    expect(normalizeQrCodeDurationSeconds('20')).toBe(20);
  });

  it('normalizes admin splash setting with default true', () => {
    expect(normalizeTvPresentation({}).adminSplashEnabled).toBe(true);
    expect(normalizeTvPresentation({ adminSplashEnabled: false }).adminSplashEnabled).toBe(false);
    expect(normalizeTvPresentation({ adminSplashEnabled: 'false' }).adminSplashEnabled).toBe(false);
    expect(normalizeTvPresentation({ adminSplashEnabled: 'true' }).adminSplashEnabled).toBe(true);
    expect(normalizeTvPresentation({ adminSplashEnabled: true }).adminSplashEnabled).toBe(true);
  });
});

describe('Logo options and custom logo validation', () => {
  it('validates allowed image MIME types', () => {
    expect(isAllowedLogoMimeType('image/png')).toBe(true);
    expect(isAllowedLogoMimeType('IMAGE/PNG')).toBe(true);
    expect(isAllowedLogoMimeType('image/jpeg')).toBe(true);
    expect(isAllowedLogoMimeType('image/webp')).toBe(true);
    expect(isAllowedLogoMimeType('image/svg+xml')).toBe(true);
    expect(isAllowedLogoMimeType('image/gif')).toBe(false);
    expect(isAllowedLogoMimeType('application/pdf')).toBe(false);
    expect(isAllowedLogoMimeType('text/html')).toBe(false);
  });

  it('normalizes stored custom logo payload', () => {
    const valid = normalizeStoredCustomLogo({
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      updatedAt: 1700000000000,
    });
    expect(valid).toEqual({
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      updatedAt: 1700000000000,
    });

    expect(normalizeStoredCustomLogo(null)).toBeNull();
    expect(normalizeStoredCustomLogo({})).toBeNull();
    expect(normalizeStoredCustomLogo({ mimeType: 'image/bmp', base64Data: 'abc' })).toBeNull();
    expect(normalizeStoredCustomLogo({ mimeType: 'image/png', base64Data: '' })).toBeNull();
  });

  it('normalizes logo override paths including custom logo endpoint and presets', () => {
    expect(normalizeLogoOverride('/api/public/logo')).toBe('/api/public/logo');
    expect(normalizeLogoOverride('/api/public/logo?v=1700000000')).toBe('/api/public/logo?v=1700000000');
    expect(normalizeLogoOverride('/logo-options/logo_alt_1.png')).toBe('/logo-options/logo_alt_1.png');
    expect(normalizeLogoOverride('/logo-options/logo_alt_2.png')).toBe('/logo-options/logo_alt_2.png');
    expect(normalizeLogoOverride('/logo-options/logo_alt_3.png')).toBe('/logo-options/logo_alt_3.png');
    expect(normalizeLogoOverride('/logo.png')).toBe('/logo.png');
    expect(normalizeLogoOverride('https://cdn.example.at/logo.png')).toBe('https://cdn.example.at/logo.png');
    expect(normalizeLogoOverride('//evil.example/logo.png')).toBe('');
    expect(normalizeLogoOverride('/\\evil.example/logo.png')).toBe('');
    expect(normalizeLogoOverride('http://insecure.example/logo.png')).toBe('');
    expect(normalizeLogoOverride('javascript:alert(1)')).toBe('');
  });
});

describe('Logo MIME detection and Base64 conversion', () => {
  it('converts Uint8Array to base64 and back', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 33]); // 'Hello!'
    const base64 = uint8ArrayToBase64(original);
    expect(base64).toBe('SGVsbG8h');
    const back = base64ToUint8Array(base64);
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it('detects MIME types from magic bytes and declared MIME', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectLogoMimeType(pngBytes)).toBe('image/png');

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(detectLogoMimeType(jpegBytes)).toBe('image/jpeg');

    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0, 0, 0, 0,
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(detectLogoMimeType(webpBytes)).toBe('image/webp');

    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
    expect(detectLogoMimeType(svgBytes, 'image/svg+xml')).toBe('image/svg+xml');
    expect(detectLogoMimeType(svgBytes)).toBe('image/svg+xml');

    const invalidBytes = new Uint8Array([1, 2, 3, 4]);
    expect(detectLogoMimeType(invalidBytes)).toBeNull();
  });
});

describe('SVG Sanitization', () => {
  it('strips script tags and inline event handlers from SVG', () => {
    const maliciousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <script>alert("xss")</script>
        <circle cx="10" cy="10" r="5" onclick="evil()" />
        <a xlink:href="javascript:alert(2)"><text>Click</text></a>
        <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(3)</script></body></foreignObject>
      </svg>
    `;

    const clean = sanitizeSvg(maliciousSvg);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('alert');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('foreignObject');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<circle');
    expect(clean).toContain('<svg');
  });

  it('strips DOCTYPE and XML entities to prevent XXE', () => {
    const xxeSvg = `<?xml version="1.0"?>
      <!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
      <svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>
    `;
    const clean = sanitizeSvg(xxeSvg);
    expect(clean).not.toContain('!DOCTYPE');
    expect(clean).not.toContain('!ENTITY');
    expect(clean).toContain('<svg');
  });
});

describe('validateAndProcessLogo', () => {
  it('rejects empty payloads and files > 2MB', () => {
    expect(validateAndProcessLogo(new Uint8Array([]))).toEqual({
      success: false,
      error: 'Die Datei ist leer.',
    });

    const tooLarge = new Uint8Array(2 * 1024 * 1024 + 1);
    expect(validateAndProcessLogo(tooLarge)).toEqual({
      success: false,
      error: 'Die Datei überschreitet die maximale Größe von 2 MB.',
    });
  });

  it('processes valid PNG image bytes', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const result = validateAndProcessLogo(pngBytes, 'image/png');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.mimeType).toBe('image/png');
      expect(result.base64Data).toBe(uint8ArrayToBase64(pngBytes));
    }
  });

  it('sanitizes and processes SVG image bytes', () => {
    const rawSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="5" cy="5" r="5"/></svg>';
    const svgBytes = new TextEncoder().encode(rawSvg);
    const result = validateAndProcessLogo(svgBytes, 'image/svg+xml');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.mimeType).toBe('image/svg+xml');
      const decoded = new TextDecoder().decode(base64ToUint8Array(result.base64Data));
      expect(decoded).not.toContain('onload');
      expect(decoded).toContain('<circle');
    }
  });
});

describe('validateRemoteLogoUrl', () => {
  it('validates HTTP and HTTPS URLs', () => {
    expect(validateRemoteLogoUrl('https://example.com/logo.png').isValid).toBe(true);
    expect(validateRemoteLogoUrl('http://example.com/logo.svg').isValid).toBe(true);
  });

  it('rejects invalid or dangerous URL protocols', () => {
    expect(validateRemoteLogoUrl('').isValid).toBe(false);
    expect(validateRemoteLogoUrl('ftp://example.com/logo.png').isValid).toBe(false);
    expect(validateRemoteLogoUrl('javascript:alert(1)').isValid).toBe(false);
    expect(validateRemoteLogoUrl('data:image/png;base64,...').isValid).toBe(false);
    expect(validateRemoteLogoUrl('not a url').isValid).toBe(false);
  });
});

describe('extractImageBytesFromRequest', () => {
  it('extracts bytes from multipart/form-data', async () => {
    const formData = new FormData();
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'logo.png', {
      type: 'image/png',
    });
    formData.append('file', file);

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const extracted = await extractImageBytesFromRequest(request);
    expect(extracted.error).toBeUndefined();
    expect(extracted.bytes).toBeDefined();
    expect(extracted.declaredMime).toBe('image/png');
  });

  it('extracts bytes from JSON payload with base64 data', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data: pngBase64,
        mimeType: 'image/png',
      }),
    });

    const extracted = await extractImageBytesFromRequest(request);
    expect(extracted.error).toBeUndefined();
    expect(extracted.bytes).toBeDefined();
    expect(extracted.declaredMime).toBe('image/png');
  });

  it('extracts bytes from raw binary request', async () => {
    const rawBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: rawBytes,
    });

    const extracted = await extractImageBytesFromRequest(request);
    expect(extracted.error).toBeUndefined();
    expect(extracted.bytes).toBeDefined();
    expect(extracted.declaredMime).toBe('image/png');
  });
});

describe('fetchAndProcessRemoteLogo', () => {
  it('downloads, validates, and processes remote PNG logo', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(pngBytes.buffer),
    } as any);

    const result = await fetchAndProcessRemoteLogo('https://feuerwehr.at/logo.png', mockFetch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.mimeType).toBe('image/png');
      expect(result.base64Data).toBe(uint8ArrayToBase64(pngBytes));
    }
  });

  it('handles remote download errors and timeouts', async () => {
    const notFoundFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as any);

    const result = await fetchAndProcessRemoteLogo('https://feuerwehr.at/not-found.png', notFoundFetch);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('404');
    }
  });
});

describe('BUNDLED_LOGO_PRESETS and getLogoPresetId', () => {
  it('contains standard default and 3 alternative preset paths', () => {
    expect(BUNDLED_LOGO_PRESETS).toHaveLength(4);
    expect(BUNDLED_LOGO_PRESETS[0]).toEqual({
      id: 'default',
      path: '/logo.png',
      label: 'Standard',
      subtitle: 'Offizielles Logo',
      description: 'Bundesfeuerwehrverband-Wappen',
    });
    expect(BUNDLED_LOGO_PRESETS[1].path).toBe('/logo-options/logo_alt_1.png');
    expect(BUNDLED_LOGO_PRESETS[2].path).toBe('/logo-options/logo_alt_2.png');
    expect(BUNDLED_LOGO_PRESETS[3].path).toBe('/logo-options/logo_alt_3.png');
  });

  it('identifies preset id based on logoOverride string', () => {
    expect(getLogoPresetId('')).toBe('default');
    expect(getLogoPresetId('   ')).toBe('default');
    expect(getLogoPresetId('/logo.png')).toBe('default');
    expect(getLogoPresetId('/logo-options/logo_alt_1.png')).toBe('alt-1');
    expect(getLogoPresetId('/logo-options/logo_alt_2.png')).toBe('alt-2');
    expect(getLogoPresetId('/logo-options/logo_alt_3.png')).toBe('alt-3');
    expect(getLogoPresetId('/api/public/logo')).toBe('custom');
    expect(getLogoPresetId('/api/public/logo?v=1700000000')).toBe('custom');
    expect(getLogoPresetId('https://example.com/logo.svg')).toBe('custom');
    expect(getLogoPresetId('/branding/custom.png')).toBe('custom');
  });
});

