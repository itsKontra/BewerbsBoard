import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
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

export async function logAudit(db: any, user: string, action: string, details: any) {
  await db.insert(schema.auditLog).values({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    user,
    action,
    details: details ? JSON.stringify(details) : null,
  });
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
      groupName = `${groupRows[0].brigadeName} - ${groupRows[0].groupName}`;
    }

    const categoryRows = await db
      .select({ name: schema.categoryTypes.name })
      .from(schema.categoryTypes)
      .where(eq(schema.categoryTypes.id, categoryTypeId))
      .limit(1);

    if (categoryRows.length > 0) {
      categoryName = categoryRows[0].name;
    }
  } catch (err) {
    console.error('Error fetching audit names:', err);
  }

  return { groupName, categoryName };
}
