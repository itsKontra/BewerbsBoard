import type { CategoryResultData } from '../../public/types';
import { uiText } from '../../../ui-text';

export type CategoryRowKind =
  | 'standard'
  | 'single-relay'
  | 'combined'
  | 'combined-relay';

export interface CategoryHeaderColumn {
  key: string;
  label: string;
  groupLabel?: string;
  align: 'left' | 'center' | 'right';
  className: string;
  isAccent?: boolean;
}

export interface CategoryShapeDescriptor {
  kind: CategoryRowKind;
  gridColumns: string;
  colSpan: number;
  headers: CategoryHeaderColumn[];
  isCombinedCategory: boolean;
}

export function resolveCategoryShape(category?: CategoryResultData | null): CategoryShapeDescriptor {
  if (!category) {
    return {
      kind: 'standard',
      gridColumns: 'grid-cols-[6%_minmax(0,1fr)_24%]',
      colSpan: 3,
      isCombinedCategory: false,
      headers: [
        { key: 'rank', label: uiText.tv.rank, align: 'center', className: 'w-20 px-4 py-2 text-center' },
        { key: 'participant', label: uiText.tv.participant, align: 'left', className: 'px-4 py-2' },
        { key: 'zeit', label: uiText.tv.time, align: 'right', className: 'px-4 py-2 text-right' },
      ],
    };
  }

  const isCombined = category.type === 'combined';
  const hasRelay1 = Boolean(category.hasRelayRace1 && !category.excludeRelayRace);
  const hasRelay2 = Boolean(category.hasRelayRace2 && !category.excludeRelayRace);
  const cat1Name = category.categoryTypeName1 || uiText.tv.defaultDiscipline1;
  const cat2Name = category.categoryTypeName2 || uiText.tv.defaultDiscipline2;

  if (isCombined) {
    if (hasRelay1 || hasRelay2) {
      // 4x2 layout: Cat1 Attack + Cat1 Relay + Cat2 Attack + Cat2 Relay + Gesamt
      return {
        kind: 'combined-relay',
        gridColumns: 'grid-cols-[5%_minmax(0,1fr)_14%_14%_14%_14%_17%]',
        colSpan: 7,
        isCombinedCategory: true,
        headers: [
          { key: 'rank', label: uiText.tv.rank, align: 'center', className: 'w-16 px-3 py-2 text-center' },
          { key: 'participant', label: category.isBrigadePairing ? uiText.tv.fireBrigade : uiText.tv.participant, align: 'left', className: 'px-3 py-2' },
          { key: 'cat1-attack', label: uiText.tv.attackShort, groupLabel: cat1Name, align: 'center', className: 'px-2 py-1 text-center' },
          { key: 'cat1-relay', label: uiText.tv.relayShort, groupLabel: cat1Name, align: 'center', className: 'px-2 py-1 text-center' },
          { key: 'cat2-attack', label: uiText.tv.attackShort, groupLabel: cat2Name, align: 'center', className: 'px-2 py-1 text-center' },
          { key: 'cat2-relay', label: uiText.tv.relayShort, groupLabel: cat2Name, align: 'center', className: 'px-2 py-1 text-center' },
          { key: 'gesamt', label: uiText.tv.total, align: 'right', className: 'px-4 py-2 text-right', isAccent: true },
        ],
      };
    }

    // 2x2 layout with total: Cat1 + Cat2 + Gesamt
    return {
      kind: 'combined',
      gridColumns: 'grid-cols-[6%_minmax(0,1fr)_20%_20%_22%]',
      colSpan: 5,
      isCombinedCategory: true,
      headers: [
        { key: 'rank', label: uiText.tv.rank, align: 'center', className: 'w-20 px-4 py-2 text-center' },
        { key: 'participant', label: category.isBrigadePairing ? uiText.tv.fireBrigade : uiText.tv.participant, align: 'left', className: 'px-4 py-2' },
        { key: 'cat1', label: cat1Name, align: 'center', className: 'px-4 py-2 text-center' },
        { key: 'cat2', label: cat2Name, align: 'center', className: 'px-4 py-2 text-center' },
        { key: 'gesamt', label: uiText.tv.total, align: 'right', className: 'px-6 py-2 text-right', isAccent: true },
      ],
    };
  }

  // Single category evaluation
  if (hasRelay1) {
    // 2x2 layout: Attack + Relay + Gesamt
    return {
      kind: 'single-relay',
      gridColumns: 'grid-cols-[6%_minmax(0,1fr)_18%_18%_20%]',
      colSpan: 5,
      isCombinedCategory: false,
      headers: [
        { key: 'rank', label: uiText.tv.rank, align: 'center', className: 'w-20 px-4 py-2 text-center' },
        { key: 'participant', label: uiText.tv.participant, align: 'left', className: 'px-4 py-2' },
        { key: 'angriff', label: uiText.tv.attack, align: 'center', className: 'px-4 py-2 text-center' },
        { key: 'staffel', label: uiText.tv.relay, align: 'center', className: 'px-4 py-2 text-center' },
        { key: 'gesamt', label: uiText.tv.total, align: 'right', className: 'px-6 py-2 text-right', isAccent: true },
      ],
    };
  }

  // 1x2 standard layout: Zeit
  return {
    kind: 'standard',
    gridColumns: 'grid-cols-[6%_minmax(0,1fr)_24%]',
    colSpan: 3,
    isCombinedCategory: false,
    headers: [
      { key: 'rank', label: uiText.tv.rank, align: 'center', className: 'w-20 px-4 py-2 text-center' },
      { key: 'participant', label: uiText.tv.participant, align: 'left', className: 'px-4 py-2' },
      { key: 'zeit', label: uiText.tv.time, align: 'right', className: 'px-4 py-2 text-right' },
    ],
  };
}
