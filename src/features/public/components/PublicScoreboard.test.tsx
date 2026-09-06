// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PublicScoreboard, type PublicResultsApiResponse } from './PublicScoreboard';

const mockApiResponse: PublicResultsApiResponse = {
  eventTitle: 'TEST LEISTUNGSBEWERB',
  publicUrl: 'https://scoreboard.test.at',
  timestamp: 1723100000000,
  categories: {
    'bronze-aktiv': {
      id: 'bronze-aktiv',
      displayName: 'Bronze Aktiv',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      rankedResults: [
        {
          rank: 1,
          groupId: 'g1',
          groupName: 'Gruppe 1',
          fireBrigadeId: 'fb1',
          fireBrigadeName: 'FF Oberndorf',
          scoreHundredths: 4238,
          primaryRun: {
            entryId: 'e1',
            attackTimeHundredths: 4238,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4238,
          },
        },
        {
          rank: 2,
          groupId: 'g2',
          groupName: 'Gruppe 2',
          fireBrigadeId: 'fb2',
          fireBrigadeName: 'FF Unterndorf',
          scoreHundredths: 5000,
          primaryRun: {
            entryId: 'e2',
            attackTimeHundredths: 4500,
            attackTimeErrors: 5,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 5000,
          },
        },
        {
          rank: 2,
          groupId: 'g3',
          groupName: 'Gruppe 3',
          fireBrigadeId: 'fb3',
          fireBrigadeName: 'FF Neustadt',
          scoreHundredths: 5000,
          primaryRun: {
            entryId: 'e3',
            attackTimeHundredths: 4000,
            attackTimeErrors: 10,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 5000,
          },
        },
        {
          rank: 4,
          groupId: 'g4',
          groupName: 'Gruppe 4',
          fireBrigadeId: 'fb4',
          fireBrigadeName: 'FF Altdorf',
          scoreHundredths: 5500,
          primaryRun: {
            entryId: 'e4',
            attackTimeHundredths: 5500,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 5500,
          },
        },
      ],
      openEntries: [
        {
          id: 'e5',
          groupId: 'g5',
          groupName: 'Gruppe 5',
          fireBrigadeId: 'fb5',
          fireBrigadeName: 'FF West',
          startOrderPosition: 1,
        },
        {
          id: 'e6',
          groupId: 'g6',
          groupName: 'Gruppe 6',
          fireBrigadeId: 'fb6',
          fireBrigadeName: 'FF Ost',
          startOrderPosition: 2,
        },
      ],
      dnfEntries: [
        {
          id: 'e7',
          groupId: 'g7',
          groupName: 'Gruppe 7',
          fireBrigadeId: 'fb7',
          fireBrigadeName: 'FF Nord',
        },
      ],
    },
    'silber-aktiv': {
      id: 'silber-aktiv',
      displayName: 'Silber Aktiv',
      publicEnabled: true,
      order: 2,
      type: 'standard',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    },
    'bronze-jugend': {
      id: 'bronze-jugend',
      displayName: 'Bronze Jugend',
      publicEnabled: true,
      order: 3,
      type: 'standard',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    },
    'bronze-gaeste': {
      id: 'bronze-gaeste',
      displayName: 'Bronze Gäste',
      publicEnabled: true,
      order: 4,
      type: 'standard',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    },
    'silber-gaeste': {
      id: 'silber-gaeste',
      displayName: 'Silber Gäste',
      publicEnabled: true,
      order: 5,
      type: 'standard',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    },
    'gesamt-aktiv': {
      id: 'gesamt-aktiv',
      displayName: 'Gesamtwertung Aktiv',
      publicEnabled: true,
      order: 6,
      type: 'combined',
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silber',
      rankedResults: [
        {
          rank: 1,
          groupId: 'g1',
          groupName: 'Gruppe 1',
          fireBrigadeId: 'fb1',
          fireBrigadeName: 'FF Oberndorf',
          scoreHundredths: 8738,
          primaryRun: {
            entryId: 'e1',
            scoreHundredths: 4238,
            attackTimeHundredths: 4238,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
          },
          secondaryRun: {
            entryId: 'e2',
            scoreHundredths: 4500,
            attackTimeHundredths: 4500,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    },
    'gesamt-feuerwehr': {
      id: 'gesamt-feuerwehr',
      displayName: 'Gesamtwertung Feuerwehr',
      publicEnabled: true,
      order: 7,
      type: 'combined',
      isBrigadePairing: true,
      categoryTypeName1: 'Bronze Aktiv',
      categoryTypeName2: 'Bronze Jugend',
      rankedResults: [
        {
          rank: 1,
          groupId: 'g1',
          groupName: '1',
          secondaryGroupName: '2',
          fireBrigadeId: 'fb1',
          fireBrigadeName: 'FF Oberndorf',
          scoreHundredths: 8338,
          primaryRun: {
            entryId: 'e1',
            scoreHundredths: 4238,
            attackTimeHundredths: 4238,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
          },
          secondaryRun: {
            entryId: 'e2',
            scoreHundredths: 4100,
            attackTimeHundredths: 4100,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    },
  },
};

describe('PublicScoreboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders event title, ranked results with ties, open entries, and DNF section', async () => {
    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByText('TEST LEISTUNGSBEWERB')).toBeInTheDocument();
    });

    // Verify ranked results in Bronze Aktiv
    expect(screen.getByRole('cell', { name: 'FF Oberndorf Gruppe 1' })).toBeInTheDocument();
    expect(screen.getAllByText('42,38 s').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50,00 s').length).toBe(2);
    expect(screen.getAllByText('55,00 s').length).toBeGreaterThan(0);

    // Verify ties: rank badges 1, 2, 2, 4
    const rankBadges = within(screen.getByRole('table')).getAllByText(/^(1|2|4)$/);
    expect(rankBadges.map((b) => b.textContent)).toEqual(['1', '2', '2', '4']);

    // Verify OPEN entries
    expect(screen.getByText('Nächste Starts')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    const nextStart = screen.getByText('FF West').closest('li');
    expect(nextStart).toHaveTextContent('FF West Gruppe 5');
    expect(screen.getByText('Gruppe 5')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('FF Ost').closest('li')).toBeInTheDocument();

    // Verify DNF section
    expect(screen.getByText('Disqualifiziert (DNF)')).toBeInTheDocument();
    expect(screen.getByText('FF Nord')).toBeInTheDocument();
  });

  it('allows switching categories via tab selection bar', async () => {
    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByText('TEST LEISTUNGSBEWERB')).toBeInTheDocument();
    });

    // Click on "Gesamtwertung Aktiv" tab
    const gesamtTab = screen.getByTestId('category-tab-gesamt-aktiv');
    fireEvent.click(gesamtTab);

    // Should display combined Aktiv table
    expect(screen.getByRole('heading', { name: 'Bronze', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Silber', level: 4 })).toBeInTheDocument();
    expect(screen.getByText('87,38 s')).toBeInTheDocument();

    // Click on "Gesamtwertung Feuerwehr" tab
    const feuerwehrTab = screen.getByTestId('category-tab-gesamt-feuerwehr');
    fireEvent.click(feuerwehrTab);

    // Should display combined Feuerwehr table
    expect(screen.getByRole('heading', { name: 'Bronze Aktiv · Gruppe 1', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bronze Jugend · Gruppe 2', level: 4 })).toBeInTheDocument();
    
    const row = screen.getAllByRole('row')[1]; // First is header
    expect(row).toHaveTextContent('FF Oberndorf');
    expect(row).toHaveTextContent('Bronze Aktiv · Gruppe 1');
    expect(row).toHaveTextContent('Bronze Jugend · Gruppe 2');
    expect(screen.queryByText('FF Oberndorf Gruppe 1')).not.toBeInTheDocument();
    expect(row).toHaveTextContent('42,38 s');
    expect(row).toHaveTextContent('41,00 s');
    expect(row).toHaveTextContent('83,38 s');
  });



  it('polls /api/public/results every 5 seconds', async () => {
    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Advance 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Advance another 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('finds ranked, upcoming, and DNF groups without changing their ranks', async () => {
    render(<PublicScoreboard />);
    await screen.findByRole('table');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'unterndorf' } });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(within(table).getByText('50,00 s')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'west' } });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('FF West')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'nord' } });
    expect(screen.getByText('FF Nord')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'unknown team' } });
    expect(screen.getByText('Keine passende Gruppe gefunden')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche löschen' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5);
  });

  it('saves a brigade across categories and restores it after remounting', async () => {
    const { unmount } = render(<PublicScoreboard />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'FF Oberndorf merken' }));
    expect(JSON.parse(localStorage.getItem('bewerbsboard:favorite-brigades') || '[]')).toEqual(['fb1']);
    fireEvent.click(screen.getByRole('button', { name: 'Meine Feuerwehr' }));
    expect(screen.getAllByRole('table')).toHaveLength(3);
    expect(screen.queryByText('FF Unterndorf')).not.toBeInTheDocument();
    expect(screen.getByText('83,38 s')).toBeInTheDocument();
    unmount();

    render(<PublicScoreboard />);
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'FF Oberndorf nicht mehr merken' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'FF Oberndorf nicht mehr merken' }));
    fireEvent.click(screen.getByRole('button', { name: 'Meine Feuerwehr' }));
    expect(screen.getByRole('button', { name: 'Feuerwehr finden' })).toBeInTheDocument();
  });

  it('retains results with an offline notice after a failed poll and recovers on the next poll', async () => {
    render(<PublicScoreboard />);
    await screen.findByRole('table');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection lost'));
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Du siehst den letzten Stand');
    expect(screen.getByRole('cell', { name: 'FF Oberndorf Gruppe 1' })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Live', { exact: true })).toBeInTheDocument();
  });

  it('retries an initial loading failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection lost'));
    render(<PublicScoreboard />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to a published category when the selected category becomes private', async () => {
    render(<PublicScoreboard />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByTestId('category-tab-gesamt-aktiv'));
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockApiResponse, categories: {
        ...mockApiResponse.categories,
        'gesamt-aktiv': { ...mockApiResponse.categories['gesamt-aktiv'], publicEnabled: false },
      } }),
    } as Response);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByTestId('category-tab-gesamt-aktiv')).not.toBeInTheDocument();
    expect(screen.getByTestId('category-tab-bronze-aktiv')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('table', { name: 'Bronze Aktiv Wertungsliste' })).toBeInTheDocument();
  });

  it('filters out categories where publicEnabled is false', async () => {
    const disabledApiResponse: PublicResultsApiResponse = {
      ...mockApiResponse,
      categories: {
        ...mockApiResponse.categories,
        'silber-aktiv': {
          ...mockApiResponse.categories['silber-aktiv'],
          publicEnabled: false,
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => disabledApiResponse,
    } as Response);

    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByText('TEST LEISTUNGSBEWERB')).toBeInTheDocument();
    });

    expect(screen.getByTestId('category-tab-bronze-aktiv')).toBeInTheDocument();
    expect(screen.queryByTestId('category-tab-silber-aktiv')).not.toBeInTheDocument();
  });

  it('renders 2x2 single relay category with Angriff and Staffellauf columns', async () => {
    const relayApiResponse: PublicResultsApiResponse = {
      eventTitle: 'TEST LEISTUNGSBEWERB',
      publicUrl: 'https://scoreboard.test.at',
      timestamp: 1723100000000,
      categories: {
        'bronze-relay': {
          id: 'bronze-relay',
          displayName: 'Bronze mit Staffel',
          publicEnabled: true,
          order: 1,
          type: 'standard',
          hasRelayRace1: true,
          excludeRelayRace: false,
          rankedResults: [
            {
              rank: 1,
              groupId: 'g1',
              groupName: 'Gruppe 1',
              fireBrigadeId: 'fb1',
              fireBrigadeName: 'FF Oberndorf',
              scoreHundredths: 9748,
              primaryRun: {
                entryId: 'e1',
                attackTimeHundredths: 4238,
                attackTimeErrors: 0,
                relayRaceHundredths: 5510,
                relayRaceErrors: 0,
                scoreHundredths: 9748,
              },
            },
          ],
          openEntries: [],
          dnfEntries: [],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => relayApiResponse,
    } as Response);

    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByText('42,38 s')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Angriff').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Staffellauf').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('42,38 s')).toBeInTheDocument();
    expect(screen.getByText('55,10 s')).toBeInTheDocument();
    expect(screen.getByText('97,48 s')).toBeInTheDocument();
  });

  it('renders a combined relay category with all four discipline contributions', async () => {
    const combinedRelayApiResponse: PublicResultsApiResponse = {
      eventTitle: 'TEST LEISTUNGSBEWERB',
      publicUrl: 'https://scoreboard.test.at',
      timestamp: 1723100000000,
      categories: {
        'gesamt-relay': {
          id: 'gesamt-relay',
          displayName: 'Gesamtwertung Staffel',
          publicEnabled: true,
          order: 1,
          type: 'combined',
          hasRelayRace1: true,
          hasRelayRace2: true,
          excludeRelayRace: false,
          categoryTypeName1: 'Bronze',
          categoryTypeName2: 'Silber',
          rankedResults: [
            {
              rank: 1,
              groupId: 'g1',
              groupName: 'Gruppe 1',
              fireBrigadeId: 'fb1',
              fireBrigadeName: 'FF Oberndorf',
              scoreHundredths: 19200,
              primaryRun: {
                entryId: 'e1',
                attackTimeHundredths: 4200,
                attackTimeErrors: 0,
                relayRaceHundredths: 5200,
                relayRaceErrors: 0,
                scoreHundredths: 9400,
              },
              secondaryRun: {
                entryId: 'e2',
                attackTimeHundredths: 4400,
                attackTimeErrors: 0,
                relayRaceHundredths: 5400,
                relayRaceErrors: 0,
                scoreHundredths: 9800,
              },
            },
          ],
          openEntries: [],
          dnfEntries: [],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => combinedRelayApiResponse,
    } as Response);

    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /Bronze ANG.*Bronze SL.*Silber ANG.*Silber SL/ })).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: /Bronze ANG.*Bronze SL.*Silber ANG.*Silber SL/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Bronze' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Silber' })).toBeInTheDocument();
    expect(screen.getAllByText('ANG')).toHaveLength(2);
    expect(screen.getAllByText('SL')).toHaveLength(2);
    expect(screen.getByText('192,00 s')).toBeInTheDocument();
  });

  it('renders — for secondary discipline in a Tier-2 combined entry (null secondaryRun)', async () => {
    const tier2ApiResponse = {
      ...mockApiResponse,
      categories: {
        'gesamt-aktiv': {
          id: 'gesamt-aktiv',
          displayName: 'Gesamtwertung Aktiv',
          publicEnabled: true,
          order: 1,
          type: 'combined',
          showSingleResults: true,
          categoryTypeName1: 'Bronze',
          categoryTypeName2: 'Silber',
          rankedResults: [
            {
              rank: 1,
              groupId: 'g1',
              groupName: 'Gruppe 1',
              fireBrigadeId: 'fb1',
              fireBrigadeName: 'FF Vollstaendig',
              scoreHundredths: 8738,
              primaryRun: {
                entryId: 'e1',
                scoreHundredths: 4238,
                attackTimeHundredths: 4238,
                attackTimeErrors: 0,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
              secondaryRun: {
                entryId: 'e2',
                scoreHundredths: 4500,
                attackTimeHundredths: 4500,
                attackTimeErrors: 0,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
            },
            {
              rank: 2,
              groupId: 'g2',
              groupName: 'Gruppe 2',
              fireBrigadeId: 'fb2',
              fireBrigadeName: 'FF Einzel',
              scoreHundredths: null,
              primaryRun: {
                entryId: 'e3',
                scoreHundredths: 3800,
                attackTimeHundredths: 3800,
                attackTimeErrors: 0,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
              secondaryRun: null,
            },
          ],
          openEntries: [],
          dnfEntries: [],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => tier2ApiResponse,
    } as Response);

    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'FF Einzel Gruppe 2' })).toBeInTheDocument();
    });

    const einzelRow = screen.getByRole('cell', { name: 'FF Einzel Gruppe 2' }).closest('[role="row"]');
    expect(within(einzelRow as HTMLElement).getByText('38,00 s')).toBeInTheDocument();
    expect(within(einzelRow as HTMLElement).getAllByText('—')).toHaveLength(2);
  });

  it('renders — in rank badge for a DNF entry with null rank in a combined category', async () => {
    const dnfApiResponse = {
      ...mockApiResponse,
      categories: {
        'gesamt-aktiv': {
          id: 'gesamt-aktiv',
          displayName: 'Gesamtwertung Aktiv',
          publicEnabled: true,
          order: 1,
          type: 'combined',
          showSingleResults: true,
          categoryTypeName1: 'Bronze',
          categoryTypeName2: 'Silber',
          rankedResults: [
            {
              rank: 1,
              groupId: 'g1',
              groupName: 'Gruppe 1',
              fireBrigadeId: 'fb1',
              fireBrigadeName: 'FF Gut',
              scoreHundredths: 8738,
              primaryRun: {
                entryId: 'e1',
                scoreHundredths: 4238,
                attackTimeHundredths: 4238,
                attackTimeErrors: 0,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
              secondaryRun: {
                entryId: 'e2',
                scoreHundredths: 4500,
                attackTimeHundredths: 4500,
                attackTimeErrors: 0,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
            },
            {
              rank: null,
              groupId: 'g-dnf',
              groupName: 'Gruppe DNF',
              fireBrigadeId: 'fb-dnf',
              fireBrigadeName: 'FF Ausfall',
              scoreHundredths: null,
              primaryRun: {
                entryId: 'e-dnf',
                scoreHundredths: null,
                attackTimeHundredths: null,
                attackTimeErrors: null,
                relayRaceHundredths: null,
                relayRaceErrors: null,
              },
            },
          ],
          openEntries: [],
          dnfEntries: [],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dnfApiResponse,
    } as Response);

    render(<PublicScoreboard />);

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: 'FF Ausfall Gruppe DNF' })).toBeInTheDocument();
    });

    const ausfallRow = screen.getByRole('cell', { name: 'FF Ausfall Gruppe DNF' }).closest('[role="row"]');
    expect(ausfallRow?.firstElementChild).toHaveTextContent('—');
  });

  it('renders demo data when ?demo=true is present in query parameters', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:5173/?demo=true'),
      writable: true,
      configurable: true,
    });

    try {
      render(<PublicScoreboard />);

      await waitFor(() => {
        expect(screen.getByText('BFLB FREIWILLIGE FEUERWEHR')).toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('passes AbortSignal to fetch and aborts in-flight fetch on unmount without throwing errors', async () => {
    let capturedSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal;
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    const { unmount } = render(<PublicScoreboard />);

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
