import { describe, expect, it } from 'vitest';

import { createDemoData, createEvaluationTypeViews, DEFAULT_CATALOG_SEED } from './seed-data.js';

describe('canonical seed data', () => {
  it('projects normalized catalog and demo rows into coherent public data', () => {
    const demo = createDemoData(1_000_000);
    const evaluationTypes = createEvaluationTypeViews();

    expect(demo.competitionClasses).toEqual(DEFAULT_CATALOG_SEED.competitionClasses);
    expect(demo.categoryEntries).toHaveLength(11);
    expect(demo.categoryEntries.find(({ id }) => id === 'ce-2')?.scoreHundredths).toBe(9460);
    expect(Object.keys(demo.publicResults.categories)).toEqual(evaluationTypes.map(({ id }) => id));
    expect(demo.publicTvState.categoriesConfig).toEqual(expect.objectContaining({
      'gesamt-feuerwehr': expect.objectContaining({ tvEnabled: true, order: 8 }),
    }));
  });
});
