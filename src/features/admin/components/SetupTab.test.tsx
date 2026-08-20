// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SetupTab } from './SetupTab';

const mockCategoryTypes = [
  { id: 'cat-1', name: 'Bronze Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: true },
  { id: 'cat-2', name: 'Silber Aktiv', competitionClassId: 'cc-aktiv', hasRelayRace: true },
  { id: 'cat-3', name: 'Bronze Jugend', competitionClassId: 'cc-jugend', hasRelayRace: false },
  { id: 'cat-custom', name: 'Open Cup', competitionClassId: 'cc-custom', hasRelayRace: false },
];

const mockCompetitionClasses = [
  { id: 'cc-aktiv', name: 'AKTIV' },
  { id: 'cc-jugend', name: 'JUGEND' },
  { id: 'cc-custom', name: 'ELITE' },
];

describe('SetupTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/category-types') {
        return Promise.resolve({ ok: true, json: async () => mockCategoryTypes });
      }
      if (url === '/api/admin/competition-classes') {
        return Promise.resolve({ ok: true, json: async () => mockCompetitionClasses });
      }
      if (url === '/api/admin/evaluation-types') {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({ message: 'Success' }) });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Klassen & Kategorien sub-tab as default active tab', async () => {
    render(<SetupTab />);

    // The renamed sub-tab should be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Klassen & Kategorien/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Wertungen/i })).toBeInTheDocument();

    // No Startreihenfolge sub-tab (moved to ParticipantsTab)
    expect(screen.queryByRole('button', { name: /Startreihenfolge/i })).not.toBeInTheDocument();
  });

  it('shows Wertungsklassen section with competition classes', async () => {
    render(<SetupTab />);

    await waitFor(() => {
      expect(screen.getByText('Wertungsklassen')).toBeInTheDocument();
    });

    // Should show loaded competition classes
    await waitFor(() => {
      expect(screen.getAllByText('AKTIV').length).toBeGreaterThan(0);
      expect(screen.getAllByText('JUGEND').length).toBeGreaterThan(0);
      expect(screen.getAllByText('ELITE').length).toBeGreaterThan(0);
    });
  });

  it('renders Bewerbsklassen (CategoryTypesSection) below Wertungsklassen', async () => {
    render(<SetupTab />);

    await waitFor(() => {
      // CategoryTypesSection heading
      expect(screen.getByText('Bewerbskategorien')).toBeInTheDocument();
    });
  });

  it('calls the competition-classes POST endpoint when creating a new Wertungsklasse', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cc-new', name: 'SENIOREN' }),
    });
    // Override fetch for POST
    globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/admin/competition-classes' && options?.method === 'POST') return mockPost(url, options);
      if (url === '/api/admin/category-types') return Promise.resolve({ ok: true, json: async () => mockCategoryTypes });
      if (url === '/api/admin/competition-classes') return Promise.resolve({ ok: true, json: async () => mockCompetitionClasses });
      if (url === '/api/admin/evaluation-types') return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<SetupTab />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Name der Wertungsklasse/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Name der Wertungsklasse/i);
    fireEvent.change(input, { target: { value: 'SENIOREN' } });
    fireEvent.click(screen.getByRole('button', { name: /Klasse anlegen/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/api/admin/competition-classes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'SENIOREN' }),
        })
      );
    });
  });
});
