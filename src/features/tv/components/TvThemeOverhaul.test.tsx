// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { IterationOneTelemetry } from './iterations/IterationOneTelemetry';
import { TvThemeSwitcher } from './switcher/TvThemeSwitcher';
import { TvScoreboard } from './TvScoreboard';
import { TvRunScoreCell } from './ui/TvRunScoreCell';
import type { TvStateApiResponse } from '../hooks/useTvDataFeed';
import type { PublicResultsApiResponse } from '../../public/components/PublicScoreboard';
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

  it('renders all three themes with shortcut indicators from uiText', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    expect(screen.getByTestId('tv-theme-switcher')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.broadcast.name, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.ceremony.name, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.outdoor.name, 'i') })).toBeInTheDocument();
  });

  it('calls onSelectTheme when clicking theme buttons', () => {
    const onSelect = vi.fn();
    render(<TvThemeSwitcher currentTheme="broadcast" onSelectTheme={onSelect} />);

    fireEvent.click(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.ceremony.name, 'i') }));
    expect(onSelect).toHaveBeenCalledWith('ceremony');

    fireEvent.click(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.outdoor.name, 'i') }));
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

    const minimizeBtn = screen.getByRole('button', { name: uiText.tv.switcher.minimizeButton });
    fireEvent.click(minimizeBtn);

    const openBtn = screen.getByRole('button', { name: uiText.tv.switcher.openButton });
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(screen.getByRole('tab', { name: new RegExp(uiText.tv.switcher.themes.ceremony.name, 'i') })).toBeInTheDocument();
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
    expect(screen.getByText(uiText.tv.telemetry.galaBadge)).toBeInTheDocument();
    expect(screen.getByText('FF Alpha Gruppe 1')).toHaveClass('text-[#fffbeb]');
  });

  it('renders outdoor theme without gradient caro grid and with high-sun daylight styling', () => {
    const activeCategory = mockResultsData.categories['bronze-aktiv'];
    const rows = [
      { kind: 'ranked' as const, entry: activeCategory.rankedResults[0] },
      { kind: 'upcoming' as const, entry: activeCategory.openEntries[0] },
    ];

    const { container } = render(
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
    expect(screen.getByText(uiText.tv.telemetry.stadiumBadge)).toBeInTheDocument();
    expect(screen.getByText('FF Alpha Gruppe 1')).toHaveClass('text-slate-950');

    // Verify gradient caro background grid is removed (marked hidden)
    const hiddenOverlay = container.querySelector('.hidden');
    expect(hiddenOverlay).toBeInTheDocument();
  });

  it('renders TvRunScoreCell with prominent groupLabel font size', () => {
    render(
      <TvRunScoreCell
        rawTimeHundredths={3160}
        groupLabel="Gr. 1"
        groupLabelClass="text-slate-900 font-black"
      />
    );

    const groupLabel = screen.getByText('Gr. 1');
    expect(groupLabel).toBeInTheDocument();
    expect(groupLabel.parentElement).toHaveClass('text-sm', 'sm:text-base', 'font-black');
    expect(groupLabel).toHaveClass('text-slate-900');
  });

  it('hides TvThemeSwitcher when demo mode is not active', async () => {
    window.history.pushState({}, '', '/tv');
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={1} />);

    // Switcher should not be rendered on normal production /tv
    expect(screen.queryByTestId('tv-theme-switcher')).not.toBeInTheDocument();
  });

  it('shows TvThemeSwitcher when ?demo=true is active', async () => {
    window.history.pushState({}, '', '/tv?demo=true');
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/public/tv-state')) {
        return Promise.resolve({ ok: true, json: async () => mockTvState });
      }
      return Promise.resolve({ ok: true, json: async () => mockResultsData });
    });

    render(<TvScoreboard initialIteration={1} />);

    expect(await screen.findByTestId('tv-theme-switcher')).toBeInTheDocument();
  });
});
