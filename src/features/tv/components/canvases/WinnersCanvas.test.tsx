// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WinnersCanvas } from './WinnersCanvas';
import type { CategoryResultData } from '../../../public/types';

const mockCategory: CategoryResultData = {
  id: 'bronze-aktiv',
  displayName: 'Bronze Aktiv',
  publicEnabled: true,
  order: 1,
  type: 'standard',
  rankedResults: [
    {
      rank: 1,
      groupId: 'g1',
      fireBrigadeId: 'fb1',
      fireBrigadeName: 'FF Gold',
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
      fireBrigadeId: 'fb2',
      fireBrigadeName: 'FF Silver',
      groupName: 'Gr 2',
      scoreHundredths: 4200,
      primaryRun: {
        entryId: 'e2',
        attackTimeHundredths: 4200,
        attackTimeErrors: 0,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: 4200,
      },
    },
    {
      rank: 3,
      groupId: 'g3',
      fireBrigadeId: 'fb3',
      fireBrigadeName: 'FF Bronze',
      groupName: 'Gr 3',
      scoreHundredths: 4500,
      primaryRun: {
        entryId: 'e3',
        attackTimeHundredths: 4500,
        attackTimeErrors: 0,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: 4500,
      },
    },
  ],
  openEntries: [],
  dnfEntries: [],
};

describe('WinnersCanvas', () => {
  it('renders fallback when activeCategory is undefined', () => {
    render(
      <WinnersCanvas
        activeCategory={undefined}
        activeRankedResults={[]}
        theme="ceremony"
      />
    );

    expect(screen.getByText('Keine Kategorie für TV-Anzeige aktiv')).toBeInTheDocument();
  });

  it('renders Siegerehrung title and top 3 podium entries', () => {
    render(
      <WinnersCanvas
        activeCategory={mockCategory}
        activeRankedResults={mockCategory.rankedResults}
        theme="ceremony"
      />
    );

    expect(screen.getByText('Siegerehrung')).toBeInTheDocument();
    expect(screen.getByText('Bronze Aktiv')).toBeInTheDocument();
    expect(screen.getByText('FF Gold')).toBeInTheDocument();
    expect(screen.getByText('FF Silver')).toBeInTheDocument();
    expect(screen.getByText('FF Bronze')).toBeInTheDocument();
  });

  it('renders fallback when activeRankedResults is empty', () => {
    render(
      <WinnersCanvas
        activeCategory={mockCategory}
        activeRankedResults={[]}
        theme="ceremony"
      />
    );

    expect(screen.getByText('Noch keine Ergebnisse in dieser Kategorie')).toBeInTheDocument();
  });

  it('shows only 2 podium entries when 3rd slot is a DNF result with null rank', () => {
    const twoRankedPlusDnf: CategoryResultData['rankedResults'] = [
      mockCategory.rankedResults[0],
      mockCategory.rankedResults[1],
      {
        rank: null,
        groupId: 'g-dnf',
        fireBrigadeId: 'fb-dnf',
        fireBrigadeName: 'FF Ausfall',
        groupName: 'Gr DNF',
        scoreHundredths: null,
        primaryRun: {
          entryId: 'e-dnf',
          attackTimeHundredths: null,
          attackTimeErrors: null,
          relayRaceHundredths: null,
          relayRaceErrors: null,
          scoreHundredths: null,
        },
      },
    ];

    const { container } = render(
      <WinnersCanvas
        activeCategory={mockCategory}
        activeRankedResults={twoRankedPlusDnf}
        theme="ceremony"
      />
    );

    expect(within(container).getByText('FF Gold')).toBeInTheDocument();
    expect(within(container).getByText('FF Silver')).toBeInTheDocument();
    expect(within(container).queryByText('FF Ausfall')).not.toBeInTheDocument();
  });
});
