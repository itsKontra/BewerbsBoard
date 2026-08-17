// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DataManagementSection } from './DataManagementSection';

describe('DataManagementSection component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  const createMockFile = (content: string, name: string) => {
    const file = new File([content], name, { type: 'application/json' });
    file.text = () => Promise.resolve(content);
    return file;
  };

  it('renders export and import panels with buttons', () => {
    render(<DataManagementSection />);
    expect(screen.getByText('Daten-Export & Import')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bewerbsdaten exportieren/i })).toBeInTheDocument();
    expect(screen.getByText('Bewerbsdaten importieren')).toBeInTheDocument();
    expect(screen.getByText('JSON-Datei auswählen')).toBeInTheDocument();
  });

  it('triggers export and handles download flow', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'Content-Disposition': 'attachment; filename="bewerbsboard-export-test.json"',
      }),
      blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
    } as any);

    render(<DataManagementSection />);

    const exportBtn = screen.getByRole('button', { name: /Bewerbsdaten exportieren/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/data/export');
      expect(screen.getByText(/Export erfolgreich gestartet/i)).toBeInTheDocument();
    });
  });

  it('processes selected file, shows preflight summary, and executes import', async () => {
    const validEnvelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        appConfig: [],
        competitionClasses: [{ id: 'cc-1', name: 'Aktiv' }],
        fireBrigades: [{ id: 'fb-1', name: 'FF Test' }],
        categoryTypes: [],
        evaluationTypes: [],
        groups: [],
        categoryEntries: [],
      },
    };

    const preflightResponse = {
      isValid: true,
      summary: {
        appConfig: { total: 0, toInsert: 0, toUpdate: 0 },
        competitionClasses: { total: 1, toInsert: 1, toUpdate: 0 },
        fireBrigades: { total: 1, toInsert: 0, toUpdate: 1 },
        categoryTypes: { total: 0, toInsert: 0, toUpdate: 0 },
        evaluationTypes: { total: 0, toInsert: 0, toUpdate: 0 },
        groups: { total: 0, toInsert: 0, toUpdate: 0 },
        categoryEntries: { total: 0, toInsert: 0, toUpdate: 0 },
      },
      totalEntities: 2,
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/data/import/preflight') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(preflightResponse),
        });
      }
      if (url === '/api/admin/data/import') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Daten erfolgreich importiert' }),
        });
      }
      return Promise.reject(new Error(`Unknown url: ${url}`));
    });

    render(<DataManagementSection />);

    const file = createMockFile(JSON.stringify(validEnvelope), 'backup.json');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    const importBtn = await screen.findByRole('button', { name: /Import jetzt anwenden/i });
    expect(screen.getByText('Datei gültig und bereit zum Importieren.')).toBeInTheDocument();

    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText(/Daten erfolgreich importiert/i)).toBeInTheDocument();
    });
  });

  it('displays preflight errors when file is invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        isValid: false,
        errors: ['Nicht unterstützte Schema-Version: 99.'],
      }),
    });

    render(<DataManagementSection />);

    const file = createMockFile('{"version": 99}', 'invalid.json');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Ungültige Datei oder Validierungsfehler/i)).toBeInTheDocument();
      expect(screen.getByText('Nicht unterstützte Schema-Version: 99.')).toBeInTheDocument();
    });
  });
});
