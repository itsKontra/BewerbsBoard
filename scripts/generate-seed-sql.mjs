import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(repositoryRoot, 'shared', 'seed', 'seed-data.json');
const seedData = JSON.parse(await readFile(seedPath, 'utf8'));

validateSeedData(seedData);
const seedSql = buildSeedSql(seedData.catalog);

for (const relativeDirectory of ['migrations', join('server', 'migrations')]) {
  const directory = join(repositoryRoot, relativeDirectory);
  const migrationFiles = (await readdir(directory)).filter((name) => /^0000_.*\.sql$/.test(name));
  if (migrationFiles.length !== 1) {
    throw new Error(`${relativeDirectory} must contain exactly one 0000_*.sql migration; found ${migrationFiles.length}`);
  }

  const migrationPath = join(directory, migrationFiles[0]);
  const currentSql = await readFile(migrationPath, 'utf8');
  const startMarker = '-- seed-data:start';
  const endMarker = '-- seed-data:end';
  const start = currentSql.indexOf(startMarker);
  const end = currentSql.indexOf(endMarker);
  const nextSql = start >= 0 && end > start
    ? `${currentSql.slice(0, start)}${seedSql}${currentSql.slice(end + endMarker.length)}`
    : `${currentSql.trimEnd()}\n--> statement-breakpoint\n${seedSql}\n`;
  await writeFile(migrationPath, nextSql, 'utf8');
  console.log(`Updated ${relativeDirectory}/${migrationFiles[0]}`);
}

function buildSeedSql(catalog) {
  const statements = [
    insertRows('tv_runtime_state', ['id', 'mode'], [{ id: 'default', mode: 'ROTATION' }]),
    insertRows('competition_classes', ['id', 'name'], catalog.competitionClasses),
    insertRows('category_types', ['id', 'name', 'competition_class_id', 'has_relay_race'], catalog.categoryTypes.map((category) => ({
      id: category.id,
      name: category.name,
      competition_class_id: category.competitionClassId,
      has_relay_race: category.hasRelayRace,
    }))),
    insertRows('evaluation_types', [
      'id',
      'name',
      'category_type_id_1',
      'category_type_id_2',
      'exclude_relay_race',
      'is_brigade_pairing',
      'public',
      'public_tv',
      'display_duration_seconds',
      'order',
    ], catalog.evaluationTypes.map((evaluation) => ({
      id: evaluation.id,
      name: evaluation.name,
      category_type_id_1: evaluation.categoryTypeId1,
      category_type_id_2: evaluation.categoryTypeId2,
      exclude_relay_race: evaluation.excludeRelayRace,
      is_brigade_pairing: evaluation.isBrigadePairing,
      public: evaluation.public,
      public_tv: evaluation.publicTv,
      display_duration_seconds: evaluation.displayDurationSeconds,
      order: evaluation.order,
    }))),
  ];
  return ['-- seed-data:start', ...statements.flatMap((statement, index) => index === 0 ? [statement] : ['--> statement-breakpoint', statement]), '-- seed-data:end'].join('\n');
}

function insertRows(table, columns, rows) {
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const valuesSql = rows.map((row) => `  (${columns.map((column) => quoteValue(row[column])).join(', ')})`).join(',\n');
  return `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES\n${valuesSql};`;
}

function quoteIdentifier(value) {
  return `\`${value.replaceAll('`', '``')}\``;
}

function quoteValue(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validateSeedData(catalogSeedData) {
  const catalog = catalogSeedData?.catalog;
  if (!catalog || !Array.isArray(catalog.competitionClasses) || !Array.isArray(catalog.categoryTypes) || !Array.isArray(catalog.evaluationTypes)) {
    throw new Error('Seed data must contain catalog competitionClasses, categoryTypes, and evaluationTypes arrays');
  }

  assertUnique(catalog.competitionClasses, 'competition class');
  assertUnique(catalog.categoryTypes, 'category type');
  assertUnique(catalog.evaluationTypes, 'evaluation type');
  const competitionClassIds = new Set(catalog.competitionClasses.map(({ id }) => id));
  const categoryTypeIds = new Set(catalog.categoryTypes.map(({ id }) => id));
  for (const category of catalog.categoryTypes) {
    if (!competitionClassIds.has(category.competitionClassId)) throw new Error(`Unknown competition class '${category.competitionClassId}' in category '${category.id}'`);
  }
  for (const evaluation of catalog.evaluationTypes) {
    if (!categoryTypeIds.has(evaluation.categoryTypeId1)) throw new Error(`Unknown primary category '${evaluation.categoryTypeId1}' in evaluation '${evaluation.id}'`);
    if (evaluation.categoryTypeId2 && !categoryTypeIds.has(evaluation.categoryTypeId2)) throw new Error(`Unknown secondary category '${evaluation.categoryTypeId2}' in evaluation '${evaluation.id}'`);
  }
}

function assertUnique(rows, kind) {
  for (const property of ['id', 'name']) {
    const values = rows.map((row) => row[property]);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${kind} ${property} in seed data`);
  }
}
