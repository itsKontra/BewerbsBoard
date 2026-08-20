import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from '../utils';
import { competitionClasses, groups } from '../../../../shared/db/schema';
import { eq } from 'drizzle-orm';

export async function onRequestDelete(context: EventContext) {
  try {
    const id = context.params.id as string;
    const db = getDb(context.env);

    // Check if any groups use this competition class
    const linkedGroups = await db.select().from(groups).where(eq(groups.competitionClassId, id)).limit(1);
    if (linkedGroups.length > 0) {
      return jsonError('Cannot delete competition class assigned to groups', 400);
    }

    const deleted = await db
      .delete(competitionClasses)
      .where(eq(competitionClasses.id, id))
      .returning();

    if (deleted.length === 0) {
      return jsonError('Competition class not found', 404);
    }

    await logAudit(db, context.data.adminUser as string, 'DELETE_COMPETITION_CLASS', {
      operation: 'DELETE',
      previous_value: deleted[0],
    });

    return jsonResponse({ success: true, deletedId: id }, 200);
  } catch (error: any) {
    return jsonError(error.message || 'Internal Server Error', 500);
  }
}
