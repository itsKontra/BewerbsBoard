import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  onRequestGet,
  onRequestPut,
  normalizeLogoOverride,
  normalizeTvAnnouncement,
  normalizeTvPresentation,
  normalizeRankingPageDurationMs,
} from './config';
import * as utils from './utils';

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
    logAudit: vi.fn(),
  };
});

describe('Config API Endpoints & Helpers (/api/admin/config)', () => {
  let mockKv: Record<string, string>;
  let kvBinding: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKv = {};

    vi.mocked(utils.getDb).mockReturnValue({} as any);

    kvBinding = {
      get: vi.fn().mockImplementation(async (key: string) => mockKv[key] ?? null),
      put: vi.fn().mockImplementation(async (key: string, val: string) => {
        mockKv[key] = val;
      }),
    };
  });

  describe('Helper functions', () => {
    it('normalizeTvAnnouncement handles strings, objects, and edge cases', () => {
      expect(normalizeTvAnnouncement(null)).toEqual({ headline: '', message: '' });
      expect(normalizeTvAnnouncement('Plain message')).toEqual({ headline: '', message: 'Plain message' });
      expect(normalizeTvAnnouncement(JSON.stringify({ headline: 'H', message: 'M' }))).toEqual({
        headline: 'H',
        message: 'M',
      });
      expect(normalizeTvAnnouncement({ headline: 'Title', message: 'Text' })).toEqual({
        headline: 'Title',
        message: 'Text',
      });
      expect(normalizeTvAnnouncement(123)).toEqual({ headline: '', message: '' });
    });

    it('normalizes television presentation values to safe event-wide defaults', () => {
      expect(normalizeTvPresentation(null)).toEqual({
        theme: 'broadcast',
        logoOverride: '',
        headerLabel: 'Feuerwehr Leistungsbewerb',
        qrCodeEnabled: true,
        qrCodeAlwaysVisible: false,
        qrCodeIntervalSeconds: 30,
        qrCodeDurationSeconds: 10,
        adminSplashEnabled: true,
      });
      expect(normalizeTvPresentation({
        theme: 'ceremony',
        logoOverride: '/event/logo.svg',
        headerLabel: 'Landesbewerb Live',
      })).toEqual({
        theme: 'ceremony',
        logoOverride: '/event/logo.svg',
        headerLabel: 'Landesbewerb Live',
        qrCodeEnabled: true,
        qrCodeAlwaysVisible: false,
        qrCodeIntervalSeconds: 30,
        qrCodeDurationSeconds: 10,
        adminSplashEnabled: true,
      });
      expect(normalizeTvPresentation({
        theme: 'outdoor',
        logoOverride: '/event/logo.svg',
        headerLabel: 'Outdoor Bewerb',
        qrCodeEnabled: false,
        qrCodeAlwaysVisible: true,
        qrCodeIntervalSeconds: 60,
        qrCodeDurationSeconds: 15,
        adminSplashEnabled: false,
      })).toEqual({
        theme: 'outdoor',
        logoOverride: '/event/logo.svg',
        headerLabel: 'Outdoor Bewerb',
        qrCodeEnabled: false,
        qrCodeAlwaysVisible: true,
        qrCodeIntervalSeconds: 60,
        qrCodeDurationSeconds: 15,
        adminSplashEnabled: false,
      });
      expect(normalizeTvPresentation({
        theme: 'unknown',
        logoOverride: 'logo.svg',
        headerLabel: '   ',
      })).toEqual({
        theme: 'broadcast',
        logoOverride: '',
        headerLabel: 'Feuerwehr Leistungsbewerb',
        qrCodeEnabled: true,
        qrCodeAlwaysVisible: false,
        qrCodeIntervalSeconds: 30,
        qrCodeDurationSeconds: 10,
        adminSplashEnabled: true,
      });
      expect(normalizeLogoOverride('https://cdn.example.at/event/logo.png')).toBe(
        'https://cdn.example.at/event/logo.png',
      );
      expect(normalizeLogoOverride('//cdn.example.at/logo.png')).toBe('');
      expect(normalizeLogoOverride('/\\evil.example/logo.png')).toBe('');
      expect(normalizeLogoOverride('http://cdn.example.at/logo.png')).toBe('');
      expect(normalizeLogoOverride('javascript:alert(1)')).toBe('');
    });

    it('accepts ranking page durations between one and 300 seconds', () => {
      expect(normalizeRankingPageDurationMs(12_000)).toBe(12_000);
      expect(normalizeRankingPageDurationMs('12000')).toBe(12_000);
      expect(normalizeRankingPageDurationMs(999)).toBe(8_000);
      expect(normalizeRankingPageDurationMs(300_001)).toBe(8_000);
    });
  });

  const createMockContext = (method: string, body?: any) => {
    const request = new Request('https://example.com/api/admin/config', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (body) {
      request.json = vi.fn().mockResolvedValue(body);
    }
    return {
      request,
      env: { KV: kvBinding, DB: {} },
      data: { adminUser: 'admin@feuerwehr.at' },
      params: {},
    } as any;
  };

  it('GET returns default config when KV is empty', async () => {
    const ctx = createMockContext('GET');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.eventTitle).toBe('Feuerwehr Leistungsbewerb');
    expect(data.publicUrl).toBe('https://bewerb.feuerwehr.at');
    expect(data.rankingPageDurationMs).toBe(8_000);
    expect(data.tvAnnouncement).toEqual({ headline: '', message: '' });
    expect(data.tvPresentation).toEqual({
      theme: 'broadcast',
      logoOverride: '',
      headerLabel: 'Feuerwehr Leistungsbewerb',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    expect(data.categories).toBeUndefined();
  });

  it('GET returns stored KV values when available', async () => {
    mockKv['event:name'] = 'Bezirksbewerb 2026';
    mockKv['public:url'] = 'https://live.feuerwehr.at';
    mockKv['tv:announcement'] = JSON.stringify({ headline: 'Achtung', message: 'Siegerehrung in 15 Min' });
    mockKv['tv:presentation'] = JSON.stringify({ theme: 'ceremony', logoOverride: '/branding/event.svg' });

    const ctx = createMockContext('GET');
    const res = await onRequestGet(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.eventTitle).toBe('Bezirksbewerb 2026');
    expect(data.publicUrl).toBe('https://live.feuerwehr.at');
    expect(data.tvAnnouncement).toEqual({ headline: 'Achtung', message: 'Siegerehrung in 15 Min' });
    expect(data.tvPresentation).toEqual({
      theme: 'ceremony',
      logoOverride: '/branding/event.svg',
      headerLabel: 'Feuerwehr Leistungsbewerb',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    expect(data.categories).toBeUndefined();
  });

  it('PUT updates KV values and creates audit log entry', async () => {
    const payload = {
      eventTitle: 'Landesbewerb 2026',
      publicUrl: 'https://landesbewerb.at',
      rankingPageDurationMs: 12_000,
      tvAnnouncement: { headline: 'Willkommen', message: 'Gute Anreise!' },
      tvPresentation: {
        theme: 'ceremony',
        logoOverride: 'https://assets.example.at/logo.svg',
        headerLabel: 'Landesbewerb Live',
        qrCodeEnabled: false,
        qrCodeAlwaysVisible: true,
        qrCodeIntervalSeconds: 40,
        qrCodeDurationSeconds: 8,
        adminSplashEnabled: false,
      },
    };

    const ctx = createMockContext('PUT', payload);
    const res = await onRequestPut(ctx);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.eventTitle).toBe('Landesbewerb 2026');
    expect(data.publicUrl).toBe('https://landesbewerb.at');
    expect(data.rankingPageDurationMs).toBe(12_000);
    expect(data.tvAnnouncement).toEqual({ headline: 'Willkommen', message: 'Gute Anreise!' });
    expect(data.tvPresentation).toEqual({
      theme: 'ceremony',
      logoOverride: 'https://assets.example.at/logo.svg',
      headerLabel: 'Landesbewerb Live',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: true,
      qrCodeIntervalSeconds: 40,
      qrCodeDurationSeconds: 8,
      adminSplashEnabled: false,
    });

    expect(kvBinding.put).toHaveBeenCalledWith('event:name', 'Landesbewerb 2026');
    expect(kvBinding.put).toHaveBeenCalledWith('public:url', 'https://landesbewerb.at');
    expect(kvBinding.put).toHaveBeenCalledWith('tv:ranking-page-duration-ms', '12000');
    expect(kvBinding.put).toHaveBeenCalledWith(
      'tv:announcement',
      JSON.stringify({ headline: 'Willkommen', message: 'Gute Anreise!' })
    );
    expect(kvBinding.put).toHaveBeenCalledWith(
      'tv:presentation',
      JSON.stringify({
        theme: 'ceremony',
        logoOverride: 'https://assets.example.at/logo.svg',
        headerLabel: 'Landesbewerb Live',
        qrCodeEnabled: false,
        qrCodeAlwaysVisible: true,
        qrCodeIntervalSeconds: 40,
        qrCodeDurationSeconds: 8,
        adminSplashEnabled: false,
      }),
    );

    expect(utils.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      'admin@feuerwehr.at',
      'UPDATE_CONFIG',
      expect.objectContaining({
        operation: 'UPDATE',
        new_value: expect.objectContaining({
          tvPresentation: {
            theme: 'ceremony',
            logoOverride: 'https://assets.example.at/logo.svg',
            headerLabel: 'Landesbewerb Live',
            qrCodeEnabled: false,
            qrCodeAlwaysVisible: true,
            qrCodeIntervalSeconds: 40,
            qrCodeDurationSeconds: 8,
            adminSplashEnabled: false,
          },
        }),
      })
    );
  });

  it('normalizes invalid stored presentation without disrupting the remaining event configuration', async () => {
    mockKv['event:name'] = 'Bezirksbewerb 2026';
    mockKv['tv:presentation'] = JSON.stringify({ theme: 'neon', logoOverride: '../logo.svg' });

    const res = await onRequestGet(createMockContext('GET'));
    const data = await res.json();

    expect(data.eventTitle).toBe('Bezirksbewerb 2026');
    expect(data.tvPresentation).toEqual({
      theme: 'broadcast',
      logoOverride: '',
      headerLabel: 'Feuerwehr Leistungsbewerb',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    expect(data.categories).toBeUndefined();
  });
});
