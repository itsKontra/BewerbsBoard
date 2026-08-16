// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BroadcastTab } from './BroadcastTab';

const mockTvState = {
  mode: 'ROTATION',
  selectedCategoryId: null,
  updatedAt: 1723100000000,
};

const mockConfigData = {
  eventTitle: 'Feuerwehr Leistungsbewerb',
  rankingPageDurationMs: 8000,
  tvAnnouncement: { headline: 'Achtung', message: 'Test Durchsage' },
};

describe('BroadcastTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/tv-state') {
        if (!init || init.method === 'GET') {
          return { ok: true, json: async () => mockTvState } as Response;
        }
        if (init.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          return { ok: true, json: async () => ({ ...mockTvState, ...body }) } as Response;
        }
      }
      if (url === '/api/admin/config') {
        return { ok: true, json: async () => mockConfigData } as Response;
      }
      if (url === '/api/admin/evaluation-types') {
        return { ok: true, json: async () => [
          { id: 'bronze-aktiv', name: 'Bronze Aktiv', public: true, publicTv: true, displayDurationSeconds: 10, order: 1 },
          { id: 'silber-aktiv', name: 'Silber Aktiv', public: true, publicTv: true, displayDurationSeconds: 10, order: 2 },
        ] } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders correctly and fetches initial state', async () => {
    render(<BroadcastTab />);

    await waitFor(() => {
      expect(screen.getByText('Live Hallen-TV Steuerung')).toBeInTheDocument();
    });

    expect(screen.getByText('ROTATION')).toBeInTheDocument(); // active mode indicator
    expect(screen.getByText('Automatische Rotation')).toBeInTheDocument();
    expect(screen.getByText('Achtung')).toBeInTheDocument();
    expect(screen.getByText('Test Durchsage')).toBeInTheDocument();
  });

  it('switches to MESSAGE mode on click', async () => {
    render(<BroadcastTab />);
    await waitFor(() => expect(screen.getByText('Live Hallen-TV Steuerung')).toBeInTheDocument());

    const messageBtn = screen.getByText('Durchsage / Info Screen').closest('div');
    fireEvent.click(messageBtn!);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/tv-state', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ mode: 'MESSAGE', selectedCategoryId: null }),
      }));
    });
  });

  it('switches to FIXED mode and sets first category by default if none selected', async () => {
    render(<BroadcastTab />);
    await waitFor(() => expect(screen.getByText('Live Hallen-TV Steuerung')).toBeInTheDocument());

    const fixedBtn = screen.getByText('Fixierte Kategorie').closest('div');
    fireEvent.click(fixedBtn!);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/tv-state', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ mode: 'FIXED', selectedCategoryId: 'bronze-aktiv' }),
      }));
    });
  });

  it('allows inline editing of announcement and saving it with direct activation', async () => {
    render(<BroadcastTab />);
    await waitFor(() => expect(screen.getByText('Live Hallen-TV Steuerung')).toBeInTheDocument());

    // Toggle edit mode
    const editBtn = screen.getByRole('button', { name: /Text bearbeiten/i });
    fireEvent.click(editBtn);

    // Edit fields
    const headlineInput = screen.getByLabelText('Titel');
    const messageInput = screen.getByLabelText('Nachricht');

    fireEvent.change(headlineInput, { target: { value: 'Siegerehrung Neu' } });
    fireEvent.change(messageInput, { target: { value: 'Beginn um 18:00 Uhr' } });

    // Click save & broadcast
    const saveBroadcastBtn = screen.getByRole('button', { name: /Speichern & auf TV anzeigen/i });
    fireEvent.click(saveBroadcastBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/config', expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('Siegerehrung Neu'),
      }));
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/tv-state', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ mode: 'MESSAGE', selectedCategoryId: null }),
      }));
    });
  });

  it('loads and saves the ranking page interval in seconds', async () => {
    render(<BroadcastTab />);
    await waitFor(() => expect(screen.getByText('Live Hallen-TV Steuerung')).toBeInTheDocument());

    const durationInput = screen.getByLabelText('Seitenwechsel (Sekunden)') as HTMLInputElement;
    expect(durationInput).toHaveValue(8);

    fireEvent.change(durationInput, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seitendauer speichern' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/config', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ ...mockConfigData, rankingPageDurationMs: 15000 }),
      }));
    });
  });

  it('populates category and evaluation options in FIXED mode dropdown from evaluation-types endpoint', async () => {
    (globalThis.fetch as any).mockImplementation(async (url: string) => {
      if (url === '/api/admin/tv-state') {
        return { ok: true, json: async () => ({ ...mockTvState, mode: 'FIXED', selectedCategoryId: 'custom-eval' }) } as Response;
      }
      if (url === '/api/admin/config') {
        return { ok: true, json: async () => mockConfigData } as Response;
      }
      if (url === '/api/admin/evaluation-types') {
        return {
          ok: true,
          json: async () => [
            { id: 'custom-eval', name: 'Kombi-Wertung Aktiv & Gäste', order: 1 },
          ],
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(<BroadcastTab />);

    await waitFor(() => {
      expect(screen.getAllByText('Kombi-Wertung Aktiv & Gäste').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays admin splash banner when active and allows disabling it', async () => {
    (globalThis.fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/tv-state') {
        return { ok: true, json: async () => mockTvState } as Response;
      }
      if (url === '/api/admin/config') {
        if (init?.method === 'PUT') {
          const body = JSON.parse(init.body as string);
          return { ok: true, json: async () => body } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            ...mockConfigData,
            tvPresentation: {
              adminSplashEnabled: true,
            },
          }),
        } as Response;
      }
      if (url === '/api/admin/evaluation-types') {
        return { ok: true, json: async () => [] } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    render(<BroadcastTab />);

    const banner = await screen.findByTestId('admin-splash-active-banner');
    expect(banner).toBeInTheDocument();

    const disableBtn = screen.getByRole('button', { name: /TV-Scoreboard freigeben/i });
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/config',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"adminSplashEnabled":false'),
        })
      );
    });
  });
});
