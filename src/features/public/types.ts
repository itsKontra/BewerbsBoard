export interface RunResultRow {
  entryId: string;
  runStatus?: 'OPEN' | 'VALID' | 'DNF' | string | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  scoreHundredths: number | null;
}

export interface RankedResultRow {
  rank: number | null;
  groupId: string;
  groupName: string;
  secondaryGroupName?: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
  scoreHundredths: number | null;
  primaryRun: RunResultRow;
  secondaryRun?: RunResultRow | null;
}

export interface OpenEntryRow {
  id?: string;
  groupId?: string;
  groupName: string;
  fireBrigadeId?: string;
  fireBrigadeName: string;
  startOrderPosition: number | null;
}

export interface DnfEntryRow {
  id?: string;
  groupId?: string;
  groupName: string;
  fireBrigadeId?: string;
  fireBrigadeName: string;
}

export interface CategoryResultData {
  id: string;
  displayName: string;
  publicEnabled: boolean;
  tvEnabled?: boolean;
  order: number;
  type: 'standard' | 'combined';
  isBrigadePairing?: boolean;
  showSingleResults?: boolean;
  hasRelayRace1?: boolean;
  hasRelayRace2?: boolean;
  excludeRelayRace?: boolean;
  categoryTypeName1?: string;
  categoryTypeName2?: string | null;
  rankedResults: RankedResultRow[];
  openEntries: OpenEntryRow[];
  dnfEntries: DnfEntryRow[];
}

export interface PublicResultsApiResponse {
  eventTitle: string;
  publicUrl: string;
  timestamp: number;
  categories: Record<string, CategoryResultData>;
}
