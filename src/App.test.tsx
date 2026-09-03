// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App';

describe('App Routing', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders AdminLayout when pathname is /admin', async () => {
    window.history.pushState({}, '', '/admin');
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/me') {
        return Promise.resolve({ ok: true, json: async () => ({ user: 'admin@feuerwehr.at' }), headers: { get: () => null } } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => [] } as unknown as Response);
    });
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1, name: /BewerbsBoard/i })[0]).toBeInTheDocument();
    });
    expect(screen.getAllByRole('tab', { name: /Erfassung/i })[0]).toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – Administration');
  });

  it('renders access denied screen when /api/admin/me returns 403', async () => {
    window.history.pushState({}, '', '/admin');
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 403,
      ok: false,
      headers: { get: () => null },
      json: async () => ({ error: 'Forbidden: admin role required' }),
    } as unknown as Response);
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: /Zugriff verweigert/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abmelden & Konto wechseln/i })).toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – Administration');
  });

  it('renders TV view when pathname is /tv', () => {
    window.history.pushState({}, '', '/tv');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    render(<App />);

    expect(screen.getByText(/Ergebnisse/i)).toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – TV Display');
  });

  it('renders TV view when pathname is /1 or /tv/1', () => {
    window.history.pushState({}, '', '/1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    render(<App />);

    expect(screen.getByText(/Ergebnisse/i)).toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – TV Display');
  });

  it('does not expose the TV prototype as a user route', async () => {
    window.history.pushState({}, '', '/tv/prototype');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        eventTitle: 'PUBLIC ROUTE EVENT',
        publicUrl: 'https://bewerb.feuerwehr.at',
        timestamp: 1723100000000,
        categories: {},
      }),
    } as Response);

    render(<App />);

    expect(await screen.findByText('PUBLIC ROUTE EVENT')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Prototype controls' })).not.toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – Live Results');
  });

  it('renders PublicScoreboard when pathname is /', async () => {
    window.history.pushState({}, '', '/');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        eventTitle: 'Feuerwehr Leistungsbewerb',
        publicUrl: 'https://bewerb.feuerwehr.at',
        timestamp: 1723100000000,
        categories: {},
      }),
    } as Response);

    render(<App />);

    expect(await screen.findByText(/Feuerwehr Leistungsbewerb/i)).toBeInTheDocument();
    expect(document.title).toBe('BewerbsBoard – Live Results');
  });
});
