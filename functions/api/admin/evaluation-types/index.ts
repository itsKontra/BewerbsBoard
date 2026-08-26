import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { evaluationTypes, categoryTypes } from '../../../../shared/db/schema';
import { normalizeShowSingleResults } from '../../../../shared/domain/evaluation';
import { eq } from 'drizzle-orm';

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);
    const rawEvalTypes = (await db.select().from(evaluationTypes).all()) || [];
    const rawCatTypes = (await db.select().from(categoryTypes).all()) || [];

    const catMap = new Map(rawCatTypes.map((c) => [c.id, c]));

    const result = rawEvalTypes.map((et: any) => {
      const catId1 = et.categoryTypeId1 || et.category_type_id_1;
      const catId2 = et.categoryTypeId2 || et.category_type_id_2 || null;
      const cat1 = catMap.get(catId1);
      const cat2 = catId2 ? catMap.get(catId2) : undefined;

      return {
        id: et.id,
        name: et.name,
        categoryTypeId1: catId1,
        categoryTypeName1: cat1?.name || '',
        hasRelayRace1: Boolean(cat1?.hasRelayRace),
        categoryTypeId2: catId2,
        categoryTypeName2: cat2?.name || null,
        hasRelayRace2: Boolean(cat2?.hasRelayRace),
        excludeRelayRace: Boolean(et.excludeRelayRace || et.exclude_relay_race),
        isBrigadePairing: Boolean(et.isBrigadePairing || et.is_brigade_pairing),
        showSingleResults: Boolean(et.showSingleResults || et.show_single_results),
        public: et.public !== undefined ? Boolean(et.public) : true,
        publicTv: et.public_tv !== undefined ? Boolean(et.public_tv) : (et.publicTv !== undefined ? Boolean(et.publicTv) : true),
        displayDurationSeconds: et.displayDurationSeconds ?? et.display_duration_seconds ?? 10,
        order: et.order ?? 1,
      };
    });

    result.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
    return jsonResponse(result);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = await context.request.json() as any;
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return jsonError('Name is required and must be a string', 400);
    }
    if (!data.categoryTypeId1 || typeof data.categoryTypeId1 !== 'string') {
      return jsonError('categoryTypeId1 is required', 400);
    }

    const db = getDb(context.env);

    // Validate categoryTypeId1 exists
    const cat1 = await db.select().from(categoryTypes).where(eq(categoryTypes.id, data.categoryTypeId1)).limit(1);
    if (cat1.length === 0) {
      return jsonError(`Category type '${data.categoryTypeId1}' not found`, 400);
    }

    // Validate categoryTypeId2 if present
    let cat2Name: string | null = null;
    let cat2HasRelay = false;
    if (data.categoryTypeId2) {
      const cat2 = await db.select().from(categoryTypes).where(eq(categoryTypes.id, data.categoryTypeId2)).limit(1);
      if (cat2.length === 0) {
        return jsonError(`Category type '${data.categoryTypeId2}' not found`, 400);
      }
      cat2Name = cat2[0].name;
      cat2HasRelay = Boolean(cat2[0].hasRelayRace);
    }

    const id = (typeof data.id === 'string' && data.id.trim()) ? data.id.trim() : crypto.randomUUID();
    const newEval = {
      id,
      name: data.name.trim(),
      categoryTypeId1: data.categoryTypeId1,
      categoryTypeId2: data.categoryTypeId2 || null,
      excludeRelayRace: Boolean(data.excludeRelayRace),
      isBrigadePairing: Boolean(data.categoryTypeId2 && data.isBrigadePairing),
      showSingleResults: normalizeShowSingleResults(data.categoryTypeId2, data.showSingleResults),
      public: data.public !== undefined ? Boolean(data.public) : true,
      public_tv: data.publicTv !== undefined ? Boolean(data.publicTv) : (data.public_tv !== undefined ? Boolean(data.public_tv) : true),
      displayDurationSeconds: typeof data.displayDurationSeconds === 'number' && Number.isInteger(data.displayDurationSeconds) && data.displayDurationSeconds > 0
        ? data.displayDurationSeconds
        : 10,
      order: typeof data.order === 'number' && Number.isInteger(data.order) ? data.order : 1,
    };

    await db.insert(evaluationTypes).values(newEval);
    const { categoryTypeId1: _c1, categoryTypeId2: _c2, ...newRest } = newEval as any;

    await logAudit(db, context.data.adminUser as string, 'CREATE_EVALUATION_TYPE', {
      operation: 'CREATE',
      previous_value: null,
      new_value: {
        category1: cat1[0].name,
        category2: cat2Name,
        ...newRest,
      },
    });

    const responseItem = {
      id: newEval.id,
      name: newEval.name,
      categoryTypeId1: newEval.categoryTypeId1,
      categoryTypeName1: cat1[0].name,
      hasRelayRace1: Boolean(cat1[0].hasRelayRace),
      categoryTypeId2: newEval.categoryTypeId2,
      categoryTypeName2: cat2Name,
      hasRelayRace2: cat2HasRelay,
      excludeRelayRace: newEval.excludeRelayRace,
      isBrigadePairing: newEval.isBrigadePairing,
      showSingleResults: newEval.showSingleResults,
      public: newEval.public,
      publicTv: newEval.public_tv,
      displayDurationSeconds: newEval.displayDurationSeconds,
      order: newEval.order,
    };

    return jsonResponse(responseItem, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('An evaluation type with this name already exists', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
