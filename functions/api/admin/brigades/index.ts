import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { fireBrigades } from '../../../../shared/db/schema';

export async function onRequestGet(context: EventContext) {
  const db = getDb(context.env);
  const brigades = await db.select().from(fireBrigades).all();
  return jsonResponse(brigades);
}

export async function onRequestPost(context: EventContext) {
  try {
    const data = await context.request.json() as any;
    if (typeof data.name !== 'string' || !data.name.trim()) {
      return jsonError('Name is required and must be a string', 400);
    }

    const db = getDb(context.env);
    const name = data.name.trim();
    const brigades = await db.select().from(fireBrigades).all();
    const normalizedName = name.toLocaleLowerCase('de-AT');
    if (brigades.some((brigade) => brigade.name.trim().toLocaleLowerCase('de-AT') === normalizedName)) {
      return jsonError('Eine Feuerwehr mit diesem Namen ist bereits vorhanden.', 409);
    }
    const id = crypto.randomUUID();
    const newBrigade = { id, name };

    await db.insert(fireBrigades).values(newBrigade);
    await logAudit(db, context.data.adminUser as string, 'CREATE_BRIGADE', newBrigade);

    return jsonResponse(newBrigade, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('Eine Feuerwehr mit diesem Namen ist bereits vorhanden.', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
