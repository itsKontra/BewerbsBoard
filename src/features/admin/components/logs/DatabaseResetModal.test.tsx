// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DatabaseResetModal } from './DatabaseResetModal';

describe('DatabaseResetModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  const getScopeCheckboxes = (container: HTMLElement) => ({
    entries: container.querySelector<HTMLInputElement>('input[name="scope-category-entries"]')!,
    groups: container.querySelector<HTMLInputElement>('input[name="scope-groups"]')!,
    brigades: container.querySelector<HTMLInputElement>('input[name="scope-fire-brigades"]')!,
    evals: container.querySelector<HTMLInputElement>('input[name="scope-evaluation-types"]')!,
    cats: container.querySelector<HTMLInputElement>('input[name="scope-category-types"]')!,
  });

  it('renders correctly when open and displays all 5 scopes in hierarchy', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Datenbank zurücksetzen')).toBeInTheDocument();
    
    const checkboxes = getScopeCheckboxes(container);
    expect(checkboxes.entries).toBeInTheDocument();
    expect(checkboxes.groups).toBeInTheDocument();
    expect(checkboxes.brigades).toBeInTheDocument();
    expect(checkboxes.evals).toBeInTheDocument();
    expect(checkboxes.cats).toBeInTheDocument();

    // Default selection: entries, groups, brigades are checked
    expect(checkboxes.entries).toBeChecked();
    expect(checkboxes.groups).toBeChecked();
    expect(checkboxes.brigades).toBeChecked();
    expect(checkboxes.evals).not.toBeChecked();
    expect(checkboxes.cats).not.toBeChecked();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('cascades unchecking parent (Zeiteinträge) to uncheck all dependent children', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const checkboxes = getScopeCheckboxes(container);
    expect(checkboxes.groups).toBeChecked();
    expect(checkboxes.brigades).toBeChecked();

    // Uncheck Zeiteinträge
    fireEvent.click(checkboxes.entries);

    expect(checkboxes.entries).not.toBeChecked();
    expect(checkboxes.groups).not.toBeChecked();
    expect(checkboxes.brigades).not.toBeChecked();

    // Warning should appear that at least one scope is needed
    expect(screen.getByText(/mindestens einen Bereich zum Löschen/i)).toBeInTheDocument();
  });

  it('cascades checking child (Bewerbskategorien) to automatically check parent scopes', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const checkboxes = getScopeCheckboxes(container);
    expect(checkboxes.evals).not.toBeChecked();
    expect(checkboxes.cats).not.toBeChecked();

    // Check Bewerbskategorien
    fireEvent.click(checkboxes.cats);

    expect(checkboxes.cats).toBeChecked();
    expect(checkboxes.evals).toBeChecked();
    expect(checkboxes.entries).toBeChecked();
  });

  it('cascades checking Feuerwehren to check Gruppen and Zeiteinträge', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const checkboxes = getScopeCheckboxes(container);

    // Uncheck Zeiteinträge to clear everything
    fireEvent.click(checkboxes.entries);
    expect(checkboxes.entries).not.toBeChecked();
    expect(checkboxes.groups).not.toBeChecked();
    expect(checkboxes.brigades).not.toBeChecked();

    // Check Feuerwehren -> should auto-check groups and entries
    fireEvent.click(checkboxes.brigades);
    expect(checkboxes.brigades).toBeChecked();
    expect(checkboxes.groups).toBeChecked();
    expect(checkboxes.entries).toBeChecked();
  });

  it('disables submit button until keyword is typed and at least one scope is selected', () => {
    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Ausgewählte Daten löschen/i });
    const input = screen.getByPlaceholderText('LÖSCHEN');

    expect(submitBtn).toBeDisabled();

    // Type incorrect keyword
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(submitBtn).toBeDisabled();

    // Type correct keyword
    fireEvent.change(input, { target: { value: 'LÖSCHEN' } });
    expect(submitBtn).toBeEnabled();

    // If all scopes unchecked, should be disabled even with correct keyword
    const checkboxes = getScopeCheckboxes(container);
    fireEvent.click(checkboxes.entries); // unchecks all
    expect(submitBtn).toBeDisabled();
  });

  it('submits request with selected scopes and handles success', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Datenbank erfolgreich zurückgesetzt', summary: {} }),
    });

    const { container } = render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Uncheck groups (which also unchecks brigades) -> only categoryEntries selected
    const checkboxes = getScopeCheckboxes(container);
    fireEvent.click(checkboxes.groups);

    const input = screen.getByPlaceholderText('LÖSCHEN');
    fireEvent.change(input, { target: { value: 'LÖSCHEN' } });

    const submitBtn = screen.getByRole('button', { name: /Ausgewählte Daten löschen/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationKeyword: 'LÖSCHEN',
          scopes: {
            categoryEntries: true,
            groups: false,
            fireBrigades: false,
            evaluationTypes: false,
            categoryTypes: false,
          },
        }),
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('Datenbank erfolgreich zurückgesetzt');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('displays error message when API call fails', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Serverfehler beim Zurücksetzen' }),
    });

    render(
      <DatabaseResetModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const input = screen.getByPlaceholderText('LÖSCHEN');
    fireEvent.change(input, { target: { value: 'LÖSCHEN' } });

    const submitBtn = screen.getByRole('button', { name: /Ausgewählte Daten löschen/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Serverfehler beim Zurücksetzen')).toBeInTheDocument();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
