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
          public: true,
          publicTv: true,
          displayDurationSeconds: 10,
          order: 3,
        }),
      });
    });

    expect(mockOnRefresh).toHaveBeenCalled();
  });
});
