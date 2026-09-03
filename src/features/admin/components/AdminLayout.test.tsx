// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AdminLayout } from './AdminLayout';
import { ADMIN_TABS } from './admin-tabs';

describe('AdminLayout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: 'admin@feuerwehr.at' }),
    } as Response);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders admin layout header and user information', () => {
    render(<AdminLayout userEmail="admin@test.com" />);

    expect(screen.getAllByRole('heading', { level: 1, name: /BewerbsBoard/i })[0]).toBeInTheDocument();
    expect(screen.getAllByText('admin@test.com')[0]).toBeInTheDocument();
  });

  it('renders all 6 navigation tabs', () => {
    render(<AdminLayout />);

    ADMIN_TABS.forEach((tab) => {
      expect(screen.getAllByRole('tab', { name: new RegExp(tab.label, 'i') })[0]).toBeInTheDocument();
    });
  });

  it('highlights the default active tab (Participants & Groups)', () => {
    render(<AdminLayout defaultTab="participants" />);

    const activeTabButton = screen.getAllByRole('tab', { name: /Teilnehmer/i })[0];
    expect(activeTabButton).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Teilnehmer Modul/i)).toBeInTheDocument();
  });

  it('switches tabs on click', () => {
    const onTabChange = vi.fn();
    render(<AdminLayout onTabChange={onTabChange} />);

    const broadcastTab = screen.getAllByRole('tab', { name: /TV-Steuerung/i })[0];
    fireEvent.click(broadcastTab);

    expect(onTabChange).toHaveBeenCalledWith('broadcast');
  });

  it('renders custom content for active tab when children or tab slot provided', () => {
    render(
      <AdminLayout defaultTab="results">
        {(activeTab) => <div data-testid="custom-slot">Active tab is {activeTab}</div>}
      </AdminLayout>
    );

    expect(screen.getByTestId('custom-slot')).toHaveTextContent('Active tab is results');
  });

  it('allows clicking and switching to the Settings tab', () => {
    const onTabChange = vi.fn();
    render(<AdminLayout onTabChange={onTabChange} />);

    const settingsTab = screen.getAllByRole('tab', { name: /Einstellungen/i })[0];
    expect(settingsTab).toBeInTheDocument();

    fireEvent.click(settingsTab);

    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('fetches authenticated user from /api/admin/me when userEmail prop is not provided', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: 'keycloak-user@feuerwehr.at' }),
    } as Response);

    try {
      render(<AdminLayout />);
      await waitFor(() => {
        expect(screen.getAllByText('keycloak-user@feuerwehr.at')[0]).toBeInTheDocument();
      });
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/me');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to admin@feuerwehr.at when fetch fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      render(<AdminLayout />);
      await waitFor(() => {
        expect(screen.getAllByText('admin@feuerwehr.at')[0]).toBeInTheDocument();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renders Abmelden button and triggers logout in local auth mode', async () => {
    const originalFetch = globalThis.fetch;
    const onLogout = vi.fn();
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/admin/me') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ user: 'admin@test.com', authMode: 'local', logoutUrl: '/local-auth/logout' }),
        } as Response);
      }
      if (url === '/local-auth/logout') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) } as Response);
      }
      return Promise.resolve({ ok: true } as Response);
    });

    try {
      render(<AdminLayout onLogout={onLogout} />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /abmelden/i })[0]).toBeInTheDocument();
      });
      const logoutBtn = screen.getAllByRole('button', { name: /abmelden/i })[0];

      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/local-auth/logout', { method: 'POST' });
        expect(onLogout).toHaveBeenCalled();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
