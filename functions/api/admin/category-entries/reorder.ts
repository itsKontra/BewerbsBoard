import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from '../utils';

export async function onRequestPost(context: EventContext) {
  try {
    const data: any = await context.request.json();
    const { categoryTypeId, orderedIds } = data;
    const user = context.data.adminUser || 'system';

    if (!categoryTypeId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return jsonError('Missing categoryTypeId or orderedIds array', 400);
    }

    const db = getDb(context.env);

    // Fetch current entries to validate they belong to the category and are OPEN
    const entries = await db
      .select()
      .from(schema.categoryEntries)
      .where(
        and(
          eq(schema.categoryEntries.categoryTypeId, categoryTypeId),
          inArray(schema.categoryEntries.id, orderedIds)
        )
      )
      .all();

    if (!entries || entries.length !== orderedIds.length) {
      return jsonError('Some entries were not found in this category', 400);
    }

    if (entries.some((e: any) => e.runStatus !== 'OPEN')) {
      return jsonError('Can only reorder OPEN entries', 400);
    }

    // Build batch updates
    const updates = orderedIds.map((id, index) => {
      const position = index + 1;
      return db
        .update(schema.categoryEntries)
        .set({ startOrderPosition: position })
        .where(eq(schema.categoryEntries.id, id));
    });

    const auditInsert = db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      user: user,
      action: 'REORDER_CATEGORY_ENTRIES',
      details: JSON.stringify({ categoryTypeId, count: orderedIds.length }),
    });

    await db.batch([...updates, auditInsert] as any);

    return jsonResponse({ message: 'Start order reordered successfully' }, 200);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
