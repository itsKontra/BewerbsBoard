import { describe, it, expect } from 'vitest';
import { resolveCategoryShape } from './category-shape';
import type { CategoryResultData } from '../../public/types';

describe('resolveCategoryShape', () => {
  it('returns standard category shape when category is undefined or null', () => {
    const shape = resolveCategoryShape(undefined);
    expect(shape.kind).toBe('standard');
    expect(shape.gridColumns).toBe('grid-cols-[6%_minmax(0,1fr)_24%]');
    expect(shape.colSpan).toBe(3);
    expect(shape.isCombinedCategory).toBe(false);
    expect(shape.headers).toHaveLength(3);
    expect(shape.headers[2].label).toBe('Zeit');
  });

  it('returns standard category shape for standard category without relay', () => {
    const category: CategoryResultData = {
      id: 'cat-eval-1',
      displayName: 'Bronze Aktiv',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      hasRelayRace1: false,
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };
    const shape = resolveCategoryShape(category);
    expect(shape.kind).toBe('standard');
    expect(shape.gridColumns).toBe('grid-cols-[6%_minmax(0,1fr)_24%]');
    expect(shape.colSpan).toBe(3);
    expect(shape.isCombinedCategory).toBe(false);
  });

  it('returns single-relay shape for single category with relay race enabled (2x2 layout)', () => {
    const category: CategoryResultData = {
      id: 'cat-eval-2',
      displayName: 'Bronze Aktiv mit Staffel',
      publicEnabled: true,
      order: 1,
      type: 'standard',
      hasRelayRace1: true,
      excludeRelayRace: false,
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };
    const shape = resolveCategoryShape(category);
    expect(shape.kind).toBe('single-relay');
    expect(shape.gridColumns).toBe('grid-cols-[6%_minmax(0,1fr)_18%_18%_20%]');
    expect(shape.colSpan).toBe(5);
    expect(shape.isCombinedCategory).toBe(false);
    expect(shape.headers).toHaveLength(5);
    expect(shape.headers[2].label).toBe('Angriff');
    expect(shape.headers[3].label).toBe('Staffellauf');
    expect(shape.headers[4].label).toBe('Gesamt');
  });

  it('returns combined-relay shape for combined category with relay race (4x2 layout)', () => {
    const category: CategoryResultData = {
      id: 'cat-eval-3',
      displayName: 'Gesamt Aktiv (Staffel)',
      publicEnabled: true,
      order: 2,
      type: 'combined',
      hasRelayRace1: true,
      hasRelayRace2: true,
      excludeRelayRace: false,
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silber',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };
    const shape = resolveCategoryShape(category);
    expect(shape.kind).toBe('combined-relay');
    expect(shape.gridColumns).toBe('grid-cols-[5%_minmax(0,1fr)_14%_14%_14%_14%_17%]');
    expect(shape.colSpan).toBe(7);
    expect(shape.isCombinedCategory).toBe(true);
    expect(shape.headers).toHaveLength(7);
    expect(shape.headers[2]).toMatchObject({ label: 'ANG', groupLabel: 'Bronze' });
    expect(shape.headers[3]).toMatchObject({ label: 'SL', groupLabel: 'Bronze' });
    expect(shape.headers[4]).toMatchObject({ label: 'ANG', groupLabel: 'Silber' });
    expect(shape.headers[5]).toMatchObject({ label: 'SL', groupLabel: 'Silber' });
    expect(shape.headers[6].label).toBe('Gesamt');
  });

  it('returns combined category shape with dynamic column names for combined categories without relay', () => {
    const category: CategoryResultData = {
      id: 'cat-eval-4',
      displayName: 'Gesamtwertung Aktiv',
      publicEnabled: true,
      order: 2,
      type: 'combined',
      categoryTypeName1: 'Bronze',
      categoryTypeName2: 'Silber',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };
    const shape = resolveCategoryShape(category);
    expect(shape.kind).toBe('combined');
    expect(shape.gridColumns).toBe('grid-cols-[6%_minmax(0,1fr)_20%_20%_22%]');
    expect(shape.colSpan).toBe(5);
    expect(shape.isCombinedCategory).toBe(true);
    expect(shape.headers).toHaveLength(5);
    expect(shape.headers[2].label).toBe('Bronze');
    expect(shape.headers[3].label).toBe('Silber');
    expect(shape.headers[4].label).toBe('Gesamt');
  });

  it('uses a fire-brigade identity header for brigade-pairing categories', () => {
    const category: CategoryResultData = {
      id: 'gesamt-feuerwehr',
      displayName: 'Gesamtwertung Feuerwehr',
      publicEnabled: true,
      order: 3,
      type: 'combined',
      isBrigadePairing: true,
      categoryTypeName1: 'Bronze Aktiv',
      categoryTypeName2: 'Bronze Jugend',
      rankedResults: [],
      openEntries: [],
      dnfEntries: [],
    };

    const shape = resolveCategoryShape(category);

    expect(shape.headers[1].label).toBe('Feuerwehr');
  });
});
