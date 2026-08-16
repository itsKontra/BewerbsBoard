import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from '../admin/utils';
import { getKvStore } from '../admin/config';
import { buildCategoriesResultMap, type EvaluationTypeView, type EntryDetailView } from '../../../shared/api-mappers/results-builder';
import { createEvaluationTypeViews } from '../../../shared/seed/seed-data';

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);

    // Fetch KV settings if available
    let eventTitle = 'Feuerwehr Leistungsbewerb';
    let publicUrl = 'https://bewerb.feuerwehr.at';

    const kv = getKvStore(context.env);
    if (kv && typeof kv.get === 'function') {
      try {
        const storedTitle = await kv.get('event:name');
        if (storedTitle) eventTitle = storedTitle;

        const storedUrl = await kv.get('public:url');
        if (storedUrl) publicUrl = storedUrl;

      } catch {
        // KV read errors ignored, fallback used
      }
    }

    // Query 1: Fetch entries
    const allEntries: EntryDetailView[] = await db
      .select({
        id: schema.categoryEntries.id,
        groupId: schema.categoryEntries.groupId,
        categoryTypeId: schema.categoryEntries.categoryTypeId,
        runStatus: schema.categoryEntries.runStatus,
        startOrderPosition: schema.categoryEntries.startOrderPosition,
        attackTimeHundredths: schema.categoryEntries.attackTimeHundredths,
        attackTimeErrors: schema.categoryEntries.attackTimeErrors,
        relayRaceHundredths: schema.categoryEntries.relayRaceHundredths,
        relayRaceErrors: schema.categoryEntries.relayRaceErrors,
        categoryTypeName: schema.categoryTypes.name,
        hasRelayRace: schema.categoryTypes.hasRelayRace,
        groupName: schema.groups.name,
        competitionClass: schema.competitionClasses.name,
        fireBrigadeId: schema.groups.fireBrigadeId,
        fireBrigadeName: schema.fireBrigades.name,
      })
      .from(schema.categoryEntries)
      .innerJoin(schema.groups, eq(schema.categoryEntries.groupId, schema.groups.id))
      .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
      .innerJoin(schema.fireBrigades, eq(schema.groups.fireBrigadeId, schema.fireBrigades.id))
      .innerJoin(schema.categoryTypes, eq(schema.categoryEntries.categoryTypeId, schema.categoryTypes.id))
      .all();

    // Query 2: Evaluation types & Category types
    const rawEvalTypes = (await db.select().from(schema.evaluationTypes).all()) || [];
    const rawCatTypes = (await db.select().from(schema.categoryTypes).all()) || [];

    const catTypesMap = new Map(rawCatTypes.map((c) => [c.id, c]));
    const validRawEvalTypes = rawEvalTypes.filter((et) => Boolean(et && et.categoryTypeId1));

    const evaluationTypes: EvaluationTypeView[] = validRawEvalTypes.map((et) => {
      const catId1 = et.categoryTypeId1;
      const catId2 = et.categoryTypeId2;
      const cat1 = catTypesMap.get(catId1);
      const cat2 = catId2 ? catTypesMap.get(catId2) : undefined;
      return {
        id: et.id,
        name: et.name,
        categoryTypeId1: catId1,
        categoryTypeName1: cat1?.name,
        hasRelayRace1: cat1?.hasRelayRace ?? false,
        competitionClassId1: cat1?.competitionClassId ?? null,
        categoryTypeId2: catId2,
        categoryTypeName2: cat2?.name ?? null,
        hasRelayRace2: cat2?.hasRelayRace ?? false,
        competitionClassId2: cat2?.competitionClassId ?? null,
        excludeRelayRace: Boolean(et.excludeRelayRace || (et as any).exclude_relay_race),
        isBrigadePairing: Boolean(et.isBrigadePairing || (et as any).is_brigade_pairing),
        public: et.public ?? true,
        publicTv: et.public_tv ?? true,
        displayDurationSeconds: et.displayDurationSeconds ?? 10,
        order: et.order ?? 1,
      };
    });

    const categories = buildCategoriesResultMap(
      evaluationTypes.length > 0 ? evaluationTypes : createEvaluationTypeViews(),
      allEntries,
    );

    return jsonResponse(
      {
        eventTitle,
        publicUrl,
        timestamp: Date.now(),
        categories,
      },
      200
    );
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
