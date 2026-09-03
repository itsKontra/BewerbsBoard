// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TvIterationSwitcher } from './switcher/TvIterationSwitcher';
import { IterationOneTelemetry } from './iterations/IterationOneTelemetry';
import { IterationTwoIndustrial } from './iterations/IterationTwoIndustrial';
import { IterationThreeNordic } from './iterations/IterationThreeNordic';
import { TvScoreboard } from './TvScoreboard';
import type { TvStateApiResponse } from '../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../public/components/PublicScoreboard';

const mockTvState: TvStateApiResponse = {
  mode: 'FIXED',
  selectedCategoryId: 'bronze-aktiv',
  updatedAt: Date.now(),
  eventTitle: 'LANDESBEWERB 2026',
  categoriesConfig: {
    'bronze-aktiv': { tvEnabled: true, order: 1, displayDuration: 10 },
  },
  tvPresentation: {
    theme: 'broadcast',
    logoUrl: '/logo.png',
    headerLabel: 'Feuerwehr Leistungsbewerb',
    qrCodeEnabled: true,
    qrCodeAlwaysVisible: false,
    qrCodeIntervalSeconds: 30,
    qrCodeDurationSeconds: 10,
    adminSplashEnabled: false,
  },
};

const mockResultsData: PublicResultsApiResponse = {
  eventTitle: 'LANDESBEWERB 2026',
  publicUrl: 'https://bewerb.feuerwehr.at',
  timestamp: Date.now(),
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
          fireBrigadeId: 'b1',
          fireBrigadeName: 'FF Alpha',
          groupName: 'Gruppe 1',
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
          fireBrigadeId: 'b2',
          fireBrigadeName: 'FF Beta',
          groupName: 'Gruppe 2',
          scoreHundredths: 4250,
          primaryRun: {
            entryId: 'e2',
            attackTimeHundredths: 4250,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 4250,
          },
        },
      ],
      openEntries: [
        { startOrderPosition: 3, fireBrigadeName: 'FF Gamma', groupName: 'Gruppe 3' },
      ],
      dnfEntries: [],
    },
  },
};

describe('TvIterationSwitcher Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders 3 iteration layout buttons with active state', () => {
    const onSelect = vi.fn();
    render(<TvIterationSwitcher currentIteration={1} onSelectIteration={onSelect} />);

    expect(screen.getByRole('tab', { name: /Iteration 1/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Iteration 2/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Iteration 3/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('triggers onSelectIteration when clicking buttons 1, 2, or 3', () => {
    const onSelect = vi.fn();
    render(<TvIterationSwitcher currentIteration={1} onSelectIteration={onSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: /Iteration 2/i }));
    expect(onSelect).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('tab', { name: /Iteration 3/i }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it('handles keyboard shortcuts 1, 2, 3 to switch iterations', () => {
    const onSelect = vi.fn();
    render(<TvIterationSwitcher currentIteration={1} onSelectIteration={onSelect} />);

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith(2);

    fireEvent.keyDown(window, { key: '3' });
    expect(onSelect).toHaveBeenCalledWith(3);

    fireEvent.keyDown(window, { key: '1' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('Iteration 1: Telemetry Arena', () => {
  afterEach(() => cleanup());

  it('renders sports broadcast telemetry layout with table and rows', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[1] },
      { kind: 'upcoming' as const, entry: activeCategory.openEntries[0] },
    ];

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={3}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByTestId('tv-shared-frame')).toBeInTheDocument();
    expect(screen.getByTestId('tv-mode-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('tv-header-logo')).toBeInTheDocument();
    expect(screen.getByText('LANDESBEWERB 2026')).toBeInTheDocument();
    expect(screen.getByText('Bronze Aktiv')).toBeInTheDocument();
    expect(screen.getByText(/FF Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/FF Beta/)).toBeInTheDocument();
    expect(screen.getByText(/FF Gamma/)).toBeInTheDocument();
  });

  it('renders winners podium when mode is WINNERS', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    render(
      <IterationOneTelemetry
        tvState={{ ...mockTvState, mode: 'WINNERS' }}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={2}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByText(/Siegerehrung/i)).toBeInTheDocument();
    expect(screen.getByText('FF Alpha')).toBeInTheDocument();
  });
});

describe('Iteration 2: Tactical Iron', () => {
  afterEach(() => cleanup());

  it('renders tactical industrial layout with high-vis styling', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
    ];

    render(
      <IterationTwoIndustrial
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={1}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByTestId('tv-shared-frame')).toBeInTheDocument();
    expect(screen.getByTestId('tv-mode-canvas')).toBeInTheDocument();
    expect(screen.getByText('TACTICAL EINSATZBOARD')).toBeInTheDocument();
    expect(screen.getByText('LANDESBEWERB 2026')).toBeInTheDocument();
    expect(screen.getByText(/FF Alpha/)).toBeInTheDocument();
  });
});

describe('Iteration 3: Precision Studio', () => {
  afterEach(() => cleanup());

  it('renders dual-pane Nordic layout with leader spotlight and ladder', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[1] },
    ];

    render(
      <IterationThreeNordic
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={2}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByTestId('tv-shared-frame')).toBeInTheDocument();
    expect(screen.getByTestId('tv-mode-canvas')).toBeInTheDocument();
    expect(screen.getByText('LEADER SPOTLIGHT')).toBeInTheDocument();
    expect(screen.getByText('KATEGORIE STATUS')).toBeInTheDocument();
    expect(screen.getAllByText('FF Alpha').length).toBeGreaterThanOrEqual(1);
  });
});

describe('TvScoreboard with Iteration selection', () => {
  afterEach(() => cleanup());

  it('renders Iteration 1 when initialIteration={1} is passed', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={1} />);

    expect(await screen.findByText('LIVE TELEMETRY')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Iteration 1/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders Iteration 2 when initialIteration={2} is passed', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={2} />);

    expect(await screen.findByText('TACTICAL EINSATZBOARD')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Iteration 2/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders Iteration 3 when initialIteration={3} is passed', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={3} />);

    expect(await screen.findByText('LEADER SPOTLIGHT')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Iteration 3/i })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Competition Run Timing & [+15] Penalty Tags', () => {
  afterEach(() => cleanup());

  it('renders raw attack time and [+15] red penalty tag in single run without summing up', () => {
    const categoryWithPenalties: CategoryResultData = {
      id: 'bronze-aktiv',
      displayName: 'Bronze Aktiv',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      hasRelayRace1: false,
      rankedResults: [
        {
          rank: 1,
          groupId: 'g-pen',
          fireBrigadeId: 'b-pen',
          fireBrigadeName: 'FF Florian',
          groupName: 'Gruppe 1',
          scoreHundredths: 5500,
          primaryRun: {
            entryId: 'e-pen',
            attackTimeHundredths: 4000,
            attackTimeErrors: 15,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 5500,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    };

    const rows = [{ kind: 'ranked' as const, entry: categoryWithPenalties.rankedResults[0] }];

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={categoryWithPenalties}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={1}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    // Raw attack time 40,00 s is visible (not hidden as 55,00 s)
    expect(screen.getByText('40,00 s')).toBeInTheDocument();
    // Red tag [+15] is rendered
    const penaltyTag = screen.getByText('[+15]');
    expect(penaltyTag).toBeInTheDocument();
    expect(penaltyTag).toHaveClass('bg-red-600', 'text-white');
  });

  it('renders both ANG and SL times with separate penalty tags on single-relay runs', () => {
    const relayCategory: CategoryResultData = {
      id: 'bronze-aktiv-relay',
      displayName: 'Bronze Aktiv mit Staffel',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      hasRelayRace1: true,
      excludeRelayRace: false,
      rankedResults: [
        {
          rank: 1,
          groupId: 'g-rel',
          fireBrigadeId: 'b-rel',
          fireBrigadeName: 'FF Staffelmeister',
          groupName: 'Gruppe 1',
          scoreHundredths: 9800,
          primaryRun: {
            entryId: 'e-rel',
            attackTimeHundredths: 3800,
            attackTimeErrors: 5,
            relayRaceHundredths: 5500,
            relayRaceErrors: 0,
            scoreHundredths: 9800,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    };

    const rows = [{ kind: 'ranked' as const, entry: relayCategory.rankedResults[0] }];

    render(
      <IterationTwoIndustrial
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={relayCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={1}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    // Headers show ANG and SL
    expect(screen.getByText('ANGRIFF (ANG)')).toBeInTheDocument();
    expect(screen.getByText('STAFFELLAUF (SL)')).toBeInTheDocument();

    // Raw times
    expect(screen.getByText('38,00 s')).toBeInTheDocument();
    expect(screen.getByText('55,00 s')).toBeInTheDocument();
    // Penalty tag [+5]
    expect(screen.getByText('[+5]')).toBeInTheDocument();
  });

  it('renders combined scoreboard with 2 groups and total score column', () => {
    const combinedCategory: CategoryResultData = {
      id: 'gesamt-aktiv',
      displayName: 'Gesamtwertung Aktiv',
      publicEnabled: true,
      order: 1,
      type: 'combined',
      isBrigadePairing: true,
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silber',
      rankedResults: [
        {
          rank: 1,
          groupId: 'g-comb',
          fireBrigadeId: 'b-comb',
          fireBrigadeName: 'FF Doppelpack',
          groupName: '1',
          secondaryGroupName: '2',
          scoreHundredths: 8850,
          primaryRun: {
            entryId: 'e-1',
            attackTimeHundredths: 3850,
            attackTimeErrors: 0,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 3850,
          },
          secondaryRun: {
            entryId: 'e-2',
            attackTimeHundredths: 4500,
            attackTimeErrors: 5,
            relayRaceHundredths: null,
            relayRaceErrors: null,
            scoreHundredths: 5000,
          },
        },
      ],
      openEntries: [],
      dnfEntries: [],
    };

    const rows = [{ kind: 'ranked' as const, entry: combinedCategory.rankedResults[0] }];

    render(
      <IterationThreeNordic
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={combinedCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={1}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    // Headers show Bronze, Silber, and GESAMT
    expect(screen.getAllByText('Bronze').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Silber').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('GESAMT')).toBeInTheDocument();

    // Combined score 88,50 s is displayed
    expect(screen.getAllByText('88,50 s').length).toBeGreaterThanOrEqual(1);
    // Group 2 penalty [+5]
    expect(screen.getAllByText('[+5]').length).toBeGreaterThanOrEqual(1);
  });
});
