import { and, asc, eq, max, ne } from 'drizzle-orm';
import * as schema from '../../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, fetchAuditNames, buildAuditLog, type EventContext } from '../utils';
import { parseGermanTimeToHundredths } from '../../../../shared/utils/time-parser';
import { computeEntryScore } from '../../../../shared/domain/scoring';

// --- Field Parsers ---

function parseAttackTime(body: Record<string, unknown>, previousTime: number | null): number | null {
  if ('attackTimeStr' in body) {
    const val = body.attackTimeStr;
    if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
    if (typeof val === 'string') {
      const parsed = parseGermanTimeToHundredths(val);
      if (parsed === null) {
        throw new Error('Invalid German decimal time format. Example valid inputs: 42, 42,3, 42,38 (0.01 to 999.99)');
      }
      return parsed;
    }
  } else if (typeof body.attackTimeHundredths === 'number') {
    return body.attackTimeHundredths;
  }
  return previousTime;
}

function parseErrorCount(val: unknown, previousErrors: number | null, errorMessage: string): number | null {
  if (val === undefined) return previousErrors;
  if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
  const numErrors = Number(val);
  if (isNaN(numErrors) || numErrors < 0 || !Number.isInteger(numErrors)) {
    throw new Error(errorMessage);
  }
  return numErrors;
}

function extractAttackErrors(body: Record<string, unknown>, previousErrors: number | null): number | null {
  if ('errors' in body || 'attackTimeErrors' in body) {
    const val = 'attackTimeErrors' in body ? body.attackTimeErrors : body.errors;
    return parseErrorCount(val, previousErrors, 'Error count must be a non-negative integer');
  }
  return previousErrors;
}

function extractRelayHundredths(body: Record<string, unknown>, previousHundredths: number | null): number | null {
  if ('relayRaceHundredths' in body) {
    return typeof body.relayRaceHundredths === 'number' ? body.relayRaceHundredths : null;
  }
  return previousHundredths;
}

function extractRelayErrors(body: Record<string, unknown>, previousErrors: number | null): number | null {
  if ('relayRaceErrors' in body) {
    return parseErrorCount(body.relayRaceErrors, previousErrors, 'Relay error count must be a non-negative integer');
  }
  return previousErrors;
}

function determineTargetRunStatus(
  body: Record<string, unknown>,
  previousStatus: string,
  hasRelayRace: boolean,
  newAttackTime: number | null,
  newAttackErrors: number | null,
  newRelayHundredths: number | null,
  newRelayErrors: number | null
): string {
  if (body.runStatus) {
    if (!['OPEN', 'VALID', 'DNF'].includes(body.runStatus as string)) {
      throw new Error('Invalid runStatus value');
    }
    return body.runStatus as string;
  }

  if (previousStatus === 'OPEN' && newAttackTime !== null && newAttackErrors !== null) {
    const needsRelay = hasRelayRace;
    const hasRelay = newRelayHundredths !== null && newRelayErrors !== null;
    if (!needsRelay || hasRelay) {
      return 'VALID';
    }
  }

  return previousStatus;
}

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
    const hasRelayRace = (previousEntry as any).hasRelayRace ?? false;

    // Parse fields
    let newAttackTime, newAttackErrors, newRelayHundredths, newRelayErrors, targetRunStatus;
    try {
      newAttackTime = parseAttackTime(body, previousEntry.attackTimeHundredths);
      newAttackErrors = extractAttackErrors(body, previousEntry.attackTimeErrors ?? (previousEntry as any).errors ?? null);
      newRelayHundredths = extractRelayHundredths(body, previousEntry.relayRaceHundredths);
      newRelayErrors = extractRelayErrors(body, previousEntry.relayRaceErrors);
      targetRunStatus = determineTargetRunStatus(
        body, previousEntry.runStatus, hasRelayRace, newAttackTime, newAttackErrors, newRelayHundredths, newRelayErrors
      );
    } catch (err: any) {
      return jsonError(err.message, 400);
    }

    // Determine start order position
    let newStartOrderPosition = previousEntry.startOrderPosition;
    if (targetRunStatus !== 'OPEN') {
      newStartOrderPosition = null;
    } else if (previousEntry.runStatus !== 'OPEN') {
      newStartOrderPosition = await getNextStartOrderPosition(db, categoryTypeId);
    }

    // Handle compaction
    const compactionUpdates = previousEntry.runStatus === 'OPEN' && targetRunStatus !== 'OPEN'
      ? await getCompactionUpdatesForRemoval(db, categoryTypeId, entryId)
      : [];

    const updatedEntryObj = {
      id: previousEntry.id,
      groupId: previousEntry.groupId,
      categoryTypeId,
      runStatus: targetRunStatus,
      startOrderPosition: newStartOrderPosition,
      attackTimeHundredths: newAttackTime,
      attackTimeErrors: newAttackErrors,
      relayRaceHundredths: newRelayHundredths,
      relayRaceErrors: newRelayErrors,
    };

    const scoreHundredths = targetRunStatus === 'VALID'
      ? computeEntryScore(updatedEntryObj, { hasRelayRace, excludeRelayRace: false })
      : null;

    // Build updates
    const updateQuery = db
      .update(schema.categoryEntries)
      .set({
        attackTimeHundredths: newAttackTime,
        attackTimeErrors: newAttackErrors,
        relayRaceHundredths: newRelayHundredths,
        relayRaceErrors: newRelayErrors,
        runStatus: targetRunStatus,
        startOrderPosition: newStartOrderPosition,
      })
      .where(eq(schema.categoryEntries.id, entryId));

    const { groupName, categoryName } = await fetchAuditNames(db, previousEntry.groupId, categoryTypeId);
    const auditInsert = buildAuditLog(db, user, 'UPDATE', {
      operation: 'UPDATE',
      previous_value: { ...previousEntry, groupName, categoryName },
      new_value: { ...updatedEntryObj, groupName, categoryName },
    });

    await db.batch([updateQuery, ...compactionUpdates, auditInsert]);

    return jsonResponse(
      {
        message: 'Category entry updated successfully',
        entry: {
          ...updatedEntryObj,
          errors: newAttackErrors, // For legacy/frontend compat
          attackTimeErrors: newAttackErrors,
          scoreHundredths,
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
    if (entry.runStatus !== 'OPEN') return jsonError('Only OPEN entries can be removed', 400);

    const { categoryTypeId } = entry;

    const deleteOp = db.delete(schema.categoryEntries).where(eq(schema.categoryEntries.id, entryId));
    const compactionUpdates = await getCompactionUpdatesForRemoval(db, categoryTypeId, entryId);

    const { groupName, categoryName } = await fetchAuditNames(db, entry.groupId, categoryTypeId);
    const auditInsert = buildAuditLog(db, user, 'DELETE_CATEGORY_ENTRY', {
      operation: 'DELETE',
      previous_value: { entryId, groupId: entry.groupId, groupName, categoryTypeId, categoryName },
      new_value: null
    });

    await db.batch([deleteOp, ...compactionUpdates, auditInsert]);

    return jsonResponse({ message: 'Category entry removed successfully' }, 200);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
