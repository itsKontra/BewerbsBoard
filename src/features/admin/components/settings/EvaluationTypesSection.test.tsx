// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EvaluationTypesSection } from './EvaluationTypesSection';
import type { CategoryType, EvaluationType } from '../SetupTab';

describe('EvaluationTypesSection', () => {
  const mockCategoryTypes: CategoryType[] = [
    { id: 'cat-1', name: 'Bronze Aktiv', competitionClassId: 'cc-1', hasRelayRace: true },
    { id: 'cat-2', name: 'Silber Aktiv', competitionClassId: 'cc-1', hasRelayRace: true },
    { id: 'cat-3', name: 'Bronze Jugend', competitionClassId: 'cc-2', hasRelayRace: false },
  ];

  const mockEvaluationTypes: EvaluationType[] = [
    {
      id: 'eval-1',
      name: 'Bronze Aktiv Wertung',
      categoryTypeId1: 'cat-1',
      categoryTypeName1: 'Bronze Aktiv',
      hasRelayRace1: true,
      categoryTypeId2: null,
      categoryTypeName2: null,
      hasRelayRace2: false,
      excludeRelayRace: false,
      isBrigadePairing: false,
      showSingleResults: false,
      public: true,
      publicTv: true,
      displayDurationSeconds: 10,
      order: 1,
    },
    {
      id: 'eval-2',
      name: 'Gesamtwertung Wehr',
      categoryTypeId1: 'cat-1',
      categoryTypeName1: 'Bronze Aktiv',
      hasRelayRace1: true,
      categoryTypeId2: 'cat-3',
      categoryTypeName2: 'Bronze Jugend',
      hasRelayRace2: false,
      excludeRelayRace: false,
      isBrigadePairing: true,
      showSingleResults: true,
      public: true,
      publicTv: false,
      displayDurationSeconds: 15,
      order: 2,
    },
  ];

  const mockOnUpdate = vi.fn().mockResolvedValue(undefined);
  const mockOnRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without public and public tv checkboxes in the creation form', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    // Assert that the creation form does not contain public and public tv checkboxes
    expect(screen.queryByLabelText(/Öffentlich Web/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/TV Rotation/i)).not.toBeInTheDocument();
    expect(document.getElementById('newEvaluationPublic')).toBeNull();
    expect(document.getElementById('newEvaluationPublicTv')).toBeNull();

    // But the table rows for existing evaluations still have visibility controls
    expect(screen.getByLabelText('Web-Sichtbarkeit für Bronze Aktiv Wertung')).toBeInTheDocument();
    expect(screen.getByLabelText('TV-Sichtbarkeit für Bronze Aktiv Wertung')).toBeInTheDocument();
  });

  it('disables isBrigadePairing option when Category 2 is not set', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const brigadeCheckbox = screen.getByLabelText(/Wehr-Paarung/i) as HTMLInputElement;
    expect(brigadeCheckbox).toBeInTheDocument();
    expect(brigadeCheckbox.disabled).toBe(true);
    expect(brigadeCheckbox.checked).toBe(false);
  });

  it('auto-forces and locks isBrigadePairing when Category 2 is from a different Wertungsklasse (cross-class)', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const cat2Select = screen.getByLabelText(/Kategorie 2/i) as HTMLSelectElement;
    const brigadeCheckbox = screen.getByLabelText(/Wehr-Paarung/i) as HTMLInputElement;

    // Select cat-3 which is cc-2 (different from cat-1's cc-1) → cross-class
    fireEvent.change(cat2Select, { target: { value: 'cat-3' } });
    // Checkbox must be disabled (locked) AND checked (auto-forced)
    expect(brigadeCheckbox.disabled).toBe(true);
    expect(brigadeCheckbox.checked).toBe(true);

    // Badge should appear
    expect(screen.getByText(/Pflichtfeld/i)).toBeInTheDocument();

    // Deselect category 2 → back to optional
    fireEvent.change(cat2Select, { target: { value: '' } });
    expect(brigadeCheckbox.disabled).toBe(true); // disabled again (no cat2)
    expect(brigadeCheckbox.checked).toBe(false);
  });

  it('keeps isBrigadePairing optional when Category 1 and 2 share the same Wertungsklasse', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const cat2Select = screen.getByLabelText(/Kategorie 2/i) as HTMLSelectElement;
    const brigadeCheckbox = screen.getByLabelText(/Wehr-Paarung/i) as HTMLInputElement;

    // Select cat-2 which is also cc-1 (same class as cat-1) → not cross-class
    fireEvent.change(cat2Select, { target: { value: 'cat-2' } });
    expect(brigadeCheckbox.disabled).toBe(false);
    expect(brigadeCheckbox.checked).toBe(false);

    // Can manually check
    fireEvent.click(brigadeCheckbox);
    expect(brigadeCheckbox.checked).toBe(true);
  });

  it('submits evaluation creation with isBrigadePairing only when Category 2 is set', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'eval-3',
        name: 'Neue Paarung',
        categoryTypeId1: 'cat-1',
        categoryTypeId2: 'cat-3',
        isBrigadePairing: true,
        public: true,
        publicTv: true,
      }),
    } as any);

    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const nameInput = screen.getByLabelText(/Wertungsname \*/i);
    const cat2Select = screen.getByLabelText(/Kategorie 2/i);
    const brigadeCheckbox = screen.getByLabelText(/Wehr-Paarung/i);
    const submitBtn = screen.getByRole('button', { name: /\+ Wertung anlegen/i });

    fireEvent.change(nameInput, { target: { value: 'Neue Paarung' } });
    fireEvent.change(cat2Select, { target: { value: 'cat-3' } });
    fireEvent.click(brigadeCheckbox);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/evaluation-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Neue Paarung',
          categoryTypeId1: 'cat-1',
          categoryTypeId2: 'cat-3',
          excludeRelayRace: false,
          isBrigadePairing: true,
          showSingleResults: false,
          public: true,
          publicTv: true,
          displayDurationSeconds: 10,
          order: 3,
        }),
      });
    });

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('disables Einzelergebnisse checkbox when Category 2 is not set', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const checkbox = document.getElementById('newEvaluationShowSingleResults') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
  });

  it('enables and resets Einzelergebnisse checkbox based on Category 2 selection', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const cat2Select = screen.getByLabelText(/Kategorie 2/i) as HTMLSelectElement;
    const checkbox = document.getElementById('newEvaluationShowSingleResults') as HTMLInputElement;

    // Select cat-2 (same class) → enabled
    fireEvent.change(cat2Select, { target: { value: 'cat-2' } });
    expect(checkbox.disabled).toBe(false);

    // Check it
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Clear Category 2 → disabled again and unchecked
    fireEvent.change(cat2Select, { target: { value: '' } });
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
  });

  it('submits showSingleResults=true in payload when checkbox is checked', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'eval-4',
        name: 'Kombiwertung Einzelresultate',
        categoryTypeId1: 'cat-1',
        categoryTypeId2: 'cat-2',
        isBrigadePairing: false,
        showSingleResults: true,
        public: true,
        publicTv: true,
      }),
    } as any);

    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    const nameInput = screen.getByLabelText(/Wertungsname \*/i);
    const cat2Select = screen.getByLabelText(/Kategorie 2/i);
    const showSingleCheckbox = document.getElementById('newEvaluationShowSingleResults') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /\+ Wertung anlegen/i });

    fireEvent.change(nameInput, { target: { value: 'Kombiwertung Einzelresultate' } });
    fireEvent.change(cat2Select, { target: { value: 'cat-2' } });
    fireEvent.click(showSingleCheckbox);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/evaluation-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Kombiwertung Einzelresultate',
          categoryTypeId1: 'cat-1',
          categoryTypeId2: 'cat-2',
          excludeRelayRace: false,
          isBrigadePairing: false,
          showSingleResults: true,
          public: true,
          publicTv: true,
          displayDurationSeconds: 10,
          order: 3,
        }),
      });
    });
  });

  it('shows Einzelergebnisse badge in composition column for evaluations with showSingleResults=true', () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    // eval-2 has showSingleResults: true and categoryTypeId2 set → badge shown
    expect(screen.getAllByText('Einzelergebnisse').length).toBeGreaterThan(0);

    // eval-1 has showSingleResults: false → badge NOT shown for that row
    // Badge count should equal exactly 1 (only eval-2)
    expect(screen.getAllByText('Einzelergebnisse')).toHaveLength(1);
  });

  it('enables Show Single Results while editing an existing combined evaluation', async () => {
    const combinedEvaluation = { ...mockEvaluationTypes[1], showSingleResults: false };
    render(
      <EvaluationTypesSection
        evaluationTypes={[combinedEvaluation]}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByLabelText('Wertung Gesamtwertung Wehr bearbeiten'));

    const checkbox = screen.getByLabelText('Einzelergebnisse für Gesamtwertung Wehr') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByTitle('Speichern'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith('eval-2', expect.objectContaining({
        categoryTypeId2: 'cat-3',
        showSingleResults: true,
      }));
    });
  });

  it('disables Show Single Results while editing an existing combined evaluation', async () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByLabelText('Wertung Gesamtwertung Wehr bearbeiten'));

    const checkbox = screen.getByLabelText('Einzelergebnisse für Gesamtwertung Wehr') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByTitle('Speichern'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith('eval-2', expect.objectContaining({
        showSingleResults: false,
      }));
    });
  });

  it('clearing the second discipline resets Show Single Results before saving an edit', async () => {
    render(
      <EvaluationTypesSection
        evaluationTypes={mockEvaluationTypes}
        categoryTypes={mockCategoryTypes}
        onUpdateEvaluationType={mockOnUpdate}
        onRefresh={mockOnRefresh}
      />
    );

    fireEvent.click(screen.getByLabelText('Wertung Gesamtwertung Wehr bearbeiten'));

    const category2 = screen.getByLabelText('Kategorie 2 für Gesamtwertung Wehr') as HTMLSelectElement;
    const checkbox = screen.getByLabelText('Einzelergebnisse für Gesamtwertung Wehr') as HTMLInputElement;
    fireEvent.change(category2, { target: { value: '' } });

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByTitle('Speichern'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith('eval-2', expect.objectContaining({
        categoryTypeId2: null,
        showSingleResults: false,
      }));
    });
  });
});
