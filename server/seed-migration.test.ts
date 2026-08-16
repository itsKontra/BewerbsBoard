import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CATALOG_SEED } from '../shared/seed/seed-data.js';
import { createDatabase } from './database.js';

describe('fresh self-hosted database seed', () => {
  it('loads the canonical catalog through the consolidated migration', () => {
    const database = createDatabase(':memory:');
    try {
      expect(database.administration.listCompetitionClasses()).toEqual(
        [...DEFAULT_CATALOG_SEED.competitionClasses].sort((left, right) => left.name.localeCompare(right.name)),
      );
      expect(database.catalog.listCategoryTypes()).toEqual(
        [...DEFAULT_CATALOG_SEED.categoryTypes].sort((left, right) => left.name.localeCompare(right.name)),
      );
      expect(database.catalog.listEvaluationTypes().map(({ id }) => id)).toEqual(
        DEFAULT_CATALOG_SEED.evaluationTypes.map(({ id }) => id),
      );
      expect(database.getTvRuntimeState()).toMatchObject({ id: 'default', mode: 'ROTATION' });
    } finally {
      database.close();
    }
  });

  it('keeps both fresh database migrations on the generated catalog seed', () => {
    const rootSeed = readSeedBlock('migrations');
    const selfHostedSeed = readSeedBlock('server/migrations');

    expect(selfHostedSeed).toBe(rootSeed);
    for (const row of DEFAULT_CATALOG_SEED.evaluationTypes) {
      expect(rootSeed).toContain(`'${row.id}'`);
    }
  });
});

function readSeedBlock(directory: string): string {
  const absoluteDirectory = resolve(directory);
  const migrations = readdirSync(absoluteDirectory).filter((name) => /^0000_.*\.sql$/.test(name));
  expect(migrations).toHaveLength(1);
  const sql = readFileSync(resolve(absoluteDirectory, migrations[0]), 'utf8');
  const match = sql.match(/-- seed-data:start[\s\S]*-- seed-data:end/);
  expect(match).not.toBeNull();
  return match?.[0] ?? '';
}
