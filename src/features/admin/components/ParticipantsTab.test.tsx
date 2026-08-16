// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ParticipantsTab } from './ParticipantsTab';

describe('ParticipantsTab Component', () => {
  const mockBrigades = [
    { id: 'b-1', name: 'FF Allerheiligen' },
    { id: 'b-2', name: 'FF Altaist' },
  ];

  const mockCompetitionClasses = [
    { id: 'cc-1', name: 'AKTIV' },
    { id: 'cc-2', name: 'JUGEND' },
    { id: 'cc-3', name: 'GAST' },
    { id: 'cc-4', name: 'SENIOREN' },
  ];

  const mockGroups = [
    { id: 'g-1', fireBrigadeId: 'b-1', name: 'Gruppe 1', competitionClassId: 'cc-1', competitionClass: 'AKTIV' },
    { id: 'g-2', fireBrigadeId: 'b-1', name: 'Gruppe 2', competitionClassId: 'cc-2', competitionClass: 'JUGEND' },
    { id: 'g-3', fireBrigadeId: 'b-2', name: 'Gruppe 1', competitionClassId: 'cc-1', competitionClass: 'AKTIV' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/admin/brigades') {
          return { ok: true, json: async () => mockBrigades };
        }
        if (url === '/api/admin/groups') {
          return { ok: true, json: async () => mockGroups };
        }
        if (url === '/api/admin/competition-classes') {
          return { ok: true, json: async () => mockCompetitionClasses };
        }
        return { ok: true, json: async () => ({}) };
      })
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all groups initially when no brigade is selected', async () => {
    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getByText('Gruppe 2')).toBeInTheDocument();
    });
  });

  it('filters groups table when a brigade is selected in the dropdown', async () => {
    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getByText('Gruppe 2')).toBeInTheDocument();
    });

    const brigadeSelect = screen.getByLabelText('Feuerwehr auswählen');

    // Select FF Altaist (b-2)
    fireEvent.change(brigadeSelect, { target: { value: 'b-2' } });

    await waitFor(() => {
      // Group 2 belongs to b-1, so it should be filtered out
      expect(screen.queryByText('Gruppe 2')).not.toBeInTheDocument();
    });

    // Select "-- Feuerwehr wählen --" (empty value) to show all groups again
    fireEvent.change(brigadeSelect, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByText('Gruppe 2')).toBeInTheDocument();
    });
  });

  it('uses competition classes for group assignment without exposing class configuration', async () => {
    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stammdaten/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Stammdaten/i }));

    expect(screen.getByLabelText('Wertungsklasse auswählen')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Wertungsklassen/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Name der Wertungsklasse (z.B. SENIOREN)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Klasse anlegen' })).not.toBeInTheDocument();
  });

  it('allows registering a group with dynamic competition class', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/groups' && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 'g-99', name: 'Gruppe 3', fireBrigadeId: 'b-1', competitionClassId: 'cc-4', competitionClass: 'SENIOREN' }),
        };
      }
      if (url === '/api/admin/brigades') {
        return { ok: true, json: async () => mockBrigades };
      }
      if (url === '/api/admin/groups') {
        return { ok: true, json: async () => mockGroups };
      }
      if (url === '/api/admin/competition-classes') {
        return { ok: true, json: async () => mockCompetitionClasses };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getAllByText('SENIOREN').length).toBeGreaterThan(0);
    });

    const brigadeSelect = screen.getByLabelText('Feuerwehr auswählen');
    const groupNameInput = screen.getByPlaceholderText('Gruppenname (z.B. 1)');
    const classSelect = screen.getByLabelText('Wertungsklasse auswählen');
    const submitBtn = screen.getByText('Gruppe anlegen');

    fireEvent.change(brigadeSelect, { target: { value: 'b-1' } });
    fireEvent.change(groupNameInput, { target: { value: 'Gruppe 3' } });
    fireEvent.change(classSelect, { target: { value: 'SENIOREN' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/groups',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fireBrigadeId: 'b-1',
            name: 'Gruppe 3',
            competitionClassId: 'cc-4',
          }),
        })
      );
    });
  });

  it('shows an actionable German error for a duplicate Group/Wertungsklasse combination', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/groups' && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: 'A group with this name and competition class already exists in the selected fire brigade' }),
        };
      }
      if (url === '/api/admin/brigades') return { ok: true, json: async () => mockBrigades };
      if (url === '/api/admin/groups') return { ok: true, json: async () => mockGroups };
      if (url === '/api/admin/competition-classes') return { ok: true, json: async () => mockCompetitionClasses };
      if (url === '/api/admin/category-types') return { ok: true, json: async () => [] };
      if (url === '/api/admin/category-entries') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ParticipantsTab />);

    await screen.findByText('Gruppe 2');
    fireEvent.change(screen.getByLabelText('Feuerwehr auswählen'), { target: { value: 'b-1' } });
    fireEvent.change(screen.getByPlaceholderText('Gruppenname (z.B. 1)'), { target: { value: 'Gruppe 1' } });
    fireEvent.change(screen.getByLabelText('Wertungsklasse auswählen'), { target: { value: 'AKTIV' } });
    fireEvent.click(screen.getByText('Gruppe anlegen'));

    expect(await screen.findByText('Diese Gruppe ist für die gewählte Feuerwehr und Wertungsklasse bereits vorhanden.')).toBeInTheDocument();
  });

  it('renders sub-tab buttons and switches between Startreihenfolge and Stammdaten', async () => {
    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Startreihenfolge/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stammdaten/i })).toBeInTheDocument();
    });

    const startTabBtn = screen.getByRole('button', { name: /Startreihenfolge/i });
    const stammdatenTabBtn = screen.getByRole('button', { name: /Stammdaten/i });

    expect(startTabBtn).toBeInTheDocument();
    expect(stammdatenTabBtn).toBeInTheDocument();

    fireEvent.click(stammdatenTabBtn);
    expect(stammdatenTabBtn).toHaveClass('bg-red-600');

    fireEvent.click(startTabBtn);
    expect(startTabBtn).toHaveClass('bg-red-600');
  });

  it('orders Startreihenfolge categories by Wertungsklasse and then category name', async () => {
    const categoryTypes = [
      { id: 'cat-jugend', name: 'Bronze Jugend', competitionClassId: 'cc-2', hasRelayRace: false },
      { id: 'cat-silber', name: 'Silber Aktiv', competitionClassId: 'cc-1', hasRelayRace: false },
      { id: 'cat-bronze', name: 'Bronze Aktiv', competitionClassId: 'cc-1', hasRelayRace: false },
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/admin/brigades') return { ok: true, json: async () => mockBrigades };
      if (url === '/api/admin/groups') return { ok: true, json: async () => mockGroups };
      if (url === '/api/admin/competition-classes') return { ok: true, json: async () => mockCompetitionClasses };
      if (url === '/api/admin/category-types') return { ok: true, json: async () => categoryTypes };
      if (url === '/api/admin/category-entries') return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    }));

    render(<ParticipantsTab />);

    const bronzeAktiv = await screen.findByText('Bronze Aktiv');
    const categoryTabList = bronzeAktiv.closest('button')?.parentElement;

    expect(categoryTabList).toBeInTheDocument();
    expect(Array.from(categoryTabList!.querySelectorAll('button'), (button) => button.textContent)).toEqual([
      'Bronze AktivOhne Staffel',
      'Silber AktivOhne Staffel',
      'Bronze JugendOhne Staffel',
    ]);
  });

  it('renders Startreihenfolge categories and allows adding groups', async () => {
    const mockCatTypes = [
      { id: 'cat-1', name: 'Bronze Aktiv', competitionClassId: 'cc-1', hasRelayRace: true },
    ];
    const mockCatEntries = [
      {
        id: 'entry-1',
        groupId: 'g-1',
        categoryTypeId: 'cat-1',
        categoryTypeName: 'Bronze Aktiv',
        runStatus: 'OPEN',
        startOrderPosition: 1,
        groupName: 'Gruppe 1',
        competitionClass: 'AKTIV',
        fireBrigadeId: 'b-1',
        fireBrigadeName: 'FF Allerheiligen',
      },
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/category-entries' && init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ id: 'entry-2' }) };
      }
      if (url === '/api/admin/brigades') return { ok: true, json: async () => mockBrigades };
      if (url === '/api/admin/groups') return { ok: true, json: async () => mockGroups };
      if (url === '/api/admin/competition-classes') return { ok: true, json: async () => mockCompetitionClasses };
      if (url === '/api/admin/category-types') return { ok: true, json: async () => mockCatTypes };
      if (url === '/api/admin/category-entries') return { ok: true, json: async () => mockCatEntries };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ParticipantsTab />);

    await waitFor(() => {
      expect(screen.getByText('Gruppen in Bronze Aktiv')).toBeInTheDocument();
      expect(screen.getByText('FF Allerheiligen - Gruppe 1')).toBeInTheDocument();
    });

    // Add group g-3 (AKTIV, not yet in Bronze Aktiv)
    const select = screen.getByRole('combobox', { name: '' });
    fireEvent.change(select, { target: { value: 'g-3' } });

    const addBtn = screen.getAllByRole('button', { name: 'Hinzufügen' })[0];
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/category-entries',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ groupId: 'g-3', categoryTypeId: 'cat-1' }),
        })
      );
    });
  });
});
