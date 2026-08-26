import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Reference / Lookup tables
// ---------------------------------------------------------------------------

export const fireBrigades = sqliteTable('fire_brigades', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const competitionClasses = sqliteTable('competition_classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. 'AKTIV', 'JUGEND', 'GAST'
});

export const categoryTypes = sqliteTable('category_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. 'bronze-aktiv', 'silber-aktiv'
  competitionClassId: text('competition_class_id').notNull().references(() => competitionClasses.id),
  hasRelayRace: integer('has_relay_race', { mode: 'boolean' }).notNull().default(true),
});

export const evaluationTypes = sqliteTable('evaluation_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. 'Gesamtwertung Aktiv', 'Einzelwertung Jugend'
  categoryTypeId1: text('category_type_id_1').notNull().references(() => categoryTypes.id),
  categoryTypeId2: text('category_type_id_2').references(() => categoryTypes.id), // nullable
  excludeRelayRace: integer('exclude_relay_race', { mode: 'boolean' }).notNull(),
  /**
   * When true, selects Brigade-Combined Evaluation mode (best-to-best pairing
   * within each fire brigade, e.g. AKTIV vs JUGEND). See CONTEXT.md.
   */
  isBrigadePairing: integer('is_brigade_pairing', { mode: 'boolean' }).notNull().default(false),
  showSingleResults: integer('show_single_results', { mode: 'boolean' }).notNull().default(false),
  public: integer('public', { mode: 'boolean' }).notNull().default(true),
  public_tv: integer('public_tv', { mode: 'boolean' }).notNull().default(true),
  displayDurationSeconds: integer('display_duration_seconds').notNull().default(10),
  order: integer('order').notNull().default(1),
});

// ---------------------------------------------------------------------------
// Core domain tables
// ---------------------------------------------------------------------------

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  fireBrigadeId: text('fire_brigade_id').notNull().references(() => fireBrigades.id),
  competitionClassId: text('competition_class_id').notNull().references(() => competitionClasses.id),
  name: text('name').notNull(),
}, (table) => ({
  unq: unique('groups_fire_brigade_id_name_competition_class_unique').on(
    table.fireBrigadeId,
    table.name,
    table.competitionClassId,
  ),
}));

export const categoryEntries = sqliteTable('category_entries', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),
  categoryTypeId: text('category_type_id').notNull().references(() => categoryTypes.id),
  // 'OPEN' | 'VALID' | 'DNF'
  runStatus: text('run_status').notNull().default('OPEN'),
  startOrderPosition: integer('start_order_position'),
  attackTimeHundredths: integer('attack_time_hundredths'),
  attackTimeErrors: integer('attack_time_errors'),
  relayRaceHundredths: integer('relay_race_hundredths'),
  relayRaceErrors: integer('relay_race_errors'),
}, (table) => ({
  unq: unique('category_entries_group_id_category_type_id_unique').on(
    table.groupId,
    table.categoryTypeId,
  ),
}));

// ---------------------------------------------------------------------------
// Infrastructure tables (unchanged)
// ---------------------------------------------------------------------------

export const tvRuntimeState = sqliteTable('tv_runtime_state', {
  id: text('id').primaryKey(), // single row: 'default'
  mode: text('mode').notNull().default('ROTATION'), // 'ROTATION' | 'FIXED' | 'MESSAGE' | 'WINNERS'
  selectedCategoryId: text('selected_category_id'), // used for FIXED and WINNERS modes
  updatedAt: integer('updated_at'),
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp').notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  details: text('details'),
});

export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
