import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { fireBrigades, groups } from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestPut(context: EventContext) {
  try {
    const id = context.params.id as string;
    const data = await context.request.json() as any;
    
    if (typeof data.name !== 'string' || !data.name.trim()) {
      return jsonError('Name is required and must be a string', 400);
    }

    const db = getDb(context.env);
    const name = data.name.trim();
    const brigades = await db.select().from(fireBrigades).all();
    const normalizedName = name.toLocaleLowerCase('de-AT');
    if (brigades.some((brigade) => brigade.id !== id && brigade.name.trim().toLocaleLowerCase('de-AT') === normalizedName)) {
      return jsonError('Eine Feuerwehr mit diesem Namen ist bereits vorhanden.', 409);
    }
    const updated = await db
      .update(fireBrigades)
      .set({ name })
      .where(eq(fireBrigades.id, id))
      .returning();

    if (updated.length === 0) {
      return jsonError('Fire brigade not found', 404);
    }

    await logAudit(db, context.data.adminUser as string, 'UPDATE_BRIGADE', { id, name });

    return jsonResponse(updated[0], 200);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return jsonError('Eine Feuerwehr mit diesem Namen ist bereits vorhanden.', 409);
    }
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}

export async function onRequestDelete(context: EventContext) {
  try {
    const id = context.params.id as string;
    const db = getDb(context.env);

    // Check if there are linked groups
    const linkedGroups = await db.select().from(groups).where(eq(groups.fireBrigadeId, id)).limit(1);
    if (linkedGroups.length > 0) {
      return jsonError('Cannot delete fire brigade with registered groups', 400);
    }

    const deleted = await db
      .delete(fireBrigades)
      .where(eq(fireBrigades.id, id))
      .returning();

    if (deleted.length === 0) {
      return jsonError('Fire brigade not found', 404);
    }

    await logAudit(db, context.data.adminUser as string, 'DELETE_BRIGADE', { id, name: deleted[0].name });

    return jsonResponse({ success: true, deletedId: id }, 200);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
