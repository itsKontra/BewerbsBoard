// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IterationOneTelemetry } from './iterations/IterationOneTelemetry';
import { TvScoreboard } from './TvScoreboard';
import type { TvStateApiResponse } from '../hooks/useTvDataFeed';
import type { PublicResultsApiResponse, CategoryResultData } from '../../public/components/PublicScoreboard';
import { uiText } from '../../../ui-text';

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

describe('Refined Layout 1: Telemetry Arena', () => {
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

  it('does not render current time clock in header', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    // No current time clock readout in the header
    expect(screen.queryByText(/^\d{2}:\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });

  it('adds margin-right to current board title container for QR overlay clearance', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    // The container of the board title has substantial right margin
    const boardTitle = screen.getByText('Bronze Aktiv');
    const badgeContainer = boardTitle.closest('.flex.items-center.gap-4');
    expect(badgeContainer).toBeInTheDocument();
    expect(badgeContainer?.className).toMatch(/mr-80/);
  });

  it('uses "Angriff" for single results header without relay', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'ANGRIFF' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'GESAMT' })).not.toBeInTheDocument();
  });

  it('uses "Angriff" and "Staffellauf" for single results with relay', () => {
    const singleRelayCat: CategoryResultData = {
      id: 'silber-aktiv',
      displayName: 'Silber Aktiv',
      publicEnabled: true,
      order: 2,
      type: 'standard',
      hasRelayRace1: true,
      excludeRelayRace: false,
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={singleRelayCat}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'ANGRIFF' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'STAFFELLAUF' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'GESAMT' })).not.toBeInTheDocument();
  });

  it('uses "ANG" and "SL" and "GESAMT" for combined results with relay', () => {
    const combinedRelayCat: CategoryResultData = {
      id: 'gesamt-aktiv',
      displayName: 'Gesamtwertung Aktiv',
      publicEnabled: true,
      order: 3,
      type: 'combined',
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silber',
      hasRelayRace1: true,
      hasRelayRace2: true,
      excludeRelayRace: false,
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={combinedRelayCat}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    expect(screen.getByRole('columnheader', { name: /Bronze ANG/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Bronze SL/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Silber ANG/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Silber SL/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'GESAMT' })).toBeInTheDocument();
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

describe('Penalties & Font Sizes Verification', () => {
  afterEach(() => cleanup());

  it('renders penalties without literal brackets (+15, not [+15]) in red tag with reverted font size', () => {
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

    // Raw attack time is visible
    expect(screen.getByText('40,00 s')).toBeInTheDocument();

    // Penalty tag has "+15" without brackets
    const penaltyTag = screen.getByText('+15');
    expect(penaltyTag).toBeInTheDocument();
    expect(penaltyTag).toHaveClass('bg-red-600', 'text-white', 'text-[0.85em]');
    expect(screen.queryByText('[+15]')).not.toBeInTheDocument();
  });

  it('renders reverted score font size on combined scoreboards', () => {
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
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={combinedCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={1}
        rankingPageIndex={0}
        rankingPageCount={1}
      />
    );

    const scoreElem = screen.getByText('88,50 s');
    expect(scoreElem).toBeInTheDocument();
    expect(scoreElem).toHaveClass('text-[clamp(1.4rem,2.5vw,2.75rem)]');
  });
});

describe('TvScoreboard with Primary Telemetry Layout', () => {
  afterEach(() => cleanup());

  it('renders Telemetry layout when initialIteration={1} is passed', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={1} />);

    expect(await screen.findByText(uiText.tv.telemetry.liveBadge)).toBeInTheDocument();
  });
});
