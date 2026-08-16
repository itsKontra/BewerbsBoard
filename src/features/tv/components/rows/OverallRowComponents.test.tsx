// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OverallRankingRow } from './OverallRankingRow';

describe('OverallRankingRow component', () => {
  it('renders ranked combined row with score1Hundredths, score2Hundredths, and totalScoreHundredths correctly', () => {
    const { container } = render(
      <table>
        <tbody>
          <OverallRankingRow
            rank={1}
            fireBrigadeName="FF Musterstadt"
            groupName="1"
            score1Hundredths={3160}
            score2Hundredths={4483}
            totalScoreHundredths={7643}
            theme="broadcast"
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('FF Musterstadt 1')).toBeInTheDocument();
    expect(container).toHaveTextContent('31,60 s');
    expect(container).toHaveTextContent('44,83 s');
    expect(container).toHaveTextContent('76,43 s');
  });

  it('renders upcoming combined row correctly', () => {
    const { container } = render(
      <table>
        <tbody>
          <OverallRankingRow
            rank={null}
            fireBrigadeName="FF Next"
            groupName="1"
            isUpcoming
            theme="broadcast"
          />
        </tbody>
      </table>
    );

    const tr = container.querySelector('tr');
    expect(tr).toHaveAttribute('data-row-kind', 'upcoming');
    expect(screen.getByText('FF Next 1')).toBeInTheDocument();
  });

  it('renders brigade pairing group names in their contribution columns', () => {
    render(
      <table>
        <tbody>
          <OverallRankingRow
            rank={1}
            fireBrigadeName="FF Paarung"
            groupName="1"
            secondaryGroupName="Jugend 1"
            isBrigadePairing
            score1Hundredths={3660}
            attackTimeHundredths1={3160}
            score2Hundredths={4483}
            attackTimeHundredths2={4483}
            totalScoreHundredths={8143}
            theme="broadcast"
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('FF Paarung')).toBeInTheDocument();
    expect(screen.queryByText('FF Paarung 1')).not.toBeInTheDocument();
    expect(screen.getByText('Gruppe 1')).toBeInTheDocument();
    expect(screen.getByText('Gruppe Jugend 1')).toBeInTheDocument();
    expect(screen.getByText('+5,00')).toBeInTheDocument();
  });
});
