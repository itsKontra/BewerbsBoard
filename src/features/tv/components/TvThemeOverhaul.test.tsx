// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IterationOneTelemetry } from './iterations/IterationOneTelemetry';
import { TvThemeSwitcher } from './switcher/TvThemeSwitcher';
import { TvScoreboard } from './TvScoreboard';
import type { TvStateApiResponse } from '../hooks/useTvDataFeed';
import type { PublicResultsApiResponse } from '../../public/components/PublicScoreboard';

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
      ],
      openEntries: [
        { startOrderPosition: 2, fireBrigadeName: 'FF Beta', groupName: 'Gruppe 2' },
      ],
      dnfEntries: [],
    },
  },
};

describe('TvThemeSwitcher Component', () => {
  afterEach(() => cleanup());

  it('renders all three themes with shortcut indicators', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    expect(screen.getByTestId('tv-theme-switcher')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Broadcast/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Ceremony/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Outdoor/i })).toBeInTheDocument();
  });

  it('calls onSelectTheme when clicking theme buttons', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: /Ceremony/i }));
    expect(onSelect).toHaveBeenCalledWith('ceremony');

    fireEvent.click(screen.getByRole('tab', { name: /Outdoor/i }));
    expect(onSelect).toHaveBeenCalledWith('outdoor');
  });

  it('switches themes using keyboard hotkeys 1, 2, 3', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('ceremony');

    fireEvent.keyDown(window, { key: '3' });
    expect(onSelect).toHaveBeenCalledWith('outdoor');

    fireEvent.keyDown(window, { key: '1' });
    expect(onSelect).toHaveBeenCalledWith('broadcast');
  });

  it('allows minimizing and expanding the switcher widget', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    const minimizeBtn = screen.getByRole('button', { name: 'Themen-Umschalter minimieren' });
    fireEvent.click(minimizeBtn);

    const openBtn = screen.getByRole('button', { name: 'Themen-Umschalter öffnen' });
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(screen.getByRole('tab', { name: /Ceremony/i })).toBeInTheDocument();
  });
});

describe('Overhauled Themes in Scoreboard Layout', () => {
  afterEach(() => cleanup());

  it('renders ceremony theme with gala gold and velvet obsidian styling', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
      { kind: 'upcoming' as const, entry: activeCategory.openEntries[0] },
    ];

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={2}
        rankingPageIndex={0}
        rankingPageCount={1}
        theme="ceremony"
      />
    );

    const frame = screen.getByTestId('tv-shared-frame');
    expect(frame).toHaveAttribute('data-theme', 'ceremony');
    expect(frame).toHaveClass('bg-[#0a070e]');
    expect(screen.getByText('FESTGALA & SIEGEREHRUNG')).toBeInTheDocument();
    expect(screen.getByText('FF Alpha Gruppe 1')).toHaveClass('text-[#fffbeb]');
  });

  it('renders outdoor theme with high-sun daylight stadium styling and carbon text', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
      { kind: 'upcoming' as const, entry: activeCategory.openEntries[0] },
    ];

    render(
      <IterationOneTelemetry
        tvState={mockTvState}
        resultsData={mockResultsData}
        activeCategory={activeCategory}
        visibleRankingRows={rows}
        rankingPresentationRowsCount={2}
        rankingPageIndex={0}
        rankingPageCount={1}
        theme="outdoor"
      />
    );

    const frame = screen.getByTestId('tv-shared-frame');
    expect(frame).toHaveAttribute('data-theme', 'outdoor');
    expect(frame).toHaveClass('bg-slate-100', 'text-slate-950');
    expect(screen.getByText('TAGESLICHT STADION')).toBeInTheDocument();
    expect(screen.getByText('FF Alpha Gruppe 1')).toHaveClass('text-slate-950');
  });

  it('renders TvThemeSwitcher inside TvScoreboard when showSwitcher is enabled', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={1} showSwitcher={true} />);

    expect(await screen.findByTestId('tv-theme-switcher')).toBeInTheDocument();
  });
});
