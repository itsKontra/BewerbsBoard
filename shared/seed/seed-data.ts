import { buildCategoriesResultMap, type EntryDetailView, type EvaluationTypeView } from '../api-mappers/results-builder.js';
import { computeEntryScore, type RunStatus } from '../domain/scoring.js';
import { DEFAULT_TV_PRESENTATION } from '../domain/tv-presentation.js';
import rawSeedData from './seed-data.json' with { type: 'json' };

export interface CompetitionClassSeed {
  id: string;
  name: string;
}

export interface CategoryTypeSeed {
  id: string;
  name: string;
  competitionClassId: string;
  hasRelayRace: boolean;
}

export interface EvaluationTypeSeed {
  id: string;
  name: string;
  categoryTypeId1: string;
  categoryTypeId2: string | null;
  excludeRelayRace: boolean;
  isBrigadePairing: boolean;
  showSingleResults?: boolean;
  public: boolean;
  publicTv: boolean;
  displayDurationSeconds: number;
  order: number;
}

export interface FireBrigadeSeed {
  id: string;
  name: string;
}

export interface GroupSeed {
  id: string;
  name: string;
  competitionClassId: string;
  fireBrigadeId: string;
}

export interface CategoryEntrySeed {
  id: string;
  groupId: string;
  categoryTypeId: string;
  runStatus: RunStatus;
  startOrderPosition: number | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
}

interface AuditLogSeed {
  id: string;
  secondsAgo: number;
  user: string;
  action: string;
  details: unknown;
}

interface SeedData {
  catalog: {
    competitionClasses: CompetitionClassSeed[];
    categoryTypes: CategoryTypeSeed[];
    evaluationTypes: EvaluationTypeSeed[];
  };
  demo: {
    eventTitle: string;
    publicUrl: string;
    rankingPageDurationMs: number;
    fireBrigades: FireBrigadeSeed[];
    groups: GroupSeed[];
    categoryEntries: CategoryEntrySeed[];
    auditLogs: AuditLogSeed[];
  };
}

export const SEED_DATA = rawSeedData as SeedData;
export const DEFAULT_CATALOG_SEED = SEED_DATA.catalog;

export function createEvaluationTypeViews(): EvaluationTypeView[] {
  const categoryById = new Map(DEFAULT_CATALOG_SEED.categoryTypes.map((category) => [category.id, category]));
  return DEFAULT_CATALOG_SEED.evaluationTypes.map((evaluation) => {
    const primary = requireItem(categoryById, evaluation.categoryTypeId1, 'category type');
    const secondary = evaluation.categoryTypeId2
      ? requireItem(categoryById, evaluation.categoryTypeId2, 'category type')
      : null;
    return {
      ...evaluation,
      categoryTypeName1: primary.name,
      hasRelayRace1: primary.hasRelayRace,
      competitionClassId1: primary.competitionClassId,
      categoryTypeName2: secondary?.name ?? null,
      hasRelayRace2: secondary?.hasRelayRace ?? false,
      competitionClassId2: secondary?.competitionClassId ?? null,
    };
  });
}

export function createDemoData(now = Date.now()) {
  const competitionClassById = new Map(DEFAULT_CATALOG_SEED.competitionClasses.map((item) => [item.id, item]));
  const categoryById = new Map(DEFAULT_CATALOG_SEED.categoryTypes.map((item) => [item.id, item]));
  const brigadeById = new Map(SEED_DATA.demo.fireBrigades.map((item) => [item.id, item]));
  const groupById = new Map(SEED_DATA.demo.groups.map((item) => [item.id, item]));
  const evaluationTypes = createEvaluationTypeViews();

  const groups = SEED_DATA.demo.groups.map((group) => {
    const competitionClass = requireItem(competitionClassById, group.competitionClassId, 'competition class');
    const brigade = requireItem(brigadeById, group.fireBrigadeId, 'fire brigade');
    return { ...group, competitionClass: competitionClass.name, fireBrigadeName: brigade.name };
  });

  const categoryEntries = SEED_DATA.demo.categoryEntries.map((entry) => {
    const category = requireItem(categoryById, entry.categoryTypeId, 'category type');
    const group = requireItem(groupById, entry.groupId, 'group');
    const competitionClass = requireItem(competitionClassById, group.competitionClassId, 'competition class');
    const brigade = requireItem(brigadeById, group.fireBrigadeId, 'fire brigade');
    const scoreHundredths = entry.runStatus === 'VALID'
      ? computeEntryScore(entry, { hasRelayRace: category.hasRelayRace, excludeRelayRace: false })
      : null;
    return {
      ...entry,
      categoryType: category.name,
      categoryTypeName: category.name,
      hasRelayRace: category.hasRelayRace,
      scoreHundredths,
      errors: entry.attackTimeErrors,
      groupName: group.name,
      competitionClass: competitionClass.name,
      fireBrigadeId: brigade.id,
      fireBrigadeName: brigade.name,
    };
  });

  const entryDetails: EntryDetailView[] = categoryEntries.map((entry) => ({
    ...entry,
    competitionClassId: groupById.get(entry.groupId)?.competitionClassId,
  }));
  const categories = buildCategoriesResultMap(evaluationTypes, entryDetails);
  const categoriesConfig = Object.fromEntries(evaluationTypes.map((evaluation) => [evaluation.id, {
    name: evaluation.name,
    publicEnabled: evaluation.public ?? true,
    tvEnabled: evaluation.publicTv ?? true,
    displayDuration: evaluation.displayDurationSeconds ?? 10,
    order: evaluation.order ?? 1,
  }]));

  return {
    competitionClasses: structuredClone(DEFAULT_CATALOG_SEED.competitionClasses),
    categoryTypes: structuredClone(DEFAULT_CATALOG_SEED.categoryTypes),
    evaluationTypes: structuredClone(evaluationTypes),
    brigades: structuredClone(SEED_DATA.demo.fireBrigades),
    groups,
    categoryEntries,
    config: {
      eventTitle: SEED_DATA.demo.eventTitle,
      publicUrl: SEED_DATA.demo.publicUrl,
      rankingPageDurationMs: SEED_DATA.demo.rankingPageDurationMs,
      tvAnnouncement: { headline: '', message: '' },
      tvPresentation: { ...DEFAULT_TV_PRESENTATION },
      categories: categoriesConfig,
    },
    tvState: {
      mode: 'ROTATION' as const,
      selectedCategoryId: null,
      updatedAt: now,
      tvAnnouncement: null,
    },
    auditLogs: SEED_DATA.demo.auditLogs.map((log) => ({
      id: log.id,
      timestamp: now - log.secondsAgo * 1000,
      user: log.user,
      action: log.action,
      details: JSON.stringify(log.details),
    })),
    publicResults: {
      eventTitle: SEED_DATA.demo.eventTitle,
      publicUrl: SEED_DATA.demo.publicUrl,
      timestamp: now,
      categories,
    },
    publicTvState: {
      mode: 'ROTATION' as const,
      selectedCategoryId: null,
      updatedAt: now,
      tvAnnouncement: null,
      categoriesConfig: Object.fromEntries(Object.entries(categoriesConfig).map(([id, config]) => [id, {
        tvEnabled: config.tvEnabled,
        order: config.order,
        displayDuration: config.displayDuration,
      }])),
      rankingPageDurationMs: SEED_DATA.demo.rankingPageDurationMs,
      eventTitle: SEED_DATA.demo.eventTitle,
      serverInfo: {
        serverIp: '192.168.1.100',
        serverPort: 3080,
        adminUrl: 'http://192.168.1.100:3080/admin',
        availableIps: [{ interfaceName: 'eth0', ip: '192.168.1.100' }],
      },
      tvPresentation: {
        ...DEFAULT_TV_PRESENTATION,
        logoUrl: '/logo.png',
        adminSplashEnabled: false,
      },
    },
  };
}

function requireItem<T>(items: Map<string, T>, id: string, kind: string): T {
  const item = items.get(id);
  if (!item) throw new Error(`Seed data references unknown ${kind} '${id}'`);
  return item;
}
