import { eq } from 'drizzle-orm';
import * as schema from '../../../shared/db/schema';
import { getDb, jsonResponse, jsonError, logAudit, type EventContext } from './utils';

const VALID_MODES = ['ROTATION', 'FIXED', 'MESSAGE', 'WINNERS'] as const;
type TvMode = typeof VALID_MODES[number];

async function getOrCreateTvState(db: ReturnType<typeof getDb>) {
  const rows = await db.select().from(schema.tvRuntimeState).where(eq(schema.tvRuntimeState.id, 'default')).all();
  if (rows.length > 0) {
    return rows[0];
  }
  // Create default row
  const defaultState = {
    id: 'default',
    mode: 'ROTATION' as TvMode,
    selectedCategoryId: null,
    updatedAt: Date.now(),
  };
  await db.insert(schema.tvRuntimeState).values(defaultState);
  return defaultState;
}

export async function onRequestGet(context: EventContext) {
  try {
    const db = getDb(context.env);
    const state = await getOrCreateTvState(db);
    return jsonResponse(state);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}

export async function onRequestPut(context: EventContext) {
  try {
    const body = await context.request.json();
    const db = getDb(context.env);

    const mode = body.mode as string;
    if (!mode || !VALID_MODES.includes(mode as TvMode)) {
      return jsonError(`Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`, 400);
    }

    // selectedCategoryId required for FIXED and WINNERS modes
    const selectedCategoryId: string | null = body.selectedCategoryId ?? null;
    if ((mode === 'FIXED' || mode === 'WINNERS') && !selectedCategoryId) {
      return jsonError(`selectedCategoryId is required for ${mode} mode`, 400);
    }

    const previousState = await getOrCreateTvState(db);

    const updatedAt = Date.now();
    await db
      .update(schema.tvRuntimeState)
      .set({
        mode,
        selectedCategoryId,
        updatedAt,
      })
      .where(eq(schema.tvRuntimeState.id, 'default'));

    const newState = { id: 'default', mode, selectedCategoryId, updatedAt };

    const adminUser = context.data.adminUser || 'system';
    await logAudit(db, adminUser, 'UPDATE_TV_STATE', {
      operation: 'UPDATE',
      previous_value: previousState,
      new_value: newState,
    });

    return jsonResponse(newState);
  } catch (err: any) {
    return jsonError(err.message, 500);
  }
}
