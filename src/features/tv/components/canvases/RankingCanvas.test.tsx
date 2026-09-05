// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RankingCanvas, type RankingPresentationRow } from './RankingCanvas';
import type { CategoryResultData } from '../../../public/types';

const standardCategory: CategoryResultData = {
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
      fireBrigadeName: 'FF First',
      groupName: 'Gr 1',
      scoreHundredths: 4000,
      primaryRun: {
        entryId: 'e1',
        attackTimeHundredths: 3500,
        attackTimeErrors: 5,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: 4000,
      },
    },
    {
      rank: 2,
      groupId: 'g2',
      fireBrigadeId: 'fb2',
      fireBrigadeName: 'FF Second',
      groupName: 'Gr 2',
      scoreHundredths: 4200,
      primaryRun: {
        entryId: 'e2',
        attackTimeHundredths: 3700,
        attackTimeErrors: 5,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: 4200,
      },
    },
  ],
  openEntries: [
    { startOrderPosition: 1, fireBrigadeName: 'FF Upcoming', groupName: 'Gr 3' },
  ],
  dnfEntries: [],
};

describe('RankingCanvas', () => {
  it('renders fallback message when activeCategory is undefined', () => {
    render(
      <RankingCanvas
        activeCategory={undefined}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        theme="broadcast"
      />
    );
    expect(screen.getByText('Keine Kategorie für TV-Anzeige aktiv')).toBeInTheDocument();
  });

  it('renders category title and ranking table with ranked and upcoming rows', () => {
    const visibleRows: RankingPresentationRow[] = [
      { kind: 'ranked', entry: standardCategory.rankedResults[0] },
      { kind: 'ranked', entry: standardCategory.rankedResults[1] },
      { kind: 'upcoming', entry: standardCategory.openEntries[0] },
    ];

    render(
      <RankingCanvas
        activeCategory={standardCategory}
        visibleRankingRows={visibleRows}
        rankingPresentationRowsCount={3}
        theme="broadcast"
      />
    );

    expect(screen.getByText('Bronze Aktiv')).toBeInTheDocument();
    expect(screen.getByText('FF First Gr 1')).toBeInTheDocument();
    expect(screen.getByText('FF Second Gr 2')).toBeInTheDocument();
    expect(screen.getByText('FF Upcoming Gr 3')).toBeInTheDocument();
  });

  it('renders empty table message when rankingPresentationRowsCount is 0', () => {
    const emptyCategory: CategoryResultData = {
      ...standardCategory,
      rankedResults: [],
      openEntries: [],
    };

    render(
      <RankingCanvas
        activeCategory={emptyCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        theme="broadcast"
      />
    );

    expect(screen.getByText('Noch keine Ergebnisse in dieser Kategorie')).toBeInTheDocument();
  });

  it('groups combined relay headers into category and discipline rows', () => {
    const combinedRelayCategory: CategoryResultData = {
      ...standardCategory,
      id: 'combined-relay',
      displayName: 'Gesamtwertung Aktiv',
      type: 'combined',
      categoryTypeName1: 'Bronze Aktiv',
      categoryTypeName2: 'Silber Aktiv',
      hasRelayRace1: true,
      hasRelayRace2: true,
      excludeRelayRace: false,
      rankedResults: [],
      openEntries: [],
    };

    render(
      <RankingCanvas
        activeCategory={combinedRelayCategory}
        visibleRankingRows={[]}
        rankingPresentationRowsCount={0}
        theme="broadcast"
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Bronze Aktiv' })).toHaveAttribute('colspan', '2');
    expect(screen.getByRole('columnheader', { name: 'Silber Aktiv' })).toHaveAttribute('colspan', '2');
    expect(screen.getAllByRole('columnheader', { name: 'ANG' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'SL' })).toHaveLength(2);
    expect(screen.getByRole('table', { name: 'Gesamtwertung Aktiv Wertung' }))
      .toHaveClass('grid-rows-[4.5rem_minmax(0,1fr)]');
  });

  it('renders — in combined total column for a Tier-2 entry with no secondary run', () => {
    const tier2Result: CategoryResultData['rankedResults'][number] = {
      rank: 3,
      groupId: 'g-tier2',
      fireBrigadeId: 'fb-tier2',
      fireBrigadeName: 'FF Einzel',
      groupName: 'Gr 99',
      scoreHundredths: null,
      primaryRun: {
        entryId: 'e-tier2',
        attackTimeHundredths: 3200,
        attackTimeErrors: 0,
        relayRaceHundredths: null,
        relayRaceErrors: null,
        scoreHundredths: 3200,
      },
      secondaryRun: null,
    };

    const combinedCategory: CategoryResultData = {
      ...standardCategory,
      id: 'gesamt-aktiv',
      displayName: 'Gesamt Aktiv',
      type: 'combined',
      categoryTypeName1: 'Bronze Aktiv',
      categoryTypeName2: 'Silber Aktiv',
      rankedResults: [tier2Result],
      openEntries: [],
    };

    const visibleRows: RankingPresentationRow[] = [
      { kind: 'ranked', entry: tier2Result },
    ];

    const { container } = render(
      <RankingCanvas
        activeCategory={combinedCategory}
        visibleRankingRows={visibleRows}
        rankingPresentationRowsCount={1}
        theme="broadcast"
      />
    );

    expect(screen.getByText('FF Einzel Gr 99')).toBeInTheDocument();
    const rankedRow = container.querySelector('tr[data-row-kind="ranked"]');
    const cells = rankedRow?.querySelectorAll('td');
    expect(cells?.[3]).toHaveTextContent('—');
    expect(cells?.[4]).toHaveTextContent('—');
  });

  it('renders — in rank cell for a DNF entry with null rank in a combined category', () => {
    const dnfResult: CategoryResultData['rankedResults'][number] = {
      rank: null,
      groupId: 'g-dnf',
      fireBrigadeId: 'fb-dnf',
      fireBrigadeName: 'FF DNF',
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
    };

    const combinedCategory: CategoryResultData = {
      ...standardCategory,
      id: 'gesamt-aktiv',
      displayName: 'Gesamt Aktiv',
      type: 'combined',
      categoryTypeName1: 'Bronze Aktiv',
      categoryTypeName2: 'Silber Aktiv',
      rankedResults: [dnfResult],
      openEntries: [],
    };

    const visibleRows: RankingPresentationRow[] = [
      { kind: 'ranked', entry: dnfResult },
    ];

    const { container } = render(
      <RankingCanvas
        activeCategory={combinedCategory}
        visibleRankingRows={visibleRows}
        rankingPresentationRowsCount={1}
        theme="broadcast"
      />
    );

    const rankedRow = container.querySelector('tr[data-row-kind="ranked"]');
    expect(rankedRow).not.toBeNull();
    const rankSpan = rankedRow?.querySelector('td:first-child span');
    expect(rankSpan).toHaveTextContent('—');
  });
});
