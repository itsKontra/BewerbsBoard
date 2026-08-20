import { getDb, jsonResponse, jsonError, logAudit, getCompetitionClassName, type EventContext } from '../utils';
import { categoryTypes, competitionClasses } from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestGet(context: EventContext) {
  const db = getDb(context.env);
  const types = await db.select().from(categoryTypes).orderBy(categoryTypes.name).all();
  return jsonResponse(types);
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = await context.request.json() as any;
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return jsonError('Name is required and must be a string', 400);
    }
    if (!data.competitionClassId || typeof data.competitionClassId !== 'string') {
      return jsonError('competitionClassId is required', 400);
    }

    const db = getDb(context.env);
    const id = (typeof data.id === 'string' && data.id.trim()) ? data.id.trim() : crypto.randomUUID();
    const hasRelayRace = typeof data.hasRelayRace === 'boolean' ? data.hasRelayRace : true;
    const competitionClassId = data.competitionClassId.trim();
    const competitionClass = await db.select({ id: competitionClasses.id })
      .from(competitionClasses)
      .where(eq(competitionClasses.id, competitionClassId))
      .limit(1);
    if (competitionClass.length === 0) {
      return jsonError(`Competition class '${competitionClassId}' not found`, 400);
    }
    const newType = { id, name: data.name.trim(), competitionClassId, hasRelayRace };

    await db.insert(categoryTypes).values(newType);
    const competitionClassName = await getCompetitionClassName(db, competitionClassId);
    await logAudit(db, context.data.adminUser as string, 'CREATE_CATEGORY_TYPE', {
      operation: 'CREATE',
      previous_value: null,
      new_value: { ...newType, competitionClassName },
    });

    return jsonResponse(newType, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('A category type with this name already exists', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
