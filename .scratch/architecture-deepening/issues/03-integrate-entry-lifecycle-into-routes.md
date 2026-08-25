# Issue 03: Refactor Cloudflare Functions and Self-Hosted Routes to use Entry Lifecycle Module

Status: resolved
Type: task
Blocked by: 01

## Question

How should `functions/api/admin/category-entries/[id].ts` and `server/scoring-routes.ts` be refactored to replace their redundant mutation code with calls to `calculateEntryUpdate` and `validateEntryDeletion` from `shared/domain/entry-lifecycle.ts`, verifying identical responses and passing integration tests across both backends?

## Answer

Refactored both backend mutation adapters to delegate entry mutation, auto-promotion, start-order compaction, and deletion validation to the unified `shared/domain/entry-lifecycle.ts` module.

### Changes Made:
1. **Cloudflare Edge Adapter ([`functions/api/admin/category-entries/[id].ts`](file:///d:/developement/web-scoreboard/functions/api/admin/category-entries/%5Bid%5D.ts))**:
   - Replaced duplicate field parsing, status transition, auto-promotion, and validation functions with calls to `calculateEntryUpdate` and `validateEntryDeletion`.
   - Maintained Drizzle transaction batching for entry updates, start-order compactions, and audit logging.
2. **Self-Hosted Hono Adapter ([`server/scoring-routes.ts`](file:///d:/developement/web-scoreboard/server/scoring-routes.ts))**:
   - Replaced redundant parsing and auto-promotion code in `updateEntry` with `calculateEntryUpdate`.
   - Integrated `validateEntryDeletion` into the `DELETE /api/admin/category-entries/:id` route handler.
3. **Verification**:
   - All 58 test suites (381 tests) passed across both Cloudflare and Self-Hosted server test suites.
   - `npm run build` compiled both client and server bundles cleanly.
