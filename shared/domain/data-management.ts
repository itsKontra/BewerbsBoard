export interface AppConfigRecord {
  key: string;
  valueJson: string;
  updatedAt: number;
}

export interface CompetitionClassRecord {
  id: string;
  name: string;
}

export interface FireBrigadeRecord {
  id: string;
  name: string;
}

export interface CategoryTypeRecord {
  id: string;
  name: string;
  competitionClassId: string;
  hasRelayRace: boolean;
}

export interface EvaluationTypeRecord {
  id: string;
  name: string;
  categoryTypeId1: string;
  categoryTypeId2: string | null;
  excludeRelayRace: boolean;
  isBrigadePairing: boolean;
  showSingleResults?: boolean;
  show_single_results?: boolean;
  public: boolean;
  public_tv?: boolean;
  publicTv?: boolean;
  displayDurationSeconds: number;
  order: number;
}

export interface GroupRecord {
  id: string;
  fireBrigadeId: string;
  competitionClassId: string;
  name: string;
}

export interface CategoryEntryRecord {
  id: string;
  groupId: string;
  categoryTypeId: string;
  runStatus: 'OPEN' | 'VALID' | 'DNF';
  startOrderPosition: number | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
}

export interface DataExportPayload {
  appConfig: AppConfigRecord[];
  competitionClasses: CompetitionClassRecord[];
  fireBrigades: FireBrigadeRecord[];
  categoryTypes: CategoryTypeRecord[];
  evaluationTypes: EvaluationTypeRecord[];
  groups: GroupRecord[];
  categoryEntries: CategoryEntryRecord[];
}

export interface DataExportEnvelope {
  version: 1;
  exportedAt: string;
  appVersion?: string;
  data: DataExportPayload;
}

export interface EntityImportCount {
  total: number;
  toInsert: number;
  toUpdate: number;
}

export interface PreflightSummary {
  isValid: boolean;
  errors: string[];
  summary: {
    appConfig: EntityImportCount;
    competitionClasses: EntityImportCount;
    fireBrigades: EntityImportCount;
    categoryTypes: EntityImportCount;
    evaluationTypes: EntityImportCount;
    groups: EntityImportCount;
    categoryEntries: EntityImportCount;
  };
  totalEntities: number;
}

export const DATA_EXPORT_VERSION = 1 as const;

export function createEmptyDataPayload(): DataExportPayload {
  return {
    appConfig: [],
    competitionClasses: [],
    fireBrigades: [],
    categoryTypes: [],
    evaluationTypes: [],
    groups: [],
    categoryEntries: [],
  };
}

export function validateDataExportEnvelope(input: unknown): {
  isValid: boolean;
  errors: string[];
  envelope?: DataExportEnvelope;
} {
  const errors: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { isValid: false, errors: ['Ungültiges Dateiformat: JSON-Objekt erwartet.'] };
  }

  const candidate = input as Record<string, any>;

  if (candidate.version !== DATA_EXPORT_VERSION) {
    errors.push(`Nicht unterstützte Schema-Version: ${candidate.version ?? 'fehlt'}. Unterstützt wird Version ${DATA_EXPORT_VERSION}.`);
  }

  if (typeof candidate.exportedAt !== 'string' || Number.isNaN(Date.parse(candidate.exportedAt))) {
    errors.push('Ungültiges oder fehlendes "exportedAt" Datumsfeld im Envelope.');
  }

  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    errors.push('Fehlender oder ungültiger "data" Container.');
    return { isValid: false, errors };
  }

  const data = candidate.data;
  const tableKeys: Array<keyof DataExportPayload> = [
    'appConfig',
    'competitionClasses',
    'fireBrigades',
    'categoryTypes',
    'evaluationTypes',
    'groups',
    'categoryEntries',
  ];

  for (const key of tableKeys) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      errors.push(`Tabelle "${key}" muss ein Array sein.`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const sanitizedPayload: DataExportPayload = {
    appConfig: Array.isArray(data.appConfig) ? data.appConfig : [],
    competitionClasses: Array.isArray(data.competitionClasses) ? data.competitionClasses : [],
    fireBrigades: Array.isArray(data.fireBrigades) ? data.fireBrigades : [],
    categoryTypes: Array.isArray(data.categoryTypes) ? data.categoryTypes : [],
    evaluationTypes: Array.isArray(data.evaluationTypes) ? data.evaluationTypes : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    categoryEntries: Array.isArray(data.categoryEntries) ? data.categoryEntries : [],
  };

  // Validate items in each list
  for (let i = 0; i < sanitizedPayload.appConfig.length; i++) {
    const item = sanitizedPayload.appConfig[i];
    if (!item || typeof item.key !== 'string' || typeof item.valueJson !== 'string') {
      errors.push(`appConfig[${i}]: "key" und "valueJson" müssen Strings sein.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.competitionClasses.length; i++) {
    const item = sanitizedPayload.competitionClasses[i];
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
      errors.push(`competitionClasses[${i}]: "id" und "name" müssen Strings sein.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.fireBrigades.length; i++) {
    const item = sanitizedPayload.fireBrigades[i];
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
      errors.push(`fireBrigades[${i}]: "id" und "name" müssen Strings sein.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.categoryTypes.length; i++) {
    const item = sanitizedPayload.categoryTypes[i];
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.competitionClassId !== 'string') {
      errors.push(`categoryTypes[${i}]: "id", "name" und "competitionClassId" sind Pflichtfelder.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.evaluationTypes.length; i++) {
    const item = sanitizedPayload.evaluationTypes[i];
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.categoryTypeId1 !== 'string') {
      errors.push(`evaluationTypes[${i}]: "id", "name" und "categoryTypeId1" sind Pflichtfelder.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.groups.length; i++) {
    const item = sanitizedPayload.groups[i];
    if (!item || typeof item.id !== 'string' || typeof item.fireBrigadeId !== 'string' || typeof item.competitionClassId !== 'string' || typeof item.name !== 'string') {
      errors.push(`groups[${i}]: "id", "fireBrigadeId", "competitionClassId" und "name" sind Pflichtfelder.`);
    }
  }

  for (let i = 0; i < sanitizedPayload.categoryEntries.length; i++) {
    const item = sanitizedPayload.categoryEntries[i];
    if (!item || typeof item.id !== 'string' || typeof item.groupId !== 'string' || typeof item.categoryTypeId !== 'string') {
      errors.push(`categoryEntries[${i}]: "id", "groupId" und "categoryTypeId" sind Pflichtfelder.`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    envelope: {
      version: 1,
      exportedAt: candidate.exportedAt,
      appVersion: typeof candidate.appVersion === 'string' ? candidate.appVersion : undefined,
      data: sanitizedPayload,
    },
  };
}
