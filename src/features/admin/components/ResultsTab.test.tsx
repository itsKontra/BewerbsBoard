// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ResultsTab } from './ResultsTab';
import { formatHundredthsToGerman } from '../../../../shared/utils/time-parser';

const mockEntries = [
  {
    id: 'entry-1',
    groupId: 'group-1',
    categoryTypeId: 'bronze-aktiv',
    categoryTypeName: 'Bronze Aktiv',
    hasRelayRace: false,
    runStatus: 'OPEN',
    startOrderPosition: 1,
    scoreHundredths: null,
    errors: null,
    attackTimeHundredths: null,
    groupName: 'Gruppe 1',
    competitionClass: 'AKTIV',
    fireBrigadeId: 'fb-1',
    fireBrigadeName: 'FF Musterstadt',
  },
  {
    id: 'entry-2',
    groupId: 'group-2',
    categoryTypeId: 'bronze-aktiv',
    categoryTypeName: 'Bronze Aktiv',
    hasRelayRace: false,
    runStatus: 'VALID',
    startOrderPosition: null,
    scoreHundredths: 4238,
    errors: 0,
    attackTimeHundredths: 4238,
    groupName: 'Gruppe 2',
    competitionClass: 'AKTIV',
    fireBrigadeId: 'fb-2',
    fireBrigadeName: 'FF Altdorf',
  },
];

describe('ResultsTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/category-entries') {
        return Promise.resolve({
          ok: true,
          json: async () => mockEntries,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ message: 'Success' }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('formats hundredths to German decimal representation', () => {
    expect(formatHundredthsToGerman(4238)).toBe('42,38');
    expect(formatHundredthsToGerman(4200)).toBe('42,00');
    expect(formatHundredthsToGerman(null)).toBe('');
    expect(formatHundredthsToGerman(undefined)).toBe('');
  });

  it('renders ResultsTab and fetches entries', async () => {
    render(<ResultsTab />);

    expect(screen.getByText('Lade Zeiterfassung...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('open-entry-row-entry-1')).toBeInTheDocument();
      expect(screen.getByTestId('valid-entry-row-entry-2')).toBeInTheDocument();
    });

    expect(screen.getByText('Aktive Startreihenfolge (Offene Läufe)')).toBeInTheDocument();
    expect(screen.getByText('Gültige Wertungen & Rangliste')).toBeInTheDocument();
  });

  it('allows entering attack time and error count for an open entry and saving', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('open-entry-row-entry-1')).toBeInTheDocument();
    });

    const timeInput = screen.getByPlaceholderText('60,00');
    const errorsInput = screen.getByPlaceholderText('0');
    const saveButton = screen.getByRole('button', { name: 'Speichern' });

    fireEvent.change(timeInput, { target: { value: '42,38' } });
    fireEvent.change(errorsInput, { target: { value: '0' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/category-entries/entry-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ attackTimeStr: '42,38', errors: 0 }),
        })
      );
    });
  });

  it('triggers revert to OPEN for a VALID entry', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('valid-entry-row-entry-2')).toBeInTheDocument();
    });

    const revertButton = screen.getByTestId('valid-entry-row-entry-2').querySelector('#revert-btn-entry-2')!;
    fireEvent.click(revertButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/admin/category-entries/entry-2',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ runStatus: 'OPEN' }),
        })
      );
    });
  });

  it('renders open entries with DNF button before Speichern button', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('open-entry-row-entry-1')).toBeInTheDocument();
    });

    const openRow = screen.getByTestId('open-entry-row-entry-1');
    const buttons = openRow.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('DNF');
    expect(buttons[1]).toHaveTextContent('Speichern');
  });

  it('renders valid entries with only Zurücknehmen button and clean rank badge', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('valid-entry-row-entry-2')).toBeInTheDocument();
    });

    const validRow = screen.getByTestId('valid-entry-row-entry-2');
    const buttons = validRow.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Zurücknehmen');
    expect(validRow.querySelector('#dnf-btn-entry-2')).not.toBeInTheDocument();

    // Verify clean rank text
    expect(validRow).toHaveTextContent('1.');
  });

  it('renders Save button in ghost/outline style by default and transitions to solid green when dirty', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('open-entry-row-entry-1')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: 'Speichern' });
    // Default/Clean State: ghost/outline style
    expect(saveButton).toHaveClass('bg-white');
    expect(saveButton).toHaveClass('text-emerald-700');
    expect(saveButton).toHaveClass('border-emerald-600');
    expect(saveButton).not.toHaveClass('bg-emerald-600');

    // Dirty state: modify attack time input
    const timeInput = screen.getByPlaceholderText('60,00');
    fireEvent.change(timeInput, { target: { value: '45,12' } });

    // Transition to solid green
    expect(saveButton).toHaveClass('bg-emerald-600');
    expect(saveButton).toHaveClass('text-white');

    // Save action
    fireEvent.click(saveButton);

    // Reverts to ghost state after saving
    await waitFor(() => {
      expect(saveButton).toHaveClass('bg-white');
      expect(saveButton).toHaveClass('text-emerald-700');
    });
  });

  it('renders quick counters with high-contrast color classes', async () => {
    render(<ResultsTab />);

    await waitFor(() => {
      expect(screen.getByText(/1 Offen/i)).toBeInTheDocument();
    });

    const openBadge = screen.getByText(/1 Offen/i);
    const validBadge = screen.getByText(/1 Gültig/i);
    const dnfBadge = screen.getByText(/0 DNF/i);

    expect(openBadge).toHaveClass('text-blue-900');
    expect(validBadge).toHaveClass('text-emerald-900');
    expect(dnfBadge).toHaveClass('text-red-900');
  });
});

