# 06 — Fix `seedCatalog` test helper — replace raw SQL with catalog interface calls

Type: task
Status: resolved

## Question

`scoring-routes.test.ts` seeds test data using `database.drizzle.run(sql`INSERT OR IGNORE...`)`, bypassing `database.catalog` entirely. This is a seam violation: the test crosses the implementation boundary, not the interface. Bugs in `createCategoryType` and `createEvaluationType` can hide, and schema changes silently break fixtures.

**Task:** Replace `seedCatalog` with calls to `database.catalog.createCategoryType` and `database.catalog.createEvaluationType` (or equivalent). Delete the raw-SQL helper and the `database.drizzle` dependency in tests.

**Files:**
- `server/scoring-routes.test.ts` — `seedCatalog` function (lines 10-26)

**Success criteria:**
- `seedCatalog` removed; replaced with direct catalog method calls
- `database.drizzle` no longer imported or used in this test file
- All existing test assertions still pass

## Answer

## Answer

Replaced the raw-SQL seedCatalog helper in server/scoring-routes.test.ts with calls through the proper module interfaces:
- database.catalog.createCategoryType() for both bronze-aktiv and silber-aktiv category types
- database.catalog.createEvaluationType() for both evaluation types
- Competition class creation removed entirely — migrations already seed AKTIV/JUGEND/GAST
- Inline database.drizzle.run(sql...) calls in the brigade-combined test similarly replaced
- import { sql } from 'drizzle-orm' removed from the test file

All 381 tests pass. The test seam now crosses the catalog interface identically to production code.
