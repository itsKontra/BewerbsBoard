import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { competitionClasses } from '../../../../shared/db/schema';

export async function onRequestGet(context: EventContext) {
  const db = getDb(context.env);
  const classes = await db.select().from(competitionClasses).orderBy(competitionClasses.name).all();
  return jsonResponse(classes);
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = await context.request.json() as any;
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      return jsonError('Name is required and must be a string', 400);
    }

    const db = getDb(context.env);
    const id = (typeof data.id === 'string' && data.id.trim()) ? data.id.trim() : crypto.randomUUID();
    const newClass = { id, name: data.name.trim() };

    await db.insert(competitionClasses).values(newClass);
    await logAudit(db, context.data.adminUser as string, 'CREATE_COMPETITION_CLASS', {
      operation: 'CREATE',
      previous_value: null,
      new_value: newClass,
    });

    return jsonResponse(newClass, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('A competition class with this name already exists', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
