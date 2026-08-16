import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './tv-state';
import * as utils from '../admin/utils';

vi.mock('../admin/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../admin/utils')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Public TV state API (/api/public/tv-state)', () => {
  let kvData: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    kvData = {};

    const all = vi.fn().mockResolvedValue([
      { id: 'default', mode: 'FIXED', selectedCategoryId: 'bronze-aktiv', updatedAt: 1723100000000 },
    ]);
    const where = vi.fn().mockReturnValue({ all });
    const from = vi.fn().mockReturnValue({ where });
    vi.mocked(utils.getDb).mockReturnValue({ select: vi.fn().mockReturnValue({ from }) } as any);
  });

  function createContext() {
    const kv = {
      get: vi.fn().mockImplementation(async (key: string) => kvData[key] ?? null),
    };

    return {
      request: new Request('https://example.com/api/public/tv-state'),
      env: { DB: {}, KV: kv },
      data: {},
      params: {},
    } as any;
  }

  it('projects the default Broadcast presentation with the bundled logo', async () => {
    const response = await onRequestGet(createContext());
    const data = await response.json();

    expect(data.tvPresentation).toEqual({
      theme: 'broadcast',
      logoUrl: '/logo.png',
      headerLabel: 'Feuerwehr Leistungsbewerb',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    expect(data.mode).toBe('FIXED');
    expect(data.selectedCategoryId).toBe('bronze-aktiv');
    expect(data.rankingPageDurationMs).toBe(8000);
  });

  it('projects a saved Ceremony presentation without altering live TV configuration', async () => {
    kvData['event:name'] = 'Landesbewerb 2026';
    kvData['tv:announcement'] = JSON.stringify({ headline: 'Achtung', message: 'Beginn um 18 Uhr' });
    kvData['tv:presentation'] = JSON.stringify({
      theme: 'ceremony',
      logoOverride: 'https://assets.example.at/landesbewerb.svg',
      headerLabel: 'Landesbewerb Live',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    kvData['tv:ranking-page-duration-ms'] = '12000';

    const response = await onRequestGet(createContext());
    const data = await response.json();

    expect(data.tvPresentation).toEqual({
      theme: 'ceremony',
      logoUrl: 'https://assets.example.at/landesbewerb.svg',
      headerLabel: 'Landesbewerb Live',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
    expect(data).toMatchObject({
      mode: 'FIXED',
      selectedCategoryId: 'bronze-aktiv',
      eventTitle: 'Landesbewerb 2026',
      tvAnnouncement: { headline: 'Achtung', message: 'Beginn um 18 Uhr' },
    });
    expect(data.categoriesConfig).toEqual({});
    expect(data.rankingPageDurationMs).toBe(12000);
  });

  it('uses Evaluation Type settings for the TV category configuration', async () => {
    const all = vi.fn()
      .mockResolvedValueOnce([
        { id: 'default', mode: 'ROTATION', selectedCategoryId: null, updatedAt: 1723100000000 },
      ])
      .mockResolvedValueOnce([
        { id: 'bronze-aktiv', name: 'Bronze Aktiv', public: true, public_tv: true, displayDurationSeconds: 10, order: 1 },
      ]);
    const where = vi.fn().mockReturnValue({ all });
    const from = vi.fn().mockReturnValue({ where, all });
    vi.mocked(utils.getDb).mockReturnValue({ select: vi.fn().mockReturnValue({ from }) } as any);

    const response = await onRequestGet(createContext());
    const data = await response.json();

    expect(data.categoriesConfig['bronze-aktiv'].tvEnabled).toBe(true);
  });

  it('projects an Outdoor Light presentation', async () => {
    kvData['tv:presentation'] = JSON.stringify({
      theme: 'outdoor',
      logoOverride: '/outdoor-logo.svg',
      headerLabel: 'Outdoor Cup',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 60,
      qrCodeDurationSeconds: 15,
      adminSplashEnabled: true,
    });

    const response = await onRequestGet(createContext());
    const data = await response.json();

    expect(data.tvPresentation).toEqual({
      theme: 'outdoor',
      logoUrl: '/outdoor-logo.svg',
      headerLabel: 'Outdoor Cup',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 60,
      qrCodeDurationSeconds: 15,
      adminSplashEnabled: true,
    });
  });

  it('falls back to the bundled Broadcast presentation for invalid saved values', async () => {
    kvData['tv:presentation'] = JSON.stringify({ theme: 'laser', logoOverride: 'http://unsafe.example/logo.svg' });

    const response = await onRequestGet(createContext());
    const data = await response.json();

    expect(data.tvPresentation).toEqual({
      theme: 'broadcast',
      logoUrl: '/logo.png',
      headerLabel: 'Feuerwehr Leistungsbewerb',
      qrCodeEnabled: true,
      qrCodeAlwaysVisible: false,
      qrCodeIntervalSeconds: 30,
      qrCodeDurationSeconds: 10,
      adminSplashEnabled: true,
    });
  });
});
