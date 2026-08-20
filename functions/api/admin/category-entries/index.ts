import { and, eq, max } from 'drizzle-orm';
import * as schema from '../../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, fetchAuditNames, buildAuditLog, type EventContext } from '../utils';

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);

    // Fetch entries with group, fire brigade, and category type info
    const entries = await db
      .select({
        id: schema.categoryEntries.id,
        groupId: schema.categoryEntries.groupId,
        categoryTypeId: schema.categoryEntries.categoryTypeId,
        runStatus: schema.categoryEntries.runStatus,
        startOrderPosition: schema.categoryEntries.startOrderPosition,
        attackTimeHundredths: schema.categoryEntries.attackTimeHundredths,
        attackTimeErrors: schema.categoryEntries.attackTimeErrors,
        relayRaceHundredths: schema.categoryEntries.relayRaceHundredths,
        relayRaceErrors: schema.categoryEntries.relayRaceErrors,
        categoryTypeName: schema.categoryTypes.name,
        hasRelayRace: schema.categoryTypes.hasRelayRace,
        groupName: schema.groups.name,
        competitionClass: schema.competitionClasses.name,
        fireBrigadeId: schema.groups.fireBrigadeId,
        fireBrigadeName: schema.fireBrigades.name,
      })
      .from(schema.categoryEntries)
      .innerJoin(schema.groups, eq(schema.categoryEntries.groupId, schema.groups.id))
      .innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id))
      .innerJoin(schema.fireBrigades, eq(schema.groups.fireBrigadeId, schema.fireBrigades.id))
      .innerJoin(schema.categoryTypes, eq(schema.categoryEntries.categoryTypeId, schema.categoryTypes.id))
      .all();

    return jsonResponse(entries, 200);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}

export async function onRequestPost(context: EventContext) {
  try {
    const data: any = await context.request.json();
    const { groupId, categoryTypeId } = data;
    const user = context.data.adminUser || 'system';

    if (!groupId || !categoryTypeId) {
      return jsonError('Missing groupId or categoryTypeId', 400);
    }

    const db = getDb(context.env);

    // Validate group exists
    const groupRows = await db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1);

    if (groupRows.length === 0) {
      return jsonError('Group not found', 404);
    }

    const categoryTypeRows = await db
      .select()
      .from(schema.categoryTypes)
      .where(eq(schema.categoryTypes.id, categoryTypeId))
      .limit(1);
    const resolvedCatType = categoryTypeRows[0];

    if (!resolvedCatType) {
      return jsonError(`Unknown category type '${categoryTypeId}'`, 400);
    }

    // Category eligibility is defined by the database relationship, not a hard-coded name list.
    const group = groupRows[0];
    if ((group as typeof schema.groups.$inferSelect).competitionClassId !== resolvedCatType.competitionClassId) {
      return jsonError(`Incompatible category type '${resolvedCatType.name}' for this group`, 400);
    }

    // Check for duplicate entry
    const existingEntries = await db
      .select()
      .from(schema.categoryEntries)
      .where(
        and(
          eq(schema.categoryEntries.groupId, groupId),
          eq(schema.categoryEntries.categoryTypeId, resolvedCatType.id)
        )
      )
      .limit(1);

    if (existingEntries.length > 0) {
      return jsonError('Group is already registered in this category', 409);
    }

    // Get max start order position for OPEN entries in this category
    const maxPosResult = await db
      .select({ maxPos: max(schema.categoryEntries.startOrderPosition) })
      .from(schema.categoryEntries)
      .where(
        and(
          eq(schema.categoryEntries.categoryTypeId, resolvedCatType.id),
          eq(schema.categoryEntries.runStatus, 'OPEN')
        )
      )
      .get();

    const nextPos = (maxPosResult?.maxPos ?? 0) + 1;
    const newEntryId = crypto.randomUUID();

    // Prepare inserts for db.batch
    const entryInsert = db.insert(schema.categoryEntries).values({
      id: newEntryId,
      groupId,
      categoryTypeId: resolvedCatType.id,
      runStatus: 'OPEN',
      startOrderPosition: nextPos,
      attackTimeHundredths: null,
      attackTimeErrors: null,
      relayRaceHundredths: null,
      relayRaceErrors: null,
    });

    const { groupName, categoryName } = await fetchAuditNames(db, groupId, resolvedCatType.id);

    const auditInsert = buildAuditLog(db, user, 'CREATE_CATEGORY_ENTRY', { entryId: newEntryId, groupId, groupName, categoryTypeId: resolvedCatType.id, categoryName });

    await db.batch([entryInsert, auditInsert]);

    return jsonResponse({ message: 'Category entry added successfully', id: newEntryId }, 201);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
