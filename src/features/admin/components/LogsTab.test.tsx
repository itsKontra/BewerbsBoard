// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LogsTab } from './LogsTab';

describe('LogsTab Component', () => {
  const mockLogs = [
    {
      id: 'log-101',
      timestamp: 1700000000000,
      user: 'admin@feuerwehr.at',
      action: 'UPDATE',
      details: JSON.stringify({
        previous_value: { score: 100 },
        new_value: { score: 95 },
      }),
    },
    {
      id: 'log-102',
      timestamp: 1700000500000,
      user: 'referee@feuerwehr.at',
      action: 'DATABASE_CLEAR',
      details: JSON.stringify({ summary: { fireBrigadesCount: 5 } }),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          logs: mockLogs,
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      }))
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('renders audit logs list correctly after fetching', async () => {
    render(<LogsTab />);

    await waitFor(() => {
      expect(screen.getByText('admin@feuerwehr.at')).toBeInTheDocument();
      expect(screen.getByText('referee@feuerwehr.at')).toBeInTheDocument();
      expect(screen.getByText('DATABASE_CLEAR')).toBeInTheDocument();
    });
  });

  it('filters audit logs when user types in search input', async () => {
    render(<LogsTab />);

    await waitFor(() => {
      expect(screen.getByText('admin@feuerwehr.at')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Audit-Protokoll durchsuchen/i);
    fireEvent.change(searchInput, { target: { value: 'referee' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=referee'));
    });
  });

  it('opens diff inspection modal when clicking "Diff / Details"', async () => {
    render(<LogsTab />);

    await waitFor(() => {
      expect(screen.getByText('admin@feuerwehr.at')).toBeInTheDocument();
    });

    const diffButtons = screen.getAllByText(/Diff \/ Details/i);
    fireEvent.click(diffButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Audit-Details Inspektor/i)).toBeInTheDocument();
      expect(screen.getByText(/🔻 VORHER/i)).toBeInTheDocument();
      expect(screen.getByText(/🔺 NACHHER/i)).toBeInTheDocument();
    });
  });
});
