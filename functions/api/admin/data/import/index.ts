import { getDb, jsonResponse, jsonError, buildAuditLog, type EventContext } from '../../utils';
import * as schema from '../../../../../shared/db/schema';
import { validateDataExportEnvelope } from '../../../../../shared/domain/data-management';

export async function onRequestPost(context: EventContext) {
  try {
    const body = await context.request.json().catch(() => null);
    const validation = validateDataExportEnvelope(body);
    if (!validation.isValid || !validation.envelope) {
      return jsonError(`Ungültige Importdaten: ${validation.errors.join('; ')}`, 400);
    }

    const db = getDb(context.env);
    const user = (context.data?.adminUser as string) || 'system';
    const data = validation.envelope.data;

    // Build batch of operations with onConflictDoUpdate
    const operations: any[] = [];

    // 1. app_config
    for (const item of data.appConfig) {
      operations.push(
        db.insert(schema.appConfig)
          .values({
            key: item.key,
            valueJson: item.valueJson,
            updatedAt: item.updatedAt ?? Date.now(),
          })
          .onConflictDoUpdate({
            target: schema.appConfig.key,
            set: {
              valueJson: item.valueJson,
              updatedAt: item.updatedAt ?? Date.now(),
            },
          })
      );
    }

    // 2. competition_classes
    for (const item of data.competitionClasses) {
      operations.push(
        db.insert(schema.competitionClasses)
          .values({
            id: item.id,
            name: item.name,
          })
          .onConflictDoUpdate({
            target: schema.competitionClasses.id,
            set: {
              name: item.name,
            },
          })
      );
    }

    // 3. fire_brigades
    for (const item of data.fireBrigades) {
      operations.push(
        db.insert(schema.fireBrigades)
          .values({
            id: item.id,
            name: item.name,
          })
          .onConflictDoUpdate({
            target: schema.fireBrigades.id,
            set: {
              name: item.name,
            },
          })
      );
    }

    // 4. category_types
    for (const item of data.categoryTypes) {
      operations.push(
        db.insert(schema.categoryTypes)
          .values({
            id: item.id,
            name: item.name,
            competitionClassId: item.competitionClassId,
            hasRelayRace: item.hasRelayRace,
          })
          .onConflictDoUpdate({
            target: schema.categoryTypes.id,
            set: {
              name: item.name,
              competitionClassId: item.competitionClassId,
              hasRelayRace: item.hasRelayRace,
            },
          })
      );
    }

    // 5. evaluation_types
    for (const item of data.evaluationTypes) {
      const publicTv = item.publicTv !== undefined ? item.publicTv : item.public_tv;
      operations.push(
        db.insert(schema.evaluationTypes)
          .values({
            id: item.id,
            name: item.name,
            categoryTypeId1: item.categoryTypeId1,
            categoryTypeId2: item.categoryTypeId2 ?? null,
            excludeRelayRace: item.excludeRelayRace,
            isBrigadePairing: item.isBrigadePairing,
            public: item.public !== false,
            public_tv: publicTv !== false,
            displayDurationSeconds: item.displayDurationSeconds ?? 10,
            order: item.order ?? 1,
          })
          .onConflictDoUpdate({
            target: schema.evaluationTypes.id,
            set: {
              name: item.name,
              categoryTypeId1: item.categoryTypeId1,
              categoryTypeId2: item.categoryTypeId2 ?? null,
              excludeRelayRace: item.excludeRelayRace,
              isBrigadePairing: item.isBrigadePairing,
              public: item.public !== false,
              public_tv: publicTv !== false,
              displayDurationSeconds: item.displayDurationSeconds ?? 10,
              order: item.order ?? 1,
            },
          })
      );
    }

    // 6. groups
    for (const item of data.groups) {
      operations.push(
        db.insert(schema.groups)
          .values({
            id: item.id,
            fireBrigadeId: item.fireBrigadeId,
            competitionClassId: item.competitionClassId,
            name: item.name,
          })
          .onConflictDoUpdate({
            target: schema.groups.id,
            set: {
              fireBrigadeId: item.fireBrigadeId,
              competitionClassId: item.competitionClassId,
              name: item.name,
            },
          })
      );
    }

    // 7. category_entries
    for (const item of data.categoryEntries) {
      operations.push(
        db.insert(schema.categoryEntries)
          .values({
            id: item.id,
            groupId: item.groupId,
            categoryTypeId: item.categoryTypeId,
            runStatus: item.runStatus ?? 'OPEN',
            startOrderPosition: item.startOrderPosition ?? null,
            attackTimeHundredths: item.attackTimeHundredths ?? null,
            attackTimeErrors: item.attackTimeErrors ?? null,
            relayRaceHundredths: item.relayRaceHundredths ?? null,
            relayRaceErrors: item.relayRaceErrors ?? null,
          })
          .onConflictDoUpdate({
            target: schema.categoryEntries.id,
            set: {
              groupId: item.groupId,
              categoryTypeId: item.categoryTypeId,
              runStatus: item.runStatus ?? 'OPEN',
              startOrderPosition: item.startOrderPosition ?? null,
              attackTimeHundredths: item.attackTimeHundredths ?? null,
              attackTimeErrors: item.attackTimeErrors ?? null,
              relayRaceHundredths: item.relayRaceHundredths ?? null,
              relayRaceErrors: item.relayRaceErrors ?? null,
            },
          })
      );
    }

    const totalEntities =
      data.appConfig.length +
      data.competitionClasses.length +
      data.fireBrigades.length +
      data.categoryTypes.length +
      data.evaluationTypes.length +
      data.groups.length +
      data.categoryEntries.length;

    // Audit log operation
    const auditOperation = buildAuditLog(db, user, 'DATA_IMPORT', {
      totalEntities,
      importedAt: new Date().toISOString(),
    });
    operations.push(auditOperation);

    if (operations.length > 0) {
      await db.batch(operations as any);
    }

    return jsonResponse({
      message: 'Daten erfolgreich importiert',
      totalEntities,
    });
  } catch (err: any) {
    return jsonError(err.message || 'Import fehlgeschlagen', 500);
  }
}
