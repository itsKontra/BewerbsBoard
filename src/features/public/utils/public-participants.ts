import { uiText } from '../../../ui-text';
import type { RankedResultRow } from '../types';

type Participant = Pick<RankedResultRow, 'fireBrigadeName' | 'groupName'> & { fireBrigadeId?: string };

export function brigadeKey(item: Participant) {
  return item.fireBrigadeId || `name:${item.fireBrigadeName}`;
}

export function groupLabel(name: string) {
  return /^\d+$/.test(name.trim()) ? uiText.publicScoreboard.groupName(name) : name;
}

export function matchesSearch(item: Participant, query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase('de-AT').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  return normalize(`${item.fireBrigadeName} ${groupLabel(item.groupName)}`).includes(normalize(query.trim()));
}
