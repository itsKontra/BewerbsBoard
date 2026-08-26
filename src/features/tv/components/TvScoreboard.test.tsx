// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  buildCategoriesResultMap,
  type EntryDetailView,
  type EvaluationTypeView,
} from '../../../../shared/api-mappers/results-builder';
import { TvScoreboard } from './TvScoreboard';

const mockResultsData = {
  eventTitle: 'TEST EVENT',
  publicUrl: 'https://test.at',
  timestamp: 123,
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
          fireBrigadeName: 'FF First',
          groupName: 'Gr 1',
          scoreHundredths: 4000,
          primaryRun: {
            entryId: 'e1',
            attackTimeHundredths: 4000,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4000,
          },
        },
        {
          rank: 2,
          groupId: 'g2',
          fireBrigadeName: 'FF Second',
          groupName: 'Gr 2',
          scoreHundredths: 4500,
          primaryRun: {
            entryId: 'e2',
            attackTimeHundredths: 4500,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4500,
          },
        },
      ],
      openEntries: [
        { startOrderPosition: 1, fireBrigadeName: 'FF Next', groupName: 'Gr 3' }
      ],
      dnfEntries: []
    }
  }
};

type TvMode = 'ROTATION' | 'FIXED' | 'MESSAGE' | 'WINNERS';
type TvTheme = 'broadcast' | 'ceremony' | 'outdoor';

export interface MockTvPresentation {
  theme: TvTheme;
  logoUrl: string;
  headerLabel?: string;
  qrCodeEnabled?: boolean;
  qrCodeAlwaysVisible?: boolean;
  qrCodeIntervalSeconds?: number;
  qrCodeDurationSeconds?: number;
  adminSplashEnabled?: boolean;
}

const DEFAULT_TV_PRESENTATION: MockTvPresentation = {
  theme: 'broadcast',
  logoUrl: '/logo.png',
  headerLabel: 'Television Scoreboard',
  qrCodeEnabled: true,
  qrCodeAlwaysVisible: false,
  qrCodeIntervalSeconds: 30,
  qrCodeDurationSeconds: 10,
  adminSplashEnabled: false,
};

function rankedResults(count: number, prefix = 'FF Rank') {
  return Array.from({ length: count }, (_, index) => {
    const attackTime = 4000 + index * 100;
    const errors = index % 2;
    const score = 4000 + index * 200;
    return {
      rank: index + 1,
      groupId: `g-${prefix}-${index + 1}`,
      fireBrigadeName: `${prefix} ${index + 1}`,
      groupName: `Gr ${index + 1}`,
      scoreHundredths: score,
      primaryRun: {
        entryId: `e-${prefix}-${index + 1}`,
        attackTimeHundredths: attackTime,
        attackTimeErrors: errors * 5,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: score,
      },
    };
  });
}

function upcomingEntries(count: number, prefix = 'FF Upcoming') {
  return Array.from({ length: count }, (_, index) => ({
    id: `upcoming-${index + 1}`,
    startOrderPosition: index + 1,
    fireBrigadeName: `${prefix} ${index + 1}`,
    groupName: `Gr ${index + 1}`,
  }));
}

interface MockTvScenario {
  mode: TvMode;
  rankingPageDurationMs?: number;
  tvPresentation?: MockTvPresentation;
  tvAnnouncement?: { headline?: string; message?: string } | null;
  selectedCategoryId?: string | null;
  categoriesConfig?: Record<string, {
    name: string;
    tvEnabled: boolean;
    order: number;
    displayDuration: number;
  }>;
  resultsData?: unknown;
}

const TEST_TV_PRESENTATION: MockTvPresentation = {
  ...DEFAULT_TV_PRESENTATION,
  adminSplashEnabled: false,
};

function mockTvScenario({
  mode,
  rankingPageDurationMs,
  tvPresentation = TEST_TV_PRESENTATION,
  tvAnnouncement = { headline: 'BREAKING', message: 'Something happened' },
  selectedCategoryId = mode === 'FIXED' || mode === 'WINNERS' ? 'bronze-aktiv' : null,
  categoriesConfig = {
    'bronze-aktiv': { name: 'Bronze Aktiv', tvEnabled: true, order: 1, displayDuration: 10 },
    'silber-aktiv': { name: 'Silber Aktiv', tvEnabled: true, order: 2, displayDuration: 10 },
  },
  resultsData = mockResultsData,
}: MockTvScenario) {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.startsWith('/api/public/tv-state')) {
      return {
        ok: true,
        json: async () => ({
          mode,
          selectedCategoryId,
          tvAnnouncement,
          eventTitle: 'TEST EVENT',
          rankingPageDurationMs,
          tvPresentation,
          categoriesConfig,
        }),
      } as Response;
    }
    if (url === '/api/public/results') {
      return { ok: true, json: async () => resultsData } as Response;
    }
    return { ok: false, status: 404 } as Response;
  });
}

function mockTvMode(
  mode: TvMode,
  tvPresentation: Partial<MockTvPresentation> = TEST_TV_PRESENTATION,
) {
  mockTvScenario({ mode, tvPresentation: { ...TEST_TV_PRESENTATION, ...tvPresentation } });
}

function qrModulePath(scanPanel: HTMLElement) {
  const qrCode = within(scanPanel).getByTitle('Live-Ergebnisse QR-Code').parentElement;
  const modulePath = qrCode?.querySelectorAll('path')[1];
  if (!modulePath) throw new Error('QR code must render a module path');
  return modulePath.getAttribute('d');
}

describe('TvScoreboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTvMode('ROTATION');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.pushState({}, '', '/tv');
  });

  it.each(
    (['ROTATION', 'FIXED', 'MESSAGE', 'WINNERS'] as TvMode[]).flatMap((mode) =>
      (['broadcast', 'ceremony', 'outdoor'] as TvTheme[]).map((theme) => ({ mode, theme })),
    ),
  )(
    'renders the shared identity and scan frame in $mode mode with the $theme presentation',
    async ({ mode, theme }) => {
      const logoUrl = theme === 'ceremony' ? '/branding/event.svg' : '/logo.png';
      mockTvMode(mode, { theme, logoUrl });

      render(<TvScoreboard />);

      const frame = await screen.findByTestId('tv-shared-frame');
      expect(frame).toHaveAttribute('data-theme', theme);
      if (theme === 'outdoor') {
        expect(frame).toHaveClass('from-slate-100');
      } else {
        expect(frame).toHaveClass(theme === 'ceremony' ? 'via-amber-950' : 'via-slate-900');
      }
      const identityRail = within(frame).getByRole('banner', { name: 'Identity Rail' });
      expect(identityRail).toHaveClass('px-6');
      const logo = within(identityRail).getByRole('img', { name: 'Veranstaltungslogo' });
      expect(within(identityRail).getByRole('heading', { level: 1, name: 'TEST EVENT' })).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', logoUrl);
      expect(logo).toHaveClass('max-h-10', 'w-auto', 'origin-left', 'scale-150', 'object-contain');

      const scanPanel = within(frame).getByRole('complementary', { name: 'Scan Panel' });
      expect(scanPanel).toHaveClass('fixed', 'top-0', 'right-0');
      expect(within(scanPanel).getByText('Live-Ergebnisse')).toBeInTheDocument();
      expect(within(scanPanel).getByRole('link', { name: 'test.at' })).toHaveAttribute('href', 'https://test.at');
      const qrTitle = within(scanPanel).getByTitle('Live-Ergebnisse QR-Code');
      const qrCode = qrTitle.parentElement;
      expect(qrCode).not.toBeNull();
      if (!qrCode) throw new Error('QR title must belong to an SVG element');
      expect(qrCode).toHaveAttribute('width', '150');
      expect(qrCode).toHaveAttribute('height', '150');
      const qrPaths = qrCode.querySelectorAll('path');
      expect(qrPaths[0]).toHaveAttribute('fill', '#FFFFFF');
      expect(qrPaths[1]).toHaveAttribute('fill', '#000000');
      expect(qrPaths[1]).toHaveAttribute('d', expect.stringMatching(/^M4 4/));
      expect(frame.querySelectorAll('[data-testid="tv-qr-code"]')).toHaveLength(1);
    },
  );

  it('uses the current origin when no public results URL is configured', async () => {
    render(<TvScoreboard />);

    const configuredScanPanel = await screen.findByRole('complementary', { name: 'Scan Panel' });
    const configuredQrModules = qrModulePath(configuredScanPanel);
    expect(configuredQrModules).toBeTruthy();

    cleanup();
    mockTvScenario({
      mode: 'MESSAGE',
      resultsData: { ...mockResultsData, publicUrl: '' },
    });

    render(<TvScoreboard />);

    const scanPanel = await screen.findByRole('complementary', { name: 'Scan Panel' });
    const destination = new URL(window.location.origin);
    expect(within(scanPanel).getByRole('link', { name: destination.host })).toHaveAttribute(
      'href',
      window.location.origin,
    );
    const fallbackQrModules = qrModulePath(scanPanel);
    expect(fallbackQrModules).toBeTruthy();
    expect(fallbackQrModules).not.toBe(configuredQrModules);
  });

  it('renders the configured header label in the Identity Rail', async () => {
    mockTvMode('ROTATION', {
      theme: 'broadcast',
      logoUrl: '/logo.png',
      headerLabel: 'Landesbewerb Live',
    });

    render(<TvScoreboard />);

    const identityRail = await screen.findByRole('banner', { name: 'Identity Rail' });
    expect(within(identityRail).getByText('Landesbewerb Live')).toBeInTheDocument();
    expect(within(identityRail).queryByText('Television Scoreboard')).not.toBeInTheDocument();
  });

  it('falls back to the bundled logo when an override fails to load', async () => {
    mockTvMode('MESSAGE', { theme: 'ceremony', logoUrl: 'https://assets.example.at/missing.svg' });
    render(<TvScoreboard />);

    const logo = await screen.findByRole('img', { name: 'Veranstaltungslogo' });
    expect(logo).toHaveAttribute('src', 'https://assets.example.at/missing.svg');

    fireEvent.error(logo);

    expect(logo).toHaveAttribute('src', '/logo.png');
  });

  it('renders bundled preset logos and custom uploaded logo endpoints on the TV Scoreboard', async () => {
    // 1. Bundled preset logo
    mockTvMode('ROTATION', {
      theme: 'broadcast',
      logoUrl: '/logo-options/logo_alt_1.png',
      headerLabel: 'Feuerwehr Leistungsbewerb',
    });
    const { unmount } = render(<TvScoreboard />);

    let logo = await screen.findByTestId('tv-header-logo');
    expect(logo).toHaveAttribute('src', '/logo-options/logo_alt_1.png');

    unmount();

    // 2. Custom uploaded logo endpoint with version
    mockTvMode('ROTATION', {
      theme: 'broadcast',
      logoUrl: '/api/public/logo?v=1700000000000',
      headerLabel: 'Feuerwehr Leistungsbewerb',
    });
    render(<TvScoreboard />);

    logo = await screen.findByTestId('tv-header-logo');
    expect(logo).toHaveAttribute('src', '/api/public/logo?v=1700000000000');

    // 3. Fallback on load error for custom logo
    fireEvent.error(logo);
    expect(logo).toHaveAttribute('src', '/logo.png');
  });

  it('places Upcoming Entries after Ranked Results without a separate status strip', async () => {
    render(<TvScoreboard />);

    expect(await screen.findByText('TEST EVENT')).toBeInTheDocument();

    expect(screen.getAllByText('Bronze Aktiv')[0]).toBeInTheDocument();
    expect(screen.queryByText('Auto-Rotation')).not.toBeInTheDocument();
    expect(screen.queryByText(/UHRZEIT/)).not.toBeInTheDocument();
    expect(screen.getByText('FF First Gr 1')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Bronze Aktiv Wertung' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent('FF Next Gr 3');
    expect(rows[2]).toHaveAttribute('data-row-kind', 'upcoming');
    expect(rows[2]).toHaveClass('border-t-4');
    expect(within(rows[2]).getAllByRole('cell')).toHaveLength(3);
    expect(within(rows[2]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '',
      'FF Next Gr 3',
      '',
    ]);
    expect(screen.queryByText(/Als Nächstes/)).not.toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('tv-qr-code')[0]).toBeInTheDocument();
    expect(screen.getByText('Live-Ergebnisse')).toBeInTheDocument();
  });

  it.each(['broadcast', 'ceremony', 'outdoor'] as TvTheme[])(
    'presents standard Ranked Results with the Variant A hierarchy in the %s theme',
    async (theme) => {
      mockTvScenario({
        mode: 'FIXED',
        tvPresentation: { theme, logoUrl: '/logo.png' },
        resultsData: {
          ...mockResultsData,
          categories: {
            'bronze-aktiv': {
              ...mockResultsData.categories['bronze-aktiv'],
              openEntries: [],
              rankedResults: [
                {
                  rank: 1,
                  groupId: 'g1',
                  fireBrigadeName: 'FF Siegerdorf',
                  groupName: 'Gruppe 1',
                  scoreHundredths: 4500,
                  primaryRun: {
                    entryId: 'e1',
                    attackTimeHundredths: 4000,
                    attackTimeErrors: 5,
                    relayRaceHundredths: null,
                    relayRaceErrors: null,
                    scoreHundredths: 4500,
                  },
                },
                {
                  rank: 2,
                  groupId: 'g2',
                  fireBrigadeName: 'FF Gleichstand',
                  groupName: 'Gruppe 2',
                  scoreHundredths: 4100,
                  primaryRun: {
                    entryId: 'e2',
                    attackTimeHundredths: 4100,
                    attackTimeErrors: 0,
                    relayRaceHundredths: null,
                    relayRaceErrors: null,
                    scoreHundredths: 4100,
                  },
                },
                {
                  rank: 3,
                  groupId: 'g3',
                  fireBrigadeName: 'FF Korrektur',
                  groupName: 'Gruppe 3',
                  scoreHundredths: 4100,
                  primaryRun: {
                    entryId: 'e3',
                    attackTimeHundredths: 4100,
                    attackTimeErrors: 0,
                    relayRaceHundredths: null,
                    relayRaceErrors: null,
                    scoreHundredths: 4100,
                  },
                },
                {
                  rank: 4,
                  groupId: 'g4',
                  fireBrigadeName: 'FF Ohne Rohzeit',
                  groupName: 'Gruppe 4',
                  scoreHundredths: 4300,
                  primaryRun: {
                    entryId: 'e4',
                    attackTimeHundredths: null,
                    attackTimeErrors: null,
                    relayRaceHundredths: null,
                    relayRaceErrors: null,
                    scoreHundredths: 4300,
                  },
                },
              ],
            },
          },
        },
      });

      render(<TvScoreboard />);

      const canvas = await screen.findByTestId('tv-mode-canvas');
      const table = within(canvas).getByRole('table', { name: 'Bronze Aktiv Wertung' });
      expect(table).toHaveAttribute('data-density', 'full');
      expect(within(table).getAllByRole('row')).toHaveLength(5);
      expect(within(table).getByRole('columnheader', { name: 'Zeit' })).toBeInTheDocument();
      expect(within(table).queryByRole('columnheader', { name: 'Gesamt' })).not.toBeInTheDocument();

      const firstPlace = within(table).getByRole('row', {
        name: '1 FF Siegerdorf Gruppe 1 40,00 s +5,00',
      });
      expect(firstPlace).toHaveAttribute('data-rank', '1');
      expect(firstPlace).toHaveClass('border-l-4', theme === 'outdoor' ? 'border-l-amber-500' : 'border-l-amber-400');
      expect(within(firstPlace).getByText('FF Siegerdorf Gruppe 1')).toHaveClass('font-black', 'whitespace-nowrap');
      expect(within(firstPlace).getByText('40,00 s').parentElement).toHaveClass('whitespace-nowrap');
      expect(within(firstPlace).getByText('+5,00')).toHaveClass('text-white', 'bg-red-600');
      expect(within(firstPlace).getByText('1')).toHaveClass('text-[clamp(1.25rem,2.1vw,2.4rem)]');

      const identity = within(firstPlace).getByText('FF Siegerdorf Gruppe 1');
      expect(identity).toHaveClass('truncate', 'whitespace-nowrap');
      expect(identity).toHaveAttribute('title', 'FF Siegerdorf Gruppe 1');
      expect(identity).toHaveAttribute('aria-label', 'FF Siegerdorf Gruppe 1');

      expect(within(table).queryByText('+0,00')).not.toBeInTheDocument();
      expect(within(table).queryByText('-1,00')).not.toBeInTheDocument();
      expect(within(canvas).queryByText('Auto-Rotation')).not.toBeInTheDocument();
      expect(within(canvas).queryByText(/UHRZEIT/)).not.toBeInTheDocument();
    },
  );

  it('ignores retired prototype query parameters and renders the production ranking', async () => {
    window.history.pushState({}, '', '/tv?variant=C&density=sparse');
    mockTvMode('FIXED');

    render(<TvScoreboard />);

    const frame = await screen.findByTestId('tv-shared-frame');
    expect(within(frame).getByRole('table', { name: 'Bronze Aktiv Wertung' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Prototype controls' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-prototype-variant]')).not.toBeInTheDocument();
  });

  it.each([1, 2, 3, 4, 5])(
    'reserves eight equal row slots for a $count-row standard page using the full treatment',
    async (count) => {
      mockTvScenario({
        mode: 'FIXED',
        resultsData: {
          ...mockResultsData,
          categories: {
            'bronze-aktiv': {
              ...mockResultsData.categories['bronze-aktiv'],
              openEntries: [],
              rankedResults: rankedResults(count),
            },
          },
        },
      });

      render(<TvScoreboard />);

      const table = await screen.findByRole('table', { name: 'Bronze Aktiv Wertung' });
      expect(table).toHaveAttribute('data-density', 'full');
      expect(table.querySelector('tbody')).toHaveClass('grid', 'grid-rows-8');
      const bodyRows = within(table).getAllByRole('row').slice(1);
      expect(bodyRows).toHaveLength(count);
      for (const row of bodyRows) {
        expect(row).toHaveClass('grid', 'grid-cols-[6%_minmax(0,1fr)_24%]');
      }
      const layoutRows = table.querySelectorAll('tbody > tr');
      expect(layoutRows).toHaveLength(8);
      expect(table.querySelectorAll('tbody > tr[data-row-kind="empty"]')).toHaveLength(8 - count);
      expect(within(bodyRows[0]).getByText('1')).toHaveClass(
        'text-[clamp(1.25rem,2.1vw,2.4rem)]',
      );
      expect(within(bodyRows[0]).getByText('FF Rank 1 Gr 1')).toHaveClass('leading-tight');
    },
  );

  it('pages a long fixed ranking in groups of eight and loops to the first page', async () => {
    vi.useFakeTimers();
    const longRanking = {
      ...mockResultsData,
      categories: {
        'bronze-aktiv': {
          ...mockResultsData.categories['bronze-aktiv'],
          openEntries: [],
          rankedResults: rankedResults(11),
        },
      },
    };
    mockTvScenario({ mode: 'FIXED', resultsData: longRanking });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(screen.getByText('FF Rank 1 Gr 1')).toBeInTheDocument();
    expect(screen.getByText('FF Rank 8 Gr 8')).toBeInTheDocument();
    expect(screen.queryByText('FF Rank 9 Gr 9')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(9);
    expect(screen.getByRole('columnheader', { name: 'Zeit' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'equals' })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: '1 FF Rank 1 Gr 1 40,00 s' })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.queryByText('FF Rank 3 Gr 3')).not.toBeInTheDocument();
    expect(screen.getByText('FF Rank 4 Gr 4')).toBeInTheDocument();
    expect(screen.getByText('FF Rank 9 Gr 9')).toBeInTheDocument();
    expect(screen.getByText('FF Rank 11 Gr 11')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(9);

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByText('FF Rank 1 Gr 1')).toBeInTheDocument();
    expect(screen.queryByText('FF Rank 11 Gr 11')).not.toBeInTheDocument();
  });

  it('pages capped Upcoming Entries after all Ranked Results and loops the combined sequence', async () => {
    vi.useFakeTimers();
    mockTvScenario({
      mode: 'FIXED',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: rankedResults(7),
            openEntries: upcomingEntries(10),
          },
        },
      },
    });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    let bodyRows = within(screen.getByRole('table', { name: 'Bronze Aktiv Wertung' }))
      .getAllByRole('row')
      .slice(1);
    expect(bodyRows).toHaveLength(8);
    expect(bodyRows.map((row) => row.getAttribute('data-row-kind'))).toEqual([
      'ranked', 'ranked', 'ranked', 'ranked', 'ranked', 'ranked', 'ranked', 'upcoming',
    ]);
    expect(screen.getByText('FF Rank 7 Gr 7')).toBeInTheDocument();
    expect(screen.getByText('FF Upcoming 1 Gr 1')).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    bodyRows = within(screen.getByRole('table', { name: 'Bronze Aktiv Wertung' }))
      .getAllByRole('row')
      .slice(1);
    expect(bodyRows.map((row) => row.getAttribute('data-row-kind'))).toEqual([
      'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    expect(bodyRows[0]).not.toHaveClass('border-t-4');
    expect(screen.getByText('FF Upcoming 2 Gr 2')).toBeInTheDocument();
    expect(screen.getByText('FF Upcoming 8 Gr 8')).toBeInTheDocument();
    expect(screen.queryByText('FF Upcoming 9 Gr 9')).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByText('FF Rank 1 Gr 1')).toBeInTheDocument();
    expect(screen.queryByText('FF Upcoming 8 Gr 8')).not.toBeInTheDocument();
  });

  it('shows an upcoming-only standard category without a leading transition or empty message', async () => {
    mockTvScenario({
      mode: 'FIXED',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: [],
            openEntries: upcomingEntries(2),
          },
        },
      },
    });

    render(<TvScoreboard />);

    const table = await screen.findByRole('table', { name: 'Bronze Aktiv Wertung' });
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[0]).toHaveAttribute('data-row-kind', 'upcoming');
    expect(bodyRows[0]).not.toHaveClass('border-t-4');
    expect(within(table).getByText('FF Upcoming 1 Gr 1')).toBeInTheDocument();
    expect(within(table).queryByText('Noch keine Ergebnisse in dieser Kategorie')).not.toBeInTheDocument();
  });

  it('shows the empty-results message only when no Ranked Results or Upcoming Entries exist', async () => {
    mockTvScenario({
      mode: 'FIXED',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: [],
            openEntries: [],
          },
        },
      },
    });

    render(<TvScoreboard />);

    const table = await screen.findByRole('table', { name: 'Bronze Aktiv Wertung' });
    expect(within(table).getByText('Noch keine Ergebnisse in dieser Kategorie')).toBeInTheDocument();
    expect(within(table).queryByText(/FF Upcoming/)).not.toBeInTheDocument();
  });

  it('uses the configured ranking page duration from the public TV state', async () => {
    vi.useFakeTimers();
    mockTvScenario({
      mode: 'FIXED',
      rankingPageDurationMs: 12_000,
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: rankedResults(9),
          },
        },
      },
    });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    await act(async () => vi.advanceTimersByTimeAsync(11_999));
    expect(screen.queryByText('FF Rank 9 Gr 9')).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText('FF Rank 9 Gr 9')).toBeInTheDocument();
  });

  it('keeps category rotation independent from ranking pages and resets the new category to page one', async () => {
    vi.useFakeTimers();
    const rotatingResults = {
      ...mockResultsData,
      categories: {
        'bronze-aktiv': {
          ...mockResultsData.categories['bronze-aktiv'],
          rankedResults: rankedResults(9, 'Bronze Rank'),
        },
        'silber-aktiv': {
          ...mockResultsData.categories['bronze-aktiv'],
          id: 'silber-aktiv',
          displayName: 'Silber Aktiv',
          order: 2,
          rankedResults: rankedResults(9, 'Silber Rank'),
        },
      },
    };
    mockTvScenario({
      mode: 'ROTATION',
      categoriesConfig: {
        'bronze-aktiv': { name: 'Bronze Aktiv', tvEnabled: true, order: 1, displayDuration: 10 },
        'silber-aktiv': { name: 'Silber Aktiv', tvEnabled: true, order: 2, displayDuration: 20 },
      },
      resultsData: rotatingResults,
    });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole('heading', { level: 2, name: 'Bronze Aktiv' })).toBeInTheDocument();
    expect(screen.getByText('Bronze Rank 1 Gr 1')).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByRole('heading', { level: 2, name: 'Bronze Aktiv' })).toBeInTheDocument();
    expect(screen.getByText('Bronze Rank 9 Gr 9')).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('heading', { level: 2, name: 'Silber Aktiv' })).toBeInTheDocument();
    expect(screen.getByText('Silber Rank 1 Gr 1')).toBeInTheDocument();
    expect(screen.queryByText('Silber Rank 9 Gr 9')).not.toBeInTheDocument();
  });

  it('returns to the first page when live results make the current page invalid', async () => {
    vi.useFakeTimers();
    let currentResults = {
      ...mockResultsData,
      categories: {
        'bronze-aktiv': {
          ...mockResultsData.categories['bronze-aktiv'],
          rankedResults: rankedResults(11),
        },
      },
    };
    mockTvMode('FIXED');
    const modeFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/public/results') {
        return { ok: true, json: async () => currentResults } as Response;
      }
      return modeFetch(url);
    });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByText('FF Rank 9 Gr 9')).toBeInTheDocument();

    currentResults = {
      ...currentResults,
      categories: {
        'bronze-aktiv': {
          ...currentResults.categories['bronze-aktiv'],
          rankedResults: rankedResults(4),
        },
      },
    };
    await act(async () => vi.advanceTimersByTimeAsync(2000));

    expect(screen.getByText('FF Rank 1 Gr 1')).toBeInTheDocument();
    expect(screen.getByText('FF Rank 4 Gr 4')).toBeInTheDocument();
    expect(screen.queryByText('FF Rank 6 Gr 6')).not.toBeInTheDocument();
  });

  it('preserves combined-category columns and score formatting on ranking pages', async () => {
    vi.useFakeTimers();
    const combinedRanking = Array.from({ length: 9 }, (_, index) => ({
      rank: index + 1,
      fireBrigadeName: `Combined Brigade ${index + 1}`,
      groupName: `Combined Group ${index + 1}`,
      scoreHundredths: 9000 + index * 200,
      primaryRun: {
        entryId: `e1-${index}`,
        scoreHundredths: 4000 + index * 100,
        attackTimeHundredths: null,
        attackTimeErrors: null,
        relayRaceHundredths: null,
        relayRaceErrors: null,
      },
      secondaryRun: {
        entryId: `e2-${index}`,
        scoreHundredths: 5000 + index * 100,
        attackTimeHundredths: null,
        attackTimeErrors: null,
        relayRaceHundredths: null,
        relayRaceErrors: null,
      },
    }));
    mockTvScenario({
      mode: 'FIXED',
      selectedCategoryId: 'gesamt-aktiv',
      categoriesConfig: {
        'gesamt-aktiv': { name: 'Gesamt Aktiv', tvEnabled: true, order: 1, displayDuration: 10 },
      },
      resultsData: {
        ...mockResultsData,
        categories: {
          'gesamt-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            id: 'gesamt-aktiv',
            displayName: 'Gesamt Aktiv',
            type: 'combined',
            categoryTypeName1: 'Bronze',
            categoryTypeName2: 'Silber',
            rankedResults: combinedRanking,
            openEntries: [],
          },
        },
      },
    });

    render(<TvScoreboard />);
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(screen.getByRole('columnheader', { name: 'Bronze' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Silber' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'plus' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'equals' })).not.toBeInTheDocument();
    const rankingTable = screen.getByRole('table', { name: 'Gesamt Aktiv Wertung' });
    expect(rankingTable).toHaveAttribute('data-density', 'full');
    expect(rankingTable).toHaveClass('grid', 'h-full', 'grid-rows-[3.25rem_minmax(0,1fr)]');
    const firstPlace = screen.getByRole('row', {
      name: '1 Combined Brigade 1 Combined Group 1 40,00 s 50,00 s 90,00 s',
    });
    expect(firstPlace).toHaveClass('border-l-4', 'border-l-amber-400');
    expect(firstPlace).toHaveClass('grid', 'grid-cols-[6%_minmax(0,1fr)_20%_20%_22%]');
    const combinedIdentity = screen.getByText('Combined Brigade 1 Combined Group 1');
    expect(combinedIdentity).toHaveClass('truncate', 'whitespace-nowrap');
    expect(combinedIdentity).toHaveAttribute('title', 'Combined Brigade 1 Combined Group 1');
    expect(combinedIdentity).toHaveAttribute('aria-label', 'Combined Brigade 1 Combined Group 1');
    expect(screen.queryByText('Combined Brigade 9')).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByRole('row', {
      name: '9 Combined Brigade 9 Combined Group 9 48,00 s 58,00 s 106,00 s',
    })).toBeInTheDocument();
  });

  it('shows the Aktiv and Jugend calculations for the Feuerwehr ranking', async () => {
    mockTvScenario({
      mode: 'FIXED',
      selectedCategoryId: 'gesamt-feuerwehr',
      categoriesConfig: {
        'gesamt-feuerwehr': {
          name: 'Gesamtwertung Feuerwehr',
          tvEnabled: true,
          order: 1,
          displayDuration: 10,
        },
      },
      resultsData: {
        ...mockResultsData,
        categories: {
          'gesamt-feuerwehr': {
            ...mockResultsData.categories['bronze-aktiv'],
            id: 'gesamt-feuerwehr',
            displayName: 'Gesamtwertung Feuerwehr',
            type: 'combined',
            isBrigadePairing: true,
            categoryTypeName1: 'Bronze Aktiv',
            categoryTypeName2: 'Bronze Jugend',
            rankedResults: [{
              rank: 1,
              fireBrigadeName: 'FF Oberndorf',
              groupName: '1',
              secondaryGroupName: 'Jugend 1',
              scoreHundredths: 8338,
              primaryRun: {
                entryId: 'e1',
                scoreHundredths: 4238,
                attackTimeHundredths: 3738,
                attackTimeErrors: 5,
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
            }],
            openEntries: [],
          },
        },
      },
    });

    render(<TvScoreboard />);

    expect(await screen.findByRole('columnheader', { name: 'Bronze Aktiv' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bronze Jugend' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Feuerwehr' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'plus' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'equals' })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Gesamtwertung Feuerwehr Wertung' }))
      .toHaveAttribute('data-density', 'full');
    expect(screen.getByRole('row', {
      name: '1 FF Oberndorf Gruppe 1 37,38 s +5,00 Gruppe Jugend 1 41,00 s 83,38 s',
    })).toBeInTheDocument();
    const fireBrigadeIdentity = screen.getByText('FF Oberndorf');
    expect(fireBrigadeIdentity).toBeInTheDocument();
    expect(screen.queryByText('FF Oberndorf 1')).not.toBeInTheDocument();
  });

  it.each(['broadcast', 'ceremony', 'outdoor'] as TvTheme[])(
    'retains generic combined contribution semantics in the %s theme without Upcoming Entries',
    async (theme) => {
      mockTvScenario({
        mode: 'FIXED',
        selectedCategoryId: 'combined-fallback',
        tvPresentation: { ...DEFAULT_TV_PRESENTATION, theme },
        categoriesConfig: {
          'combined-fallback': { name: 'Combined Fallback', tvEnabled: true, order: 1, displayDuration: 10 },
        },
        resultsData: {
          ...mockResultsData,
          categories: {
            'combined-fallback': {
              ...mockResultsData.categories['bronze-aktiv'],
              id: 'combined-fallback',
              displayName: 'Combined Fallback',
              type: 'combined',
              rankedResults: Array.from({ length: 3 }, (_, index) => ({
                rank: index + 1,
                fireBrigadeName: `Fallback Brigade ${index + 1}`,
                groupName: `Fallback Group ${index + 1}`,
                scoreHundredths: 8000 + index * 200,
                primaryRun: {
                  entryId: `e1-${index}`,
                  scoreHundredths: 4100 + index * 100,
                  attackTimeHundredths: null,
                  attackTimeErrors: null,
                  relayRaceHundredths: null,
                  relayRaceErrors: null,
                },
                secondaryRun: {
                  entryId: `e2-${index}`,
                  scoreHundredths: 3900 + index * 100,
                  attackTimeHundredths: null,
                  attackTimeErrors: null,
                  relayRaceHundredths: null,
                  relayRaceErrors: null,
                },
              })),
              openEntries: [{
                id: 'combined-upcoming',
                fireBrigadeName: 'Combined Upcoming',
                groupName: 'Must Stay Hidden',
              }],
            },
          },
        },
      });

      render(<TvScoreboard />);

      const table = await screen.findByRole('table', { name: 'Combined Fallback Wertung' });
      expect(screen.getByTestId('tv-shared-frame')).toHaveAttribute('data-theme', theme);
      expect(table).toHaveAttribute('data-density', 'full');
      expect(screen.getByRole('row', {
        name: '1 Fallback Brigade 1 Fallback Group 1 41,00 s 39,00 s 80,00 s',
      })).toBeInTheDocument();
      expect(screen.queryByText('Combined Upcoming Must Stay Hidden')).not.toBeInTheDocument();
      expect(within(table).getAllByRole('row')).toHaveLength(4);
    },
  );

  it('renders missing combined identity and contribution values without invalid output', async () => {
    mockTvScenario({
      mode: 'FIXED',
      selectedCategoryId: 'gesamt-feuerwehr',
      categoriesConfig: {
        'gesamt-feuerwehr': { name: 'Gesamt Feuerwehr', tvEnabled: true, order: 1, displayDuration: 10 },
      },
      resultsData: {
        ...mockResultsData,
        categories: {
          'gesamt-feuerwehr': {
            ...mockResultsData.categories['bronze-aktiv'],
            id: 'gesamt-feuerwehr',
            displayName: 'Gesamt Feuerwehr',
            type: 'combined',
            rankedResults: [{ rank: 1, fireBrigadeName: 'FF Safe' }],
            openEntries: [],
          },
        },
      },
    });

    render(<TvScoreboard />);

    const row = await screen.findByRole('row', {
      name: '1 FF Safe — — —',
    });
    expect(within(row).getAllByText('—')).toHaveLength(3);
    expect(row).not.toHaveTextContent(/undefined|NaN/);
    expect(within(row).queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('presents only the configured announcement as MESSAGE canvas content', async () => {
    mockTvScenario({
      mode: 'MESSAGE',
      tvAnnouncement: {
        headline: 'Siegerehrung um 16:00 Uhr',
        message: 'Bitte versammeln Sie sich vor der Hauptbühne.',
      },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    expect(within(canvas).getByRole('heading', { name: 'Siegerehrung um 16:00 Uhr' })).toBeInTheDocument();
    expect(within(canvas).getByText('Bitte versammeln Sie sich vor der Hauptbühne.')).toBeInTheDocument();
    expect(within(canvas).queryByText('Wichtige Durchsage')).not.toBeInTheDocument();
    expect(within(canvas).queryByText('Bronze Aktiv')).not.toBeInTheDocument();
    expect(within(canvas).queryByText('FF First')).not.toBeInTheDocument();
    expect(screen.getByTestId('tv-qr-code')).toBeInTheDocument();
  });

  it('keeps the Shared Frame visible when MESSAGE has no announcement data', async () => {
    mockTvScenario({ mode: 'MESSAGE', tvAnnouncement: null });

    render(<TvScoreboard />);

    const frame = await screen.findByTestId('tv-shared-frame');
    expect(within(frame).getByRole('banner', { name: 'Identity Rail' })).toBeInTheDocument();
    expect(within(frame).getByRole('complementary', { name: 'Scan Panel' })).toBeInTheDocument();
    expect(within(frame).getByText('Keine Durchsage konfiguriert')).toBeInTheDocument();
  });

  it('presents the first three ranked results as a silver-gold-bronze podium', async () => {
    mockTvScenario({
      mode: 'WINNERS',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: rankedResults(4, 'FF Podium'),
          },
        },
      },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    expect(within(canvas).getByText('Siegerehrung')).toBeInTheDocument();
    expect(within(canvas).getByRole('heading', { name: 'Bronze Aktiv' })).toBeInTheDocument();

    const podiumHeadings = within(canvas).getAllByRole('heading', { level: 3 });
    expect(podiumHeadings.map((heading) => heading.textContent)).toEqual([
      'FF Podium 2',
      'FF Podium 1',
      'FF Podium 3',
    ]);
    expect(within(podiumHeadings[0].closest('section')!).getByText('42,00 s')).toBeInTheDocument();
    expect(within(podiumHeadings[1].closest('section')!).getByText('40,00 s')).toBeInTheDocument();
    expect(within(podiumHeadings[2].closest('section')!).getByText('44,00 s')).toBeInTheDocument();
    expect(within(canvas).queryByText('FF Podium 4')).not.toBeInTheDocument();
    expect(screen.getByTestId('tv-qr-code')).toBeInTheDocument();
  });

  it('uses mapped numerical ranks to keep DNF results off the podium', async () => {
    const evaluationTypes: EvaluationTypeView[] = [
      {
        id: 'combined',
        name: 'Gesamt',
        categoryTypeId1: 'bronze',
        categoryTypeName1: 'Bronze',
        hasRelayRace1: false,
        categoryTypeId2: 'silver',
        categoryTypeName2: 'Silber',
        hasRelayRace2: false,
        excludeRelayRace: false,
        isBrigadePairing: false,
        showSingleResults: true,
        publicTv: true,
        order: 1,
      },
    ];
    const entries: EntryDetailView[] = [
      {
        id: 'complete-bronze', groupId: 'complete', categoryTypeId: 'bronze', runStatus: 'VALID',
        startOrderPosition: 1, attackTimeHundredths: 4000, attackTimeErrors: 0,
        relayRaceHundredths: null, relayRaceErrors: null, groupName: 'Gruppe Komplett',
        fireBrigadeId: 'complete-brigade', fireBrigadeName: 'FF Komplett',
      },
      {
        id: 'complete-silver', groupId: 'complete', categoryTypeId: 'silver', runStatus: 'VALID',
        startOrderPosition: 1, attackTimeHundredths: 4100, attackTimeErrors: 0,
        relayRaceHundredths: null, relayRaceErrors: null, groupName: 'Gruppe Komplett',
        fireBrigadeId: 'complete-brigade', fireBrigadeName: 'FF Komplett',
      },
      {
        id: 'single-bronze', groupId: 'single', categoryTypeId: 'bronze', runStatus: 'VALID',
        startOrderPosition: 2, attackTimeHundredths: 3900, attackTimeErrors: 0,
        relayRaceHundredths: null, relayRaceErrors: null, groupName: 'Gruppe Einzel',
        fireBrigadeId: 'single-brigade', fireBrigadeName: 'FF Einzel',
      },
      {
        id: 'dnf-bronze', groupId: 'dnf', categoryTypeId: 'bronze', runStatus: 'DNF',
        startOrderPosition: 3, attackTimeHundredths: null, attackTimeErrors: null,
        relayRaceHundredths: null, relayRaceErrors: null, groupName: 'Gruppe Ausfall',
        fireBrigadeId: 'dnf-brigade', fireBrigadeName: 'FF Ausfall',
      },
      {
        id: 'dnf-silver', groupId: 'dnf', categoryTypeId: 'silver', runStatus: 'VALID',
        startOrderPosition: 3, attackTimeHundredths: 4200, attackTimeErrors: 0,
        relayRaceHundredths: null, relayRaceErrors: null, groupName: 'Gruppe Ausfall',
        fireBrigadeId: 'dnf-brigade', fireBrigadeName: 'FF Ausfall',
      },
    ];
    const categories = buildCategoriesResultMap(evaluationTypes, entries);

    mockTvScenario({
      mode: 'WINNERS',
      selectedCategoryId: 'combined',
      categoriesConfig: {
        combined: { name: 'Gesamt', tvEnabled: true, order: 1, displayDuration: 10 },
      },
      resultsData: { ...mockResultsData, categories },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    expect(within(canvas).getByRole('heading', { name: 'FF Komplett' })).toBeInTheDocument();
    expect(within(canvas).getByRole('heading', { name: 'FF Einzel' })).toBeInTheDocument();
    expect(within(canvas).queryByRole('heading', { name: 'FF Ausfall' })).not.toBeInTheDocument();
    expect(within(canvas).getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  it('uses the ranked place for tied podium results', async () => {
    mockTvScenario({
      mode: 'WINNERS',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: [
              { rank: 1, fireBrigadeName: 'FF Gold', groupName: 'Gr 1', scoreHundredths: 4000 },
              { rank: 2, fireBrigadeName: 'FF Silver A', groupName: 'Gr 2', scoreHundredths: 4200 },
              { rank: 2, fireBrigadeName: 'FF Silver B', groupName: 'Gr 3', scoreHundredths: 4200 },
            ],
          },
        },
      },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    const silverB = within(canvas).getByRole('heading', { name: 'FF Silver B' }).closest('section')!;
    expect(within(silverB).getByText('2')).toBeInTheDocument();
  });

  it.each([
    { state: 'empty', rankedResults: [] },
    { state: 'missing', rankedResults: null },
  ])('keeps the Shared Frame visible when WINNERS ranking data is $state', async ({ rankedResults }) => {
    mockTvScenario({
      mode: 'WINNERS',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults,
          },
        },
      },
    });

    render(<TvScoreboard />);

    const frame = await screen.findByTestId('tv-shared-frame');
    expect(within(frame).getByRole('banner', { name: 'Identity Rail' })).toBeInTheDocument();
    expect(within(frame).getByRole('complementary', { name: 'Scan Panel' })).toBeInTheDocument();
    expect(within(frame).getByText('Noch keine Ergebnisse in dieser Kategorie')).toBeInTheDocument();
  });

  it('fails safely when a podium result has incomplete identity and score data', async () => {
    mockTvScenario({
      mode: 'WINNERS',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: [{ rank: 1 }],
          },
        },
      },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    expect(within(canvas).getByRole('heading', { name: 'Unbekannte Feuerwehr' })).toBeInTheDocument();
    expect(within(canvas).getByText('—')).toBeInTheDocument();
    expect(canvas).not.toHaveTextContent('undefined');
    expect(screen.getByTestId('tv-qr-code')).toBeInTheDocument();
  });

  it('aligns white main times and reserves penalty slot for standard ranking rows', async () => {
    mockTvScenario({
      mode: 'FIXED',
      selectedCategoryId: 'bronze-aktiv',
      resultsData: {
        ...mockResultsData,
        categories: {
          'bronze-aktiv': {
            ...mockResultsData.categories['bronze-aktiv'],
            rankedResults: [
              {
                rank: 1,
                groupId: 'g1',
                fireBrigadeName: 'FF Clean Run',
                groupName: 'Gr 1',
                scoreHundredths: 4394,
                primaryRun: {
                  entryId: 'e1',
                  attackTimeHundredths: 4394,
                  attackTimeErrors: 0,
                  relayRaceHundredths: null,
                  relayRaceErrors: null,
                  scoreHundredths: 4394,
                },
              },
              {
                rank: 2,
                groupId: 'g2',
                fireBrigadeName: 'FF With Penalty',
                groupName: 'Gr 2',
                scoreHundredths: 5488,
                primaryRun: {
                  entryId: 'e2',
                  attackTimeHundredths: 4488,
                  attackTimeErrors: 10,
                  relayRaceHundredths: null,
                  relayRaceErrors: null,
                  scoreHundredths: 5488,
                },
              },
            ],
          },
        },
      },
    });

    render(<TvScoreboard />);

    const canvas = await screen.findByTestId('tv-mode-canvas');
    const rows = within(canvas).getAllByRole('row').filter((r) => r.getAttribute('data-row-kind') === 'ranked');
    expect(rows).toHaveLength(2);

    // Row 1 (Clean run): white time 43,94 s, empty penalty slot with w-[6ch]
    const row1TimeGrid = within(rows[0]).getByText('43,94 s').parentElement;
    expect(row1TimeGrid).toHaveClass('grid-cols-[1fr_auto]');
    const row1PenaltySlot = row1TimeGrid?.querySelectorAll('span')[1];
    expect(row1PenaltySlot).toHaveClass('w-[6ch]', 'text-left');
    expect(row1PenaltySlot).toHaveTextContent('');

    // Row 2 (With +10,00 penalty): white time 44,88 s, penalty +10,00 in w-[6ch] slot
    const row2TimeGrid = within(rows[1]).getByText('44,88 s').parentElement;
    expect(row2TimeGrid).toHaveClass('grid-cols-[1fr_auto]');
    const row2PenaltySlot = row2TimeGrid?.querySelectorAll('span')[1];
    expect(row2PenaltySlot).toHaveClass('w-[6ch]', 'text-left');
    expect(row2PenaltySlot).toHaveTextContent('+10,00');
    expect(within(row2PenaltySlot!).getByText('+10,00')).toHaveClass('text-white', 'bg-red-600');
  });

  it('handles offline resilience silently', async () => {
    vi.useFakeTimers();
    render(<TvScoreboard />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // Flush promises
    });
    expect(screen.getAllByText('Bronze Aktiv')[0]).toBeInTheDocument();

    // Make fetch fail
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000); // Trigger intervals and flush promises
    });

    // UI should still display last known state without crashing
    expect(screen.getAllByText('Bronze Aktiv')[0]).toBeInTheDocument();
  });

  it('renders demo values when ?demo=true is present in location query', async () => {
    window.history.pushState({}, '', '/tv?demo=true');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<TvScoreboard />);

    expect(await screen.findByText('BFLB FREIWILLIGE FEUERWEHR')).toBeInTheDocument();
    expect(await screen.findByText('Allerheiligen-Lebing 1')).toBeInTheDocument();
  });

  it('allows overriding theme in demo mode with numeric parameter ?theme=2 or string ?theme=ceremony', async () => {
    window.history.pushState({}, '', '/tv?demo=true&theme=2');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { container, unmount } = render(<TvScoreboard />);

    expect(await screen.findByText('BFLB FREIWILLIGE FEUERWEHR')).toBeInTheDocument();
    // Ceremony theme uses amber-950 frame gradient
    expect(container.querySelector('.via-amber-950')).toBeInTheDocument();
    unmount();

    // Also test ?theme=3 / outdoor
    window.history.pushState({}, '', '/tv?demo=true&theme=3');
    const { container: container3, unmount: unmount3 } = render(<TvScoreboard />);
    expect(await screen.findByText('BFLB FREIWILLIGE FEUERWEHR')).toBeInTheDocument();
    expect(container3.querySelector('.via-slate-50')).toBeInTheDocument();
    unmount3();

    // Also test ?theme=outdoor string
    window.history.pushState({}, '', '/tv?demo=true&theme=outdoor');
    const { container: containerOutdoor } = render(<TvScoreboard />);
    expect(await screen.findByText('BFLB FREIWILLIGE FEUERWEHR')).toBeInTheDocument();
    expect(containerOutdoor.querySelector('.via-slate-50')).toBeInTheDocument();
  });

  it('hides the QR code popup when qrCodeEnabled is false', async () => {
    mockTvScenario({
      mode: 'ROTATION',
      tvPresentation: {
        ...DEFAULT_TV_PRESENTATION,
        qrCodeEnabled: false,
      },
    });

    render(<TvScoreboard />);

    await screen.findByTestId('tv-shared-frame');
    expect(screen.queryByTestId('tv-qr-popup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tv-qr-code')).not.toBeInTheDocument();
  });

  it('renders the QR code popup when qrCodeEnabled is true', async () => {
    mockTvScenario({
      mode: 'ROTATION',
      tvPresentation: {
        ...DEFAULT_TV_PRESENTATION,
        qrCodeEnabled: true,
        qrCodeIntervalSeconds: 30,
        qrCodeDurationSeconds: 10,
      },
    });

    render(<TvScoreboard />);

    const popup = await screen.findByTestId('tv-qr-popup');
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute('data-visible', 'true');
    expect(within(popup).getByTestId('tv-qr-code')).toBeInTheDocument();
  });

  it('renders the QR code popup as always visible when qrCodeAlwaysVisible is true', async () => {
    mockTvScenario({
      mode: 'ROTATION',
      tvPresentation: {
        ...DEFAULT_TV_PRESENTATION,
        qrCodeEnabled: true,
        qrCodeAlwaysVisible: true,
      },
    });

    render(<TvScoreboard />);

    const popup = await screen.findByTestId('tv-qr-popup');
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute('data-visible', 'true');
    expect(popup).toHaveAttribute('data-always-visible', 'true');
  });

  it('renders the AdminAccessSplashCanvas and hides floating QR popup when adminSplashEnabled is true', async () => {
    mockTvScenario({
      mode: 'ROTATION',
      tvPresentation: {
        ...DEFAULT_TV_PRESENTATION,
        adminSplashEnabled: true,
      },
    });

    render(<TvScoreboard />);

    expect(await screen.findByTestId('tv-admin-splash-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-url')).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-qr')).toBeInTheDocument();
    expect(screen.queryByTestId('tv-qr-popup')).not.toBeInTheDocument();
  });
});
