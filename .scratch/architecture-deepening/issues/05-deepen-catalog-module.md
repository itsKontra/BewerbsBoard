# 05 — Deepen `SelfHostedDatabase.catalog` — collapse the mutation protocol

Type: task
Status: resolved
Blocked by: 06

## Question

The `catalog` module inside `SelfHostedDatabase` is shallow: its interface (10+ find/create/has methods) is nearly as complex as its implementation. Constraint logic (duplicate checks, ref-integrity guards, `database.transaction()` calls) lives in `scoring-routes.ts` route handlers, not inside the module. This spreads invariant enforcement across all callers.

**Task:** Move the constraint logic, ref-integrity guards, and transaction boundaries inside `catalog.createCategoryType`, `updateCategoryType`, and `deleteCategoryType`. Route handlers should call one method per mutation and catch a typed error — nothing more.

**Files:**
- `server/database.ts` — `SelfHostedDatabase.catalog` implementation and interface
- `server/scoring-routes.ts` — callers to simplify

**Success criteria:**
- Each mutation route (POST /category-types, PUT /category-types/:id, DELETE /category-types/:id) calls exactly one `catalog` method
- Duplicate-check, ref-integrity, and transaction are inside the module
- All 58 test files continue to pass
- Same pattern applied to evaluationTypes CRUD where applicable

## Answer

Moved all constraint logic and transaction management inside the catalog module in `server/database.ts`:
- Exported 4 typed error classes: `DuplicateCatalogItemError`, `InvalidCatalogReferenceError`, `CatalogItemHasEntriesError`, `CatalogItemHasEvaluationsError`
- `createCategoryType`: validates competitionClassId exists + name unique → transaction wraps insert → throws typed errors
- `updateCategoryType`: validates ref-integrity + name uniqueness if changed → transaction wraps update
- `deleteCategoryType`: checks hasEntries + hasEvaluations → throws typed errors → transaction wraps delete
- Same deepening applied to `createEvaluationType`, `updateEvaluationType`, `deleteEvaluationType`
- Removed from interface: `findCategoryTypeByName`, `hasEntriesForCategoryType`, `hasEvaluationsForCategoryType` (these were internal query helpers; no public caller needed them directly)
- Simplified `scoring-routes.ts`: each mutation handler now calls one catalog method and catches typed errors
- Removed 4 private error classes from routes (`DuplicateCategoryTypeError`, `InvalidCompetitionClassReferenceError`, `DuplicateEvaluationTypeError`, `InvalidCategoryReferenceError`) — replaced by the exported catalog errors
- Updated `server/database.test.ts` to test constraint behavior through the deep interface (error assertions) rather than internal state helpers
- All 381 tests pass.
