import { describe, expect, it, vi } from 'vitest';
import {
  validateRemoteLogoUrl,
  fetchAndProcessRemoteLogo,
  extractImageBytesFromRequest,
  isPrivateOrLoopbackHost,
} from './logo-transfer';

describe('isPrivateOrLoopbackHost', () => {
  it('detects localhost and local domains', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
    expect(isPrivateOrLoopbackHost('LOCALHOST')).toBe(true);
    expect(isPrivateOrLoopbackHost('server.localhost')).toBe(true);
    expect(isPrivateOrLoopbackHost('device.local')).toBe(true);
    expect(isPrivateOrLoopbackHost('router.internal')).toBe(true);
    expect(isPrivateOrLoopbackHost('host.lan')).toBe(true);
  });

  it('detects IPv4 loopback and private IP ranges', () => {
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('127.1.2.3')).toBe(true);
    expect(isPrivateOrLoopbackHost('0.0.0.0')).toBe(true);
    expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('10.255.255.255')).toBe(true);
    expect(isPrivateOrLoopbackHost('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('172.31.255.255')).toBe(true);
    expect(isPrivateOrLoopbackHost('192.168.1.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('192.168.178.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('169.254.169.254')).toBe(true);
  });

  it('detects IPv6 loopback and private ranges', () => {
    expect(isPrivateOrLoopbackHost('::1')).toBe(true);
    expect(isPrivateOrLoopbackHost('[::1]')).toBe(true);
    expect(isPrivateOrLoopbackHost('::')).toBe(true);
    expect(isPrivateOrLoopbackHost('[::]')).toBe(true);
    expect(isPrivateOrLoopbackHost('fc00::1')).toBe(true);
    expect(isPrivateOrLoopbackHost('[fc00::1]')).toBe(true);
    expect(isPrivateOrLoopbackHost('fe80::1')).toBe(true);
    expect(isPrivateOrLoopbackHost('[fe80::1]')).toBe(true);
  });

  it('permits public Internet hostnames and public IPs', () => {
    expect(isPrivateOrLoopbackHost('feuerwehr.at')).toBe(false);
    expect(isPrivateOrLoopbackHost('assets.feuerwehr.at')).toBe(false);
    expect(isPrivateOrLoopbackHost('cdn.example.com')).toBe(false);
    expect(isPrivateOrLoopbackHost('8.8.8.8')).toBe(false);
    expect(isPrivateOrLoopbackHost('1.1.1.1')).toBe(false);
  });
});

describe('validateRemoteLogoUrl with SSRF guard', () => {
  it('permits valid public HTTP and HTTPS URLs', () => {
    expect(validateRemoteLogoUrl('https://feuerwehr.at/logo.png').isValid).toBe(true);
    expect(validateRemoteLogoUrl('http://cdn.feuerwehr.at/wappen.svg').isValid).toBe(true);
  });

  it('rejects loopback and private network URLs', () => {
    const localhostRes = validateRemoteLogoUrl('http://localhost:3000/logo.png');
    expect(localhostRes.isValid).toBe(false);
    expect(localhostRes.error).toContain('Private und lokale');

    const ip127Res = validateRemoteLogoUrl('http://127.0.0.1/logo.png');
    expect(ip127Res.isValid).toBe(false);
    expect(ip127Res.error).toContain('Private und lokale');

    const metadataRes = validateRemoteLogoUrl('http://169.254.169.254/latest/meta-data');
    expect(metadataRes.isValid).toBe(false);
    expect(metadataRes.error).toContain('Private und lokale');

    const lanRes = validateRemoteLogoUrl('https://192.168.1.100/logo.png');
    expect(lanRes.isValid).toBe(false);
    expect(lanRes.error).toContain('Private und lokale');
  });

  it('rejects invalid or dangerous URL protocols', () => {
    expect(validateRemoteLogoUrl('').isValid).toBe(false);
    expect(validateRemoteLogoUrl('ftp://example.com/logo.png').isValid).toBe(false);
    expect(validateRemoteLogoUrl('javascript:alert(1)').isValid).toBe(false);
    expect(validateRemoteLogoUrl('data:image/png;base64,...').isValid).toBe(false);
    expect(validateRemoteLogoUrl('not a url').isValid).toBe(false);
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
    }
  });

  it('rejects fetch attempt to private IP before network call', async () => {
    const mockFetch = vi.fn();
    const result = await fetchAndProcessRemoteLogo('http://127.0.0.1:8080/secret.png', mockFetch);
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
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
});
