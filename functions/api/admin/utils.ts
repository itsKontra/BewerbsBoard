import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { normalizeTvPresentation, type StoredCustomLogo } from '../../../shared/domain/tv-presentation';
import type { EventContext } from './_middleware';

// Re-export EventContext for convenience
export type { EventContext };

export function getDb(env: any) {
  const d1 = env?.DB || env?.bewerbsboard;
  if (!d1) {
    throw new Error('D1 Database binding missing in environment (checked env.DB and env.bewerbsboard)');
  }
  return drizzle(d1, { schema });
}

export function getKvStore(env: any) {
  return env?.KV || env?.APP_CONFIG || null;
}

export async function saveCustomLogoToEnv(
  env: any,
  storedLogo: StoredCustomLogo,
  logoUrl: string,
  adminUser: string,
  auditDetails: Record<string, unknown>,
  logAuditFn: typeof logAudit = logAudit
) {
  const kv = getKvStore(env);
  if (kv && typeof kv.put === 'function') {
    await kv.put('tv:custom-logo', JSON.stringify(storedLogo));
    const storedPresentation = await kv.get('tv:presentation');
    const presentation = normalizeTvPresentation(storedPresentation);
    presentation.logoOverride = logoUrl;
    await kv.put('tv:presentation', JSON.stringify(presentation));
  }

  let db;
  try {
    db = getDb(env);
    await db
      .insert(schema.appConfig)
      .values({
        key: 'tv:custom-logo',
        valueJson: JSON.stringify(storedLogo),
        updatedAt: storedLogo.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.appConfig.key,
        set: {
          valueJson: JSON.stringify(storedLogo),
          updatedAt: storedLogo.updatedAt,
        },
      });

    const presRows = await db
      .select()
      .from(schema.appConfig)
      .where(eq(schema.appConfig.key, 'tv:presentation'))
      .limit(1);

    if (presRows.length > 0) {
      const pres = normalizeTvPresentation(JSON.parse(presRows[0].valueJson));
      pres.logoOverride = logoUrl;
      await db
        .update(schema.appConfig)
        .set({
          valueJson: JSON.stringify(pres),
          updatedAt: storedLogo.updatedAt,
        })
        .where(eq(schema.appConfig.key, 'tv:presentation'));
    }
  } catch {
    // fallback if DB binding not available
  }

  if (db) {
    const action = (auditDetails.action as string) || 'UPLOAD_CUSTOM_LOGO';
    await logAuditFn(db, adminUser || 'system', action, auditDetails);
  }
}

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function buildAuditLog(db: any, user: string, action: string, details: any) {
  return db.insert(schema.auditLog).values({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    user,
    action,
    details: details ? JSON.stringify(details) : null,
  });
}

export async function logAudit(db: any, user: string, action: string, details: any) {
  await buildAuditLog(db, user, action, details);
}

export async function fetchAuditNames(db: any, groupId: string, categoryTypeId: string) {
  let groupName = groupId;
  let categoryName = categoryTypeId;

  try {
    const groupRows = await db
      .select({
        groupName: schema.groups.name,
        brigadeName: schema.fireBrigades.name,
      })
      .from(schema.groups)
      .leftJoin(schema.fireBrigades, eq(schema.groups.fireBrigadeId, schema.fireBrigades.id))
      .where(eq(schema.groups.id, groupId))
      .limit(1);

    if (groupRows.length > 0) {
      const { brigadeName, groupName: gName } = groupRows[0];
      groupName = brigadeName ? `${brigadeName} - ${gName}` : gName;
    }

    const categoryRows = await db
      .select({ name: schema.categoryTypes.name })
      .from(schema.categoryTypes)
      .where(eq(schema.categoryTypes.id, categoryTypeId))
      .limit(1);

    if (categoryRows.length > 0) {
      categoryName = categoryRows[0].name;
    }
  } catch (e) {
    console.error('Error fetching audit names:', e);
  }

  return { groupName, categoryName };
}

export async function getCompetitionClassName(db: any, id: string): Promise<string> {
  if (!id) return id;
  const res = await db.select({ name: schema.competitionClasses.name }).from(schema.competitionClasses).where(eq(schema.competitionClasses.id, id)).limit(1);
  return res.length > 0 ? res[0].name : id;
}

export async function getCategoryTypeName(db: any, id: string): Promise<string> {
  if (!id) return id;
  const res = await db.select({ name: schema.categoryTypes.name }).from(schema.categoryTypes).where(eq(schema.categoryTypes.id, id)).limit(1);
  return res.length > 0 ? res[0].name : id;
}

export async function getFireBrigadeName(db: any, id: string): Promise<string> {
  if (!id) return id;
  const res = await db.select({ name: schema.fireBrigades.name }).from(schema.fireBrigades).where(eq(schema.fireBrigades.id, id)).limit(1);
  return res.length > 0 ? res[0].name : id;
}
