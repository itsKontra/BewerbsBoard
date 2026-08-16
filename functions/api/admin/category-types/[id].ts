import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { categoryTypes, categoryEntries, competitionClasses, evaluationTypes } from '../../../../shared/db/schema';
import { eq, or } from 'drizzle-orm';

export async function onRequestPut(context: EventContext) {
  try {
    const id = context.params.id as string;
    const data = await context.request.json() as any;
    const db = getDb(context.env);

    const existing = await db.select().from(categoryTypes).where(eq(categoryTypes.id, id)).limit(1);
    if (existing.length === 0) {
      return jsonError('Category type not found', 404);
    }

    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
      return jsonError('Name cannot be empty', 400);
    }
    if (data.competitionClassId !== undefined && (typeof data.competitionClassId !== 'string' || data.competitionClassId.trim() === '')) {
      return jsonError('competitionClassId cannot be empty', 400);
    }

    const updateValues: Record<string, any> = {};
    if (typeof data.name === 'string' && data.name.trim()) updateValues.name = data.name.trim();
    if (typeof data.hasRelayRace === 'boolean') updateValues.hasRelayRace = data.hasRelayRace;
    if (typeof data.competitionClassId === 'string') {
      const competitionClassId = data.competitionClassId.trim();
      const competitionClass = await db.select({ id: competitionClasses.id })
        .from(competitionClasses)
        .where(eq(competitionClasses.id, competitionClassId))
        .limit(1);
      if (competitionClass.length === 0) {
        return jsonError(`Competition class '${competitionClassId}' not found`, 400);
      }
      updateValues.competitionClassId = competitionClassId;
    }

    const updated = await db
      .update(categoryTypes)
      .set(updateValues)
      .where(eq(categoryTypes.id, id))
      .returning();

    if (updated.length === 0) {
      return jsonError('Category type not found', 404);
    }

    await logAudit(db, context.data.adminUser as string, 'UPDATE_CATEGORY_TYPE', { id, ...updateValues });

    return jsonResponse(updated[0], 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('A category type with this name already exists', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}

export async function onRequestDelete(context: EventContext) {
  try {
    const id = context.params.id as string;
    const db = getDb(context.env);

    // Check if referenced by category entries
    const linkedEntries = await db.select().from(categoryEntries).where(eq(categoryEntries.categoryTypeId, id)).limit(1);
    if (linkedEntries.length > 0) {
      return jsonError('Cannot delete category type with registered entries', 400);
    }

    // Check if referenced by evaluation types
    const linkedEvaluations = await db
      .select()
      .from(evaluationTypes)
      .where(or(eq(evaluationTypes.categoryTypeId1, id), eq(evaluationTypes.categoryTypeId2, id)))
      .limit(1);
    if (linkedEvaluations.length > 0) {
      return jsonError('Cannot delete category type referenced by evaluation types', 400);
    }

    const deleted = await db
      .delete(categoryTypes)
      .where(eq(categoryTypes.id, id))
      .returning();

    if (deleted.length === 0) {
      return jsonError('Category type not found', 404);
    }

    await logAudit(db, context.data.adminUser as string, 'DELETE_CATEGORY_TYPE', { id, name: deleted[0].name });

    return jsonResponse({ success: true, deletedId: id }, 200);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
