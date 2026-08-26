// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LogoSection } from './LogoSection';

describe('LogoSection Component', () => {
  const mockOnChange = vi.fn();
  const mockOnSyncSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/public/logo') {
        return { ok: false, status: 404 } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all bundled preset options and custom logo option', () => {
    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    expect(screen.getByRole('radio', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alternative 1' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alternative 2' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alternative 3' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Eigenes Logo' })).toBeInTheDocument();
  });

  it('marks the correct preset as selected based on logoOverride', () => {
    const { rerender } = render(
      <LogoSection
        logoOverride="/logo-options/logo_alt_1.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    expect(screen.getByRole('radio', { name: 'Alternative 1' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Standard' })).not.toBeChecked();

    rerender(
      <LogoSection
        logoOverride="/logo-options/logo_alt_2.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );
    expect(screen.getByRole('radio', { name: 'Alternative 2' })).toBeChecked();

    rerender(
      <LogoSection
        logoOverride="/logo-options/logo_alt_3.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );
    expect(screen.getByRole('radio', { name: 'Alternative 3' })).toBeChecked();

    rerender(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();

    rerender(
      <LogoSection
        logoOverride="/api/public/logo?v=123"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );
    expect(screen.getByRole('radio', { name: 'Eigenes Logo' })).toBeChecked();
  });

  it('calls onChangeLogoOverride with appropriate paths when clicking preset cards', () => {
    const { rerender } = render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Alternative 1' }));
    expect(mockOnChange).toHaveBeenCalledWith('/logo-options/logo_alt_1.png');

    rerender(
      <LogoSection
        logoOverride="/logo-options/logo_alt_1.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Alternative 2' }));
    expect(mockOnChange).toHaveBeenCalledWith('/logo-options/logo_alt_2.png');

    rerender(
      <LogoSection
        logoOverride="/logo-options/logo_alt_2.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Alternative 3' }));
    expect(mockOnChange).toHaveBeenCalledWith('/logo-options/logo_alt_3.png');

    rerender(
      <LogoSection
        logoOverride="/logo-options/logo_alt_3.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Standard' }));
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('uploads a file successfully and updates active logo override', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/public/logo') return { ok: false, status: 404 } as Response;
      if (url === '/api/admin/logo/upload' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true, logoUrl: '/api/public/logo?v=1700000000000' }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    const file = new File(['fake-png-data'], 'custom-logo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Eigenes Logo hochladen');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/logo/upload', expect.any(Object));
      expect(mockOnChange).toHaveBeenCalledWith('/api/public/logo?v=1700000000000');
      expect(mockOnSyncSaved).toHaveBeenCalledWith('/api/public/logo?v=1700000000000');
      expect(screen.getByText('Logo erfolgreich hochgeladen und aktiviert!')).toBeInTheDocument();
    });
  });

  it('rejects files larger than 2MB with an error message', async () => {
    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    // Create a 2.5MB file
    const largeFile = new File(['a'.repeat(2.5 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 2.5 * 1024 * 1024 });

    const fileInput = screen.getByLabelText('Eigenes Logo hochladen');
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/überschreitet die maximale Dateigröße von 2 MB/i)).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  it('rejects unsupported file extensions or mime types', async () => {
    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText('Eigenes Logo hochladen');
    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Nicht unterstützter Dateityp/i)).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  it('fetches remote URL and updates logo override on success', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/public/logo') return { ok: false, status: 404 } as Response;
      if (url === '/api/admin/logo/fetch-url' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true, logoUrl: '/api/public/logo?v=999999' }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    // Switch to URL tab
    const urlTabBtn = screen.getByRole('button', { name: /Von URL abrufen/i });
    fireEvent.click(urlTabBtn);

    const urlInput = screen.getByPlaceholderText('https://beispiel.feuerwehr.at/wappen.png');
    fireEvent.change(urlInput, { target: { value: 'https://feuerwehr.at/wappen.svg' } });

    const fetchBtn = screen.getByRole('button', { name: /Herunterladen & Speichern/i });
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/logo/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://feuerwehr.at/wappen.svg' }),
      });
      expect(mockOnChange).toHaveBeenCalledWith('/api/public/logo?v=999999');
      expect(mockOnSyncSaved).toHaveBeenCalledWith('/api/public/logo?v=999999');
      expect(screen.getByText(/Logo erfolgreich von URL heruntergeladen/i)).toBeInTheDocument();
    });
  });

  it('displays error when remote URL fetch fails', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/public/logo') return { ok: false, status: 404 } as Response;
      if (url === '/api/admin/logo/fetch-url' && init?.method === 'POST') {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: 'Fehler beim Abrufen der URL: HTTP 404' }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <LogoSection
        logoOverride=""
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    const urlTabBtn = screen.getByRole('button', { name: /Von URL abrufen/i });
    fireEvent.click(urlTabBtn);

    const urlInput = screen.getByPlaceholderText('https://beispiel.feuerwehr.at/wappen.png');
    fireEvent.change(urlInput, { target: { value: 'https://feuerwehr.at/missing.png' } });

    const fetchBtn = screen.getByRole('button', { name: /Herunterladen & Speichern/i });
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Abrufen der URL: HTTP 404')).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  it('deletes stored custom logo and resets logo override', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/public/logo') {
        return { ok: true, status: 200 } as Response;
      }
      if (url === '/api/admin/logo' && init?.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    render(
      <LogoSection
        logoOverride="/api/public/logo?v=12345"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Gespeichertes eigenes Logo')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /Eigenes Logo löschen/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/logo', { method: 'DELETE' });
      expect(mockOnChange).toHaveBeenCalledWith('');
      expect(mockOnSyncSaved).toHaveBeenCalledWith('');
      expect(screen.getByText(/Gespeichertes Logo wurde entfernt/i)).toBeInTheDocument();
    });
  });

  it('allows manual entry of custom path or URL in the text input', () => {
    render(
      <LogoSection
        logoOverride="/logo.png"
        onChangeLogoOverride={mockOnChange}
        onSyncSavedLogoOverride={mockOnSyncSaved}
      />
    );

    const manualInput = screen.getByLabelText('Alternativ-Logo');
    fireEvent.change(manualInput, { target: { value: '/branding/custom-event.svg' } });

    expect(mockOnChange).toHaveBeenCalledWith('/branding/custom-event.svg');
  });
});
