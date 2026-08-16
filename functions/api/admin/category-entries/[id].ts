import { and, asc, eq, max, ne } from 'drizzle-orm';
import * as schema from '../../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from '../utils';
import { parseGermanTimeToHundredths } from '../../../../shared/utils/time-parser';
import { computeEntryScore } from '../../../../shared/domain/scoring';

export async function onRequestPut(context: EventContext) {
  try {
    const entryId = context.params?.id as string;
    const user = context.data.adminUser || 'system';

    if (!entryId) {
      return jsonError('Missing entry ID', 400);
    }

    const body = (await context.request.json()) as Record<string, unknown>;

    const db = getDb(context.env);

    // Fetch existing entry
    const entryRows = await db
      .select()
      .from(schema.categoryEntries)
      .where(eq(schema.categoryEntries.id, entryId))
      .limit(1);

    if (entryRows.length === 0) {
      return jsonError('Category entry not found', 404);
    }

    const previousEntry = entryRows[0];
    const categoryTypeId = previousEntry.categoryTypeId;

    const hasRelayRace = (previousEntry as any).hasRelayRace ?? false;

    // 1. Determine attackTimeHundredths
    let newAttackTime: number | null = previousEntry.attackTimeHundredths;
    if ('attackTimeStr' in body) {
      const val = body.attackTimeStr;
      if (val === null || (typeof val === 'string' && val.trim() === '')) {
        newAttackTime = null;
      } else if (typeof val === 'string') {
        const parsed = parseGermanTimeToHundredths(val);
        if (parsed === null) {
          return jsonError(
            'Invalid German decimal time format. Example valid inputs: 42, 42,3, 42,38 (0.01 to 999.99)',
            400
          );
        }
        newAttackTime = parsed;
      }
    } else if (typeof body.attackTimeHundredths === 'number') {
      newAttackTime = body.attackTimeHundredths;
    }

    // 2. Determine attack errors count
    let newAttackErrors: number | null = previousEntry.attackTimeErrors ?? (previousEntry as any).errors ?? null;
    if ('errors' in body || 'attackTimeErrors' in body) {
      const val = 'attackTimeErrors' in body ? body.attackTimeErrors : body.errors;
      if (val === null || (typeof val === 'string' && val.trim() === '')) {
        newAttackErrors = null;
      } else {
        const numErrors = Number(val);
        if (isNaN(numErrors) || numErrors < 0 || !Number.isInteger(numErrors)) {
          return jsonError('Error count must be a non-negative integer', 400);
        }
        newAttackErrors = numErrors;
      }
    }

    // 3. Relay race fields
    let newRelayHundredths: number | null = previousEntry.relayRaceHundredths;
    if ('relayRaceHundredths' in body) {
      newRelayHundredths = typeof body.relayRaceHundredths === 'number' ? body.relayRaceHundredths : null;
    }
    let newRelayErrors: number | null = previousEntry.relayRaceErrors;
    if ('relayRaceErrors' in body) {
      const val = body.relayRaceErrors;
      if (val === null || (typeof val === 'string' && val.trim() === '')) {
        newRelayErrors = null;
      } else {
        const numErrors = Number(val);
        if (isNaN(numErrors) || numErrors < 0 || !Number.isInteger(numErrors)) {
          return jsonError('Relay error count must be a non-negative integer', 400);
        }
        newRelayErrors = numErrors;
      }
    }

    // 4. Determine runStatus
    let targetRunStatus = previousEntry.runStatus;
    if (body.runStatus) {
      if (!['OPEN', 'VALID', 'DNF'].includes(body.runStatus as string)) {
        return jsonError('Invalid runStatus value', 400);
      }
      targetRunStatus = body.runStatus as string;
    } else if (previousEntry.runStatus === 'OPEN' && newAttackTime !== null && newAttackErrors !== null) {
      const needsRelay = hasRelayRace;
      const hasRelay = newRelayHundredths !== null && newRelayErrors !== null;
      if (!needsRelay || hasRelay) {
        targetRunStatus = 'VALID';
      }
    }

    // 5. Determine startOrderPosition
    let newStartOrderPosition: number | null = previousEntry.startOrderPosition;
    if (targetRunStatus !== 'OPEN') {
      newStartOrderPosition = null;
    } else if (previousEntry.runStatus !== 'OPEN') {
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
      newStartOrderPosition = (maxPosResult?.maxPos ?? 0) + 1;
    }

    // Prepare main update query
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

    // Handle compaction if transitioning from OPEN to VALID/DNF
    const compactionUpdates: any[] = [];
    if (previousEntry.runStatus === 'OPEN' && targetRunStatus !== 'OPEN') {
      const remainingOpen = await db
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

      remainingOpen.forEach((e, idx) => {
        compactionUpdates.push(
          db
            .update(schema.categoryEntries)
            .set({ startOrderPosition: idx + 1 })
            .where(eq(schema.categoryEntries.id, e.id))
        );
      });
    }

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

    const auditInsert = db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      user,
      action: 'UPDATE',
      details: JSON.stringify({
        operation: 'UPDATE',
        previous_value: previousEntry,
        new_value: updatedEntryObj,
      }),
    });

    await db.batch([updateQuery, ...compactionUpdates, auditInsert]);

    return jsonResponse(
      {
        message: 'Category entry updated successfully',
        entry: {
          ...updatedEntryObj,
          errors: newAttackErrors,
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

    if (!entryId) {
      return jsonError('Missing entry ID', 400);
    }

    const db = getDb(context.env);

    // Fetch the entry to validate it exists and is OPEN
    const entryRows = await db
      .select()
      .from(schema.categoryEntries)
      .where(eq(schema.categoryEntries.id, entryId))
      .limit(1);

    if (entryRows.length === 0) {
      return jsonError('Category entry not found', 404);
    }

    const entry = entryRows[0];

    if (entry.runStatus !== 'OPEN') {
      return jsonError('Only OPEN entries can be removed', 400);
    }

    const { categoryTypeId } = entry;

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

    const deleteOp = db.delete(schema.categoryEntries).where(eq(schema.categoryEntries.id, entryId));

    const compactionUpdates = remainingEntries.map((e, index) =>
      db
        .update(schema.categoryEntries)
        .set({ startOrderPosition: index + 1 })
        .where(eq(schema.categoryEntries.id, e.id))
    );

    const auditInsert = db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      user,
      action: 'DELETE_CATEGORY_ENTRY',
      details: JSON.stringify({ entryId, categoryTypeId, groupId: entry.groupId }),
    });

    await db.batch([deleteOp, ...compactionUpdates, auditInsert]);

    return jsonResponse({ message: 'Category entry removed successfully' }, 200);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
