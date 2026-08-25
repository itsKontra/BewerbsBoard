import { and, asc, eq, max, ne } from 'drizzle-orm';
import * as schema from '../../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, fetchAuditNames, buildAuditLog, type EventContext } from '../utils';
import {
  calculateEntryUpdate,
  validateEntryDeletion,
  EntryValidationError,
} from '../../../../shared/domain/entry-lifecycle';
import type { CategoryEntry } from '../../../../shared/domain/scoring';

// --- DB Helpers ---

async function getNextStartOrderPosition(db: any, categoryTypeId: string): Promise<number> {
  const maxPosResult = await db
    .select({ maxPos: max(schema.categoryEntries.startOrderPosition) })
    .from(schema.categoryEntries)
    .where(
      and(
        eq(schema.categoryEntries.categoryTypeId, categoryTypeId),
        eq(schema.categoryEntries.runStatus, 'OPEN')
      )
    )
    .get();
  return (maxPosResult?.maxPos ?? 0) + 1;
}

async function getCompactionUpdatesForRemoval(db: any, categoryTypeId: string, entryId: string) {
  const remainingEntries = await db
    .select()
    .from(schema.categoryEntries)
    .where(
      and(
        eq(schema.categoryEntries.categoryTypeId, categoryTypeId),
        eq(schema.categoryEntries.runStatus, 'OPEN'),
        ne(schema.categoryEntries.id, entryId)
      )
    )
    .orderBy(asc(schema.categoryEntries.startOrderPosition))
    .all();

  return remainingEntries.map((e: any, index: number) =>
    db
      .update(schema.categoryEntries)
      .set({ startOrderPosition: index + 1 })
      .where(eq(schema.categoryEntries.id, e.id))
  );
}

// --- Route Handlers ---

export async function onRequestPut(context: EventContext) {
  try {
    const entryId = context.params?.id as string;
    const user = context.data.adminUser || 'system';

    if (!entryId) return jsonError('Missing entry ID', 400);

    const body = (await context.request.json()) as Record<string, unknown>;
    const db = getDb(context.env);

    // Fetch existing entry
    const entryRows = await db
      .select()
      .from(schema.categoryEntries)
      .where(eq(schema.categoryEntries.id, entryId))
      .limit(1);

    if (entryRows.length === 0) return jsonError('Category entry not found', 404);

    const previousEntry = entryRows[0];
    const categoryTypeId = previousEntry.categoryTypeId;

    // Look up category type to know hasRelayRace
    const catRows = await db
      .select({ hasRelayRace: schema.categoryTypes.hasRelayRace })
      .from(schema.categoryTypes)
      .where(eq(schema.categoryTypes.id, categoryTypeId))
      .limit(1);
    const hasRelayRace = (previousEntry as any).hasRelayRace ?? catRows[0]?.hasRelayRace ?? false;

    let nextOpenPos: number | undefined;
    if (previousEntry.runStatus !== 'OPEN' && body.runStatus === 'OPEN') {
      nextOpenPos = await getNextStartOrderPosition(db, categoryTypeId);
    }

    const { groupName, categoryName } = await fetchAuditNames(db, previousEntry.groupId, categoryTypeId);

    let result;
    try {
      result = calculateEntryUpdate(previousEntry as CategoryEntry, body, {
        hasRelayRace,
        getNextOpenPosition: nextOpenPos !== undefined ? () => nextOpenPos! : undefined,
        groupName,
        categoryName,
      });
    } catch (err: any) {
      return jsonError(err.message, err instanceof EntryValidationError ? 400 : 500);
    }

    const compactionUpdates = result.requiresCompaction
      ? await getCompactionUpdatesForRemoval(db, categoryTypeId, entryId)
      : [];

    const updateQuery = db
      .update(schema.categoryEntries)
      .set({
        attackTimeHundredths: result.nextEntry.attackTimeHundredths,
        attackTimeErrors: result.nextEntry.attackTimeErrors,
        relayRaceHundredths: result.nextEntry.relayRaceHundredths,
        relayRaceErrors: result.nextEntry.relayRaceErrors,
        runStatus: result.nextEntry.runStatus,
        startOrderPosition: result.nextEntry.startOrderPosition,
      })
      .where(eq(schema.categoryEntries.id, entryId));

    const auditInsert = buildAuditLog(db, user, 'UPDATE', result.auditPayload);

    await db.batch([updateQuery, ...compactionUpdates, auditInsert]);

    return jsonResponse(
      {
        message: 'Category entry updated successfully',
        entry: {
          ...result.nextEntry,
          errors: result.nextEntry.attackTimeErrors, // For legacy/frontend compat
          attackTimeErrors: result.nextEntry.attackTimeErrors,
          scoreHundredths: result.scoreHundredths,
        },
      },
      200
    );
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}

export const onRequestPatch = onRequestPut;

export async function onRequestDelete(context: EventContext) {
  try {
    const entryId = context.params?.id as string;
    const user = context.data.adminUser || 'system';

    if (!entryId) return jsonError('Missing entry ID', 400);

    const db = getDb(context.env);

    const entryRows = await db
      .select()
      .from(schema.categoryEntries)
      .where(eq(schema.categoryEntries.id, entryId))
      .limit(1);

    if (entryRows.length === 0) return jsonError('Category entry not found', 404);

    const entry = entryRows[0];
    const { categoryTypeId } = entry;
    const { groupName, categoryName } = await fetchAuditNames(db, entry.groupId, categoryTypeId);

    const deletion = validateEntryDeletion(entry as CategoryEntry, { groupName, categoryName });
    if (!deletion.canDelete) {
      return jsonError(deletion.errorMessage || 'Cannot delete entry', 400);
    }

    const deleteOp = db.delete(schema.categoryEntries).where(eq(schema.categoryEntries.id, entryId));
    const compactionUpdates = deletion.requiresCompaction
      ? await getCompactionUpdatesForRemoval(db, categoryTypeId, entryId)
      : [];

    const auditInsert = buildAuditLog(db, user, 'DELETE_CATEGORY_ENTRY', deletion.auditPayload);

    await db.batch([deleteOp, ...compactionUpdates, auditInsert]);

    return jsonResponse({ message: 'Category entry removed successfully' }, 200);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
