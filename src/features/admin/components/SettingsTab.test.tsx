// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SettingsTab } from './SettingsTab';

const mockConfigData = {
  eventTitle: 'FEUERWEHR LEISTUNGSBEWERB 2026',
  publicUrl: 'https://live.feuerwehr.at',
  rankingPageDurationMs: 12000,
  tvAnnouncement: {
    headline: 'Wichtige Durchsage',
    message: 'Siegerehrung startet in 15 Minuten.',
  },
  tvPresentation: {
    theme: 'broadcast',
    logoOverride: '',
    headerLabel: 'Feuerwehr Leistungsbewerb',
    qrCodeEnabled: true,
    qrCodeAlwaysVisible: false,
    qrCodeIntervalSeconds: 30,
    qrCodeDurationSeconds: 10,
  },
  categories: {
    'bronze-aktiv': { name: 'Bronze Aktiv', publicEnabled: true, tvEnabled: true, displayDuration: 10, order: 1 },
    'silber-aktiv': { name: 'Silber Aktiv', publicEnabled: true, tvEnabled: true, displayDuration: 10, order: 2 },
    'bronze-jugend': { name: 'Bronze Jugend', publicEnabled: true, tvEnabled: true, displayDuration: 10, order: 3 },
    'bronze-gaeste': { name: 'Bronze Gäste', publicEnabled: false, tvEnabled: true, displayDuration: 12, order: 4 },
    'silber-gaeste': { name: 'Silber Gäste', publicEnabled: true, tvEnabled: false, displayDuration: 10, order: 5 },
    'gesamt-aktiv': { name: 'Gesamtwertung Aktiv', publicEnabled: true, tvEnabled: true, displayDuration: 15, order: 6 },
    'gesamt-feuerwehr': { name: 'Gesamtwertung Feuerwehr', publicEnabled: true, tvEnabled: true, displayDuration: 10, order: 7 },
  },
};

const mockCategoryTypes = [
  { id: 'bronze-aktiv', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: true },
  { id: 'silber-aktiv', name: 'Silber Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: true },
  { id: 'bronze-jugend', name: 'Bronze Jugend', competitionClassId: 'cc-jugend', hasRelayRace: false },
];

const mockCompetitionClasses = [
  { id: 'cc-aktiv', name: 'AKTIV' },
  { id: 'cc-jugend', name: 'JUGEND' },
];

const mockEvaluationTypes = [
  {
    id: 'gesamt-aktiv',
    name: 'Gesamtwertung Aktiv',
    categoryTypeId1: 'bronze-aktiv',
    categoryTypeName1: 'Bronze Aktiv',
    hasRelayRace1: true,
    categoryTypeId2: 'silber-aktiv',
    categoryTypeName2: 'Silber Aktiv',
    hasRelayRace2: true,
    excludeRelayRace: false,
    public: true,
    publicTv: true,
    displayDurationSeconds: 15,
    order: 1,
  },
  {
    id: 'bronze-jugend-wertung',
    name: 'Bronze Jugend Einzel',
    categoryTypeId1: 'bronze-jugend',
    categoryTypeName1: 'Bronze Jugend',
    hasRelayRace1: false,
    categoryTypeId2: null,
    categoryTypeName2: null,
    hasRelayRace2: false,
    excludeRelayRace: true,
    public: true,
    publicTv: false,
    displayDurationSeconds: 8,
    order: 2,
  },
];

describe('SettingsTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/config') {
        if (!init || init.method === 'GET') {
          return {
            ok: true,
            json: async () => mockConfigData,
          } as Response;
        }
        if (init.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => body,
          } as Response;
        }
      }
      if (url === '/api/admin/category-types') {
        if (!init || init.method === 'GET') {
          return {
            ok: true,
            json: async () => mockCategoryTypes,
          } as Response;
        }
        if (init.method === 'POST') {
          const body = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({
              id: body.id || 'new-cat-id',
              name: body.name,
              competitionClassId: body.competitionClassId,
              hasRelayRace: body.hasRelayRace,
            }),
          } as Response;
        }
      }
      if (url === '/api/admin/competition-classes') {
        return { ok: true, json: async () => mockCompetitionClasses } as Response;
      }
      if (url.startsWith('/api/admin/category-types/')) {
        const id = url.split('/').pop();
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          const existing = mockCategoryTypes.find((c) => c.id === id) || mockCategoryTypes[0];
          return {
            ok: true,
            json: async () => ({
              ...existing,
              ...body,
            }),
          } as Response;
        }
        if (init?.method === 'DELETE') {
          return {
            ok: true,
            json: async () => ({ success: true, deletedId: id }),
          } as Response;
        }
      }
      if (url === '/api/admin/evaluation-types') {
        if (!init || init.method === 'GET') {
          return {
            ok: true,
            json: async () => mockEvaluationTypes,
          } as Response;
        }
        if (init.method === 'POST') {
          const body = JSON.parse(init.body as string);
          return {
            ok: true,
            json: async () => ({
              id: body.id || 'new-eval-id',
              name: body.name,
              categoryTypeId1: body.categoryTypeId1,
              categoryTypeName1: mockCategoryTypes.find((c) => c.id === body.categoryTypeId1)?.name || '',
              categoryTypeId2: body.categoryTypeId2 || null,
              categoryTypeName2: mockCategoryTypes.find((c) => c.id === body.categoryTypeId2)?.name || null,
              excludeRelayRace: body.excludeRelayRace ?? false,
              public: body.public ?? true,
              publicTv: body.publicTv ?? true,
              displayDurationSeconds: body.displayDurationSeconds ?? 10,
              order: body.order ?? 3,
            }),
          } as Response;
        }
      }
      if (url.startsWith('/api/admin/evaluation-types/')) {
        const id = url.split('/').pop();
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          const existing = mockEvaluationTypes.find((e) => e.id === id) || mockEvaluationTypes[0];
          return {
            ok: true,
            json: async () => ({
              ...existing,
              ...body,
            }),
          } as Response;
        }
        if (init?.method === 'DELETE') {
          return {
            ok: true,
            json: async () => ({ success: true, deletedId: id }),
          } as Response;
        }
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches and displays initial configuration settings', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('FEUERWEHR LEISTUNGSBEWERB 2026')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('https://live.feuerwehr.at')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Broadcast/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Ceremony/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Outdoor Light/i })).not.toBeChecked();

    // Verify QR code overlay settings
    expect(screen.getByLabelText(/Aktiviert \(Anzeigen\)/i)).toBeChecked();
    expect(screen.getByLabelText('Einblenden alle (Sekunden)')).toHaveValue(30);
    expect(screen.getByLabelText('Anzeigedauer (Sekunden)')).toHaveValue(10);
  });

  it('saves the selected visual preview card and logo override with existing configuration', async () => {
    render(<SettingsTab />);

    const ceremonyCard = await screen.findByRole('radio', { name: /Ceremony/i });
    fireEvent.click(ceremonyCard);
    fireEvent.change(screen.getByLabelText('Alternativ-Logo'), {
      target: { value: '/branding/landesbewerb.svg' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Änderungen speichern/i }));

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation).toEqual({
        theme: 'ceremony',
        logoOverride: '/branding/landesbewerb.svg',
        headerLabel: 'Feuerwehr Leistungsbewerb',
        qrCodeEnabled: true,
        qrCodeAlwaysVisible: false,
        qrCodeIntervalSeconds: 30,
        qrCodeDurationSeconds: 10,
        adminSplashEnabled: true,
      });
      expect(body.eventTitle).toBe('FEUERWEHR LEISTUNGSBEWERB 2026');
      expect(body.tvAnnouncement).toEqual(mockConfigData.tvAnnouncement);
    });
  });

  it('allows the Identity Rail header label to be edited and saved', async () => {
    render(<SettingsTab />);

    const headerLabelInput = await screen.findByLabelText('TV-Kopfzeile');
    expect(headerLabelInput).toHaveValue('Feuerwehr Leistungsbewerb');

    fireEvent.change(headerLabelInput, {
      target: { value: 'Landesbewerb Live' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Änderungen speichern/i }));

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation.headerLabel).toBe('Landesbewerb Live');
    });
  });

  it('allows editing TV QR-Code overlay settings and submitting updated configuration', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('FEUERWEHR LEISTUNGSBEWERB 2026')).toBeInTheDocument();
    });

    const intervalInput = screen.getByLabelText('Einblenden alle (Sekunden)');
    const durationInput = screen.getByLabelText('Anzeigedauer (Sekunden)');
    fireEvent.change(intervalInput, { target: { value: '45' } });
    fireEvent.change(durationInput, { target: { value: '15' } });

    const saveButton = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation.qrCodeEnabled).toBe(true);
      expect(body.tvPresentation.qrCodeAlwaysVisible).toBe(false);
      expect(body.tvPresentation.qrCodeIntervalSeconds).toBe(45);
      expect(body.tvPresentation.qrCodeDurationSeconds).toBe(15);
    });
  });

  it('allows toggling QR-Code always visible option and saving setting', async () => {
    render(<SettingsTab />);

    const alwaysVisibleToggle = await screen.findByLabelText(/Dauerhaft anzeigen/i);
    expect(alwaysVisibleToggle).not.toBeChecked();

    fireEvent.click(alwaysVisibleToggle);
    expect(alwaysVisibleToggle).toBeChecked();
    expect(screen.getByText(/Der QR-Code wird dauerhaft oben im TV-Scoreboard eingeblendet/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation.qrCodeAlwaysVisible).toBe(true);
    });
  });

  it('allows toggling QR-Code overlay off and saving disabled state', async () => {
    render(<SettingsTab />);

    const qrToggle = await screen.findByLabelText(/Aktiviert \(Anzeigen\)/i);
    fireEvent.click(qrToggle);

    expect(screen.getByText('QR-Code Einblendung ist auf allen TV-Scoreboards vollständig ausgeblendet.')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation.qrCodeEnabled).toBe(false);
    });
  });

  it('allows editing fields and submitting updated configuration', async () => {
    render(<SettingsTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('FEUERWEHR LEISTUNGSBEWERB 2026')).toBeInTheDocument();
    });

    // Edit event title
    const titleInput = screen.getByLabelText('Bewerbsbezeichnung / Titel');
    fireEvent.change(titleInput, { target: { value: 'Neuer Landesbewerb' } });

    // Submit form
    const saveButton = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/config',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Neuer Landesbewerb'),
        })
      );
      expect(screen.getByText('Einstellungen erfolgreich gespeichert!')).toBeInTheDocument();
    });
  });

  it('allows toggling admin splash notice off and saving setting', async () => {
    render(<SettingsTab />);

    // Switch to QR-Code & URL subtab
    const qrTabBtn = await screen.findByRole('button', { name: /QR-Code & URL/i });
    fireEvent.click(qrTabBtn);

    const splashToggle = await screen.findByLabelText(/Admin-Zugang auf TV anzeigen/i);
    expect(splashToggle).toBeChecked();

    fireEvent.click(splashToggle);
    expect(splashToggle).not.toBeChecked();

    const saveButton = screen.getByRole('button', { name: /Änderungen speichern/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const putCall = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall?.[1]?.body as string);
      expect(body.tvPresentation.adminSplashEnabled).toBe(false);
    });
  });

  it('switches to Datenverwaltung subtab and displays data management controls', async () => {
    render(<SettingsTab />);

    const dataTabBtn = await screen.findByRole('button', { name: /Datenverwaltung/i });
    fireEvent.click(dataTabBtn);

    expect(screen.getByText('Daten-Export & Import')).toBeInTheDocument();
    expect(screen.getByText('Bewerbsdaten exportieren (JSON)')).toBeInTheDocument();
  });
});
