import { getDb, jsonResponse, jsonError, logAudit, getFireBrigadeName, getCompetitionClassName, type EventContext } from '../utils';
import { groups, competitionClasses } from '../../../../shared/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export async function onRequestPut(context: EventContext) {
  try {
    const id = context.params.id as string;
    const data = await context.request.json() as any;

    if (!data.name || typeof data.name !== 'string') {
      return jsonError('Name is required and must be a string', 400);
    }
    if (!data.competitionClassId || typeof data.competitionClassId !== 'string') {
      return jsonError('Competition class ID is required', 400);
    }

    const db = getDb(context.env);

    const competitionClass = await db.select()
      .from(competitionClasses)
      .where(eq(competitionClasses.id, data.competitionClassId))
      .limit(1);
    if (competitionClass.length === 0) return jsonError('Invalid competition class', 400);
    const competitionClassId = competitionClass[0].id;

    const currentGroup = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (currentGroup.length === 0) return jsonError('Group not found', 404);

    // Check unique constraint if name or competitionClass is changed
    const existing = await db
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.fireBrigadeId, data.fireBrigadeId),
          eq(groups.name, data.name),
          eq(groups.competitionClassId, competitionClassId),
          ne(groups.id, id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return jsonError('A group with this name and competition class already exists in the selected fire brigade', 409);
    }

    const updated = await db
      .update(groups)
      .set({
        name: data.name,
        competitionClassId,
      })
      .where(eq(groups.id, id))
      .returning();

    if (updated.length === 0) {
      return jsonError('Group not found', 404);
    }

    const prevFireBrigadeName = await getFireBrigadeName(db, currentGroup[0].fireBrigadeId);
    const prevCompetitionClassName = await getCompetitionClassName(db, currentGroup[0].competitionClassId);
    const newFireBrigadeName = await getFireBrigadeName(db, updated[0].fireBrigadeId);

    await logAudit(db, context.data.adminUser as string, 'UPDATE_GROUP', {
      operation: 'UPDATE',
      previous_value: {
        ...currentGroup[0],
        fireBrigadeName: prevFireBrigadeName,
        competitionClassName: prevCompetitionClassName,
      },
      new_value: {
        ...updated[0],
        fireBrigadeName: newFireBrigadeName,
        competitionClassName: competitionClass[0].name,
      }
    });

    return jsonResponse({ ...updated[0], competitionClass: competitionClass[0].name }, 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
       return jsonError('A group with this name and competition class already exists in the selected fire brigade', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}

export async function onRequestDelete(context: EventContext) {
  try {
    const id = context.params.id as string;
    const db = getDb(context.env);

    const deleted = await db
      .delete(groups)
      .where(eq(groups.id, id))
      .returning();

    if (deleted.length === 0) {
      return jsonError('Group not found', 404);
    }

    const fireBrigadeName = await getFireBrigadeName(db, deleted[0].fireBrigadeId);
    const competitionClassName = await getCompetitionClassName(db, deleted[0].competitionClassId);

    await logAudit(db, context.data.adminUser as string, 'DELETE_GROUP', {
      operation: 'DELETE',
      previous_value: {
        ...deleted[0],
        fireBrigadeName,
        competitionClassName,
      }
    });

    return jsonResponse({ success: true, deletedId: id }, 200);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
