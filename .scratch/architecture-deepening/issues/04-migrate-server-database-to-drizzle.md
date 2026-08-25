# Issue 04: Migrate Server Database Layer to Drizzle ORM

Status: resolved
Type: task
Blocked by: 02

## Question

How should `server/database.ts` be systematically refactored to execute type-safe Drizzle queries (`drizzle(sqlite, { schema })`) instead of raw SQL `sqlite.prepare` statements, ensuring the existing `SelfHostedDatabase` interface remains satisfied and existing route tests pass?

## Answer

Migrated all repository implementations in [`server/database.ts`](file:///d:/developement/web-scoreboard/server/database.ts) to execute Drizzle ORM queries over the shared schema ([`shared/db/schema.ts`](file:///d:/developement/web-scoreboard/shared/db/schema.ts)).

### Key Changes:
1. **Drizzle Initialization with Shared Schema**:
   - Initialized Drizzle instance with `const database = drizzle(sqlite, { schema })`.
2. **Repository Query Migrations**:
   - **`administration`**: Replaced raw SQL queries for fire brigades, groups, and competition classes with Drizzle query builders (`database.select()`, `database.insert()`, `database.update()`, `database.delete()`) and relational joins.
   - **`catalog`**: Replaced category types and evaluation types queries with Drizzle queries over `schema.categoryTypes` and `schema.evaluationTypes`.
   - **`scoring`**: Replaced raw queries for category entries, multi-table joined entry details, start-order position computations (`max()`), and compaction updates with Drizzle statements.
   - **`audit`**: Migrated audit logging and paginated searches with `like()` filters and `count()` aggregations to Drizzle.
   - **`dataManagement`**: Converted export tables, preflight existence checks, and bulk upserts (`onConflictDoUpdate`) to type-safe Drizzle expressions.
   - **`tvRuntimeState`**: Converted state read/write operations to Drizzle queries.
3. **Interface Integrity & Verification**:
   - Preserved `SelfHostedDatabase` interface without breaking changes.
   - 100% test pass rate across all 58 test files (381 tests) and successful production builds (`npm run build`).
