import { getDb, jsonResponse, jsonError, logAudit, getFireBrigadeName, type EventContext } from '../utils';
import { groups, competitionClasses } from '../../../../shared/db/schema';
import { and, eq } from 'drizzle-orm';

export async function onRequestGet(context: EventContext) {
  const db = getDb(context.env);
  const allGroups = await db
    .select({
      id: groups.id,
      fireBrigadeId: groups.fireBrigadeId,
      name: groups.name,
      competitionClassId: groups.competitionClassId,
      competitionClass: competitionClasses.name,
    })
    .from(groups)
    .innerJoin(competitionClasses, eq(groups.competitionClassId, competitionClasses.id))
    .all();
  return jsonResponse(allGroups);
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = await context.request.json() as any;
    if (!data.name || typeof data.name !== 'string') {
      return jsonError('Name is required and must be a string', 400);
    }
    if (!data.fireBrigadeId || typeof data.fireBrigadeId !== 'string') {
      return jsonError('Fire brigade ID is required', 400);
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

    // Check unique constraint manually since D1 might just throw a generic SQLite error
    const existing = await db
      .select()
      .from(groups)
      .where(
        and(
          eq(groups.fireBrigadeId, data.fireBrigadeId),
          eq(groups.name, data.name),
          eq(groups.competitionClassId, competitionClassId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return jsonError('A group with this name and competition class already exists in the selected fire brigade', 409);
    }

    const id = crypto.randomUUID();
    const newGroup = {
      id,
      fireBrigadeId: data.fireBrigadeId,
      name: data.name,
      competitionClassId,
    };

    await db.insert(groups).values(newGroup);
    const fireBrigadeName = await getFireBrigadeName(db, data.fireBrigadeId);

    await logAudit(db, context.data.adminUser as string, 'CREATE_GROUP', {
      operation: 'CREATE',
      new_value: {
        ...newGroup,
        competitionClassName: competitionClass[0].name,
        fireBrigadeName,
      },
    });

    return jsonResponse({ id, fireBrigadeId: data.fireBrigadeId, name: data.name, competitionClassId, competitionClass: competitionClass[0].name }, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
       return jsonError('A group with this name and competition class already exists in the selected fire brigade', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
