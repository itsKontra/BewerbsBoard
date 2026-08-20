import { getDb, jsonResponse, jsonError, logAudit, getCategoryTypeName, type EventContext } from '../utils';
import { evaluationTypes, categoryTypes } from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestPut(context: EventContext) {
  try {
    const id = context.params.id as string;
    const data = await context.request.json() as any;
    const db = getDb(context.env);

    const existing = await db.select().from(evaluationTypes).where(eq(evaluationTypes.id, id)).limit(1);
    if (existing.length === 0) {
      return jsonError('Evaluation type not found', 404);
    }

    if (data.categoryTypeId1) {
      const cat1 = await db.select().from(categoryTypes).where(eq(categoryTypes.id, data.categoryTypeId1)).limit(1);
      if (cat1.length === 0) {
        return jsonError(`Category type '${data.categoryTypeId1}' not found`, 400);
      }
    }

    if (data.categoryTypeId2) {
      const cat2 = await db.select().from(categoryTypes).where(eq(categoryTypes.id, data.categoryTypeId2)).limit(1);
      if (cat2.length === 0) {
        return jsonError(`Category type '${data.categoryTypeId2}' not found`, 400);
      }
    }

    const updateValues: Record<string, any> = {};
    if (typeof data.name === 'string' && data.name.trim()) updateValues.name = data.name.trim();
    if (typeof data.categoryTypeId1 === 'string' && data.categoryTypeId1.trim()) updateValues.categoryTypeId1 = data.categoryTypeId1.trim();
    if ('categoryTypeId2' in data) updateValues.categoryTypeId2 = (typeof data.categoryTypeId2 === 'string' && data.categoryTypeId2.trim()) ? data.categoryTypeId2.trim() : null;
    if (typeof data.excludeRelayRace === 'boolean') updateValues.excludeRelayRace = data.excludeRelayRace;
    if (typeof data.public === 'boolean') updateValues.public = data.public;
    if (typeof data.publicTv === 'boolean') updateValues.public_tv = data.publicTv;
    if (typeof data.public_tv === 'boolean') updateValues.public_tv = data.public_tv;
    if (typeof data.displayDurationSeconds === 'number' && Number.isInteger(data.displayDurationSeconds) && data.displayDurationSeconds > 0) {
      updateValues.displayDurationSeconds = data.displayDurationSeconds;
    }
    if (typeof data.order === 'number' && Number.isInteger(data.order)) updateValues.order = data.order;

    const updated = await db
      .update(evaluationTypes)
      .set(updateValues)
      .where(eq(evaluationTypes.id, id))
      .returning();

    if (updated.length === 0) {
      return jsonError('Evaluation type not found', 404);
    }

    // Retrieve joined category types for full representation
    const rawCatTypes = (await db.select().from(categoryTypes).all()) || [];
    const catMap = new Map(rawCatTypes.map((c) => [c.id, c]));
    const et = updated[0];
    const cat1 = catMap.get(et.categoryTypeId1);
    const cat2 = et.categoryTypeId2 ? catMap.get(et.categoryTypeId2) : undefined;

    const responseItem = {
      id: et.id,
      name: et.name,
      categoryTypeId1: et.categoryTypeId1,
      categoryTypeName1: cat1?.name || '',
      hasRelayRace1: Boolean(cat1?.hasRelayRace),
      categoryTypeId2: et.categoryTypeId2 || null,
      categoryTypeName2: cat2?.name || null,
      hasRelayRace2: Boolean(cat2?.hasRelayRace),
      excludeRelayRace: Boolean(et.excludeRelayRace),
      isBrigadePairing: Boolean(et.isBrigadePairing),
      public: Boolean(et.public),
      publicTv: Boolean(et.public_tv),
      displayDurationSeconds: et.displayDurationSeconds,
      order: et.order,
    };

    const prevCat1 = catMap.get(existing[0].categoryTypeId1);
    const prevCat2 = existing[0].categoryTypeId2 ? catMap.get(existing[0].categoryTypeId2) : undefined;

    await logAudit(db, context.data.adminUser as string, 'UPDATE_EVALUATION_TYPE', {
      operation: 'UPDATE',
      previous_value: {
        ...existing[0],
        categoryTypeName1: prevCat1?.name || '',
        categoryTypeName2: prevCat2?.name || null,
      },
      new_value: {
        ...et,
        categoryTypeName1: cat1?.name || '',
        categoryTypeName2: cat2?.name || null,
      },
    });

    return jsonResponse(responseItem, 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('An evaluation type with this name already exists', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}

export async function onRequestDelete(context: EventContext) {
  try {
    const id = context.params.id as string;
    const db = getDb(context.env);

    const deleted = await db
      .delete(evaluationTypes)
      .where(eq(evaluationTypes.id, id))
      .returning();

    if (deleted.length === 0) {
      return jsonError('Evaluation type not found', 404);
    }

    const categoryTypeName1 = await getCategoryTypeName(db, deleted[0].categoryTypeId1);
    const categoryTypeName2 = deleted[0].categoryTypeId2 ? await getCategoryTypeName(db, deleted[0].categoryTypeId2) : null;

    await logAudit(db, context.data.adminUser as string, 'DELETE_EVALUATION_TYPE', {
      operation: 'DELETE',
      previous_value: {
        ...deleted[0],
        categoryTypeName1,
        categoryTypeName2,
      },
      new_value: null,
    });

    return jsonResponse({ success: true, deletedId: id }, 200);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
