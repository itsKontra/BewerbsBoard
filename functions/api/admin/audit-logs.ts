import { desc, like, or, count } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, type EventContext } from './utils';

export async function onRequestGet(context: EventContext) {
  try {
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';

    const db = getDb(context.env);

    let whereClause = undefined;
    if (search) {
      const searchPattern = `%${search}%`;
      whereClause = or(
        like(schema.auditLog.user, searchPattern),
        like(schema.auditLog.action, searchPattern),
        like(schema.auditLog.details, searchPattern)
      );
    }

    // Get total count
    const totalCountQuery = db
      .select({ count: count() })
      .from(schema.auditLog);

    const totalCountResult = whereClause
      ? await totalCountQuery.where(whereClause)
      : await totalCountQuery;

    const total = totalCountResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    // Get paginated logs
    const logsQuery = db
      .select()
      .from(schema.auditLog);

    const logs = whereClause
      ? await logsQuery
          .where(whereClause)
          .orderBy(desc(schema.auditLog.timestamp))
          .limit(limit)
          .offset(offset)
      : await logsQuery
          .orderBy(desc(schema.auditLog.timestamp))
          .limit(limit)
          .offset(offset);

    return jsonResponse({
      logs,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
