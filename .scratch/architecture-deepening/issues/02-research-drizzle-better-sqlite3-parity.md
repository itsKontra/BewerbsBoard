# Issue 02: Research Drizzle ORM Integration with Better-SQLite3 for Self-Hosted Server

Status: resolved
Type: research

## Question

How can Drizzle ORM (`drizzle-orm/better-sqlite3`) be integrated into `server/database.ts` and `server/index.ts` to replace raw SQL queries while maintaining compatibility with Better-SQLite3 synchronous execution, WAL mode, migrations, and existing transaction boundaries?

## Answer

### 1. Architectural Findings

1. **Synchronous Execution Model**:
   - `drizzle-orm/better-sqlite3` is fully synchronous: `.all()`, `.get()`, `.run()`, and `.values()` execute synchronously against `better-sqlite3`.
   - This aligns with the synchronous contract of `SelfHostedDatabase`, allowing seamless replacement without changing caller method signatures.

2. **Schema & Types Sharing**:
   - The Drizzle schema is already defined in [`shared/db/schema.ts`](file:///d:/developement/web-scoreboard/shared/db/schema.ts).
   - Initializing Drizzle with `const database = drizzle(sqlite, { schema })` provides type-safe relational and query-builder APIs matching Cloudflare D1.

3. **Pragmas, WAL Mode, and Migrations**:
   - WAL mode, foreign keys, synchronous full, and busy timeout pragmas on `sqlite` are preserved prior to initializing Drizzle.
   - Migrations via `migrate(database, { migrationsFolder: resolve('server/migrations') })` remain unchanged.

4. **Query Migration Patterns**:
   - **Simple Table Operations**:
     - Replace `sqlite.prepare('SELECT id, name FROM fire_brigades').all()` with `database.select().from(schema.fireBrigades).all()`.
     - Replace `sqlite.prepare('INSERT INTO fire_brigades ... RETURNING ...')` with `database.insert(schema.fireBrigades).values(...).returning().get()`.
   - **Joined Views**:
     - Groups join: `database.select({ id: schema.groups.id, fireBrigadeId: schema.groups.fireBrigadeId, name: schema.groups.name, competitionClassId: schema.groups.competitionClassId, competitionClass: schema.competitionClasses.name }).from(schema.groups).innerJoin(schema.competitionClasses, eq(schema.groups.competitionClassId, schema.competitionClasses.id)).all()`.
     - Entry details join: uses standard `innerJoin` on `groups`, `competitionClasses`, `fireBrigades`, and `categoryTypes`.
   - **Transactions**:
     - `database.transaction((tx) => ...)` executes inside a synchronous SQLite savepoint/transaction, maintaining ACID guarantees.

### 2. Migration Plan for Ticket 04
1. Update `createDatabase` in [`server/database.ts`](file:///d:/developement/web-scoreboard/server/database.ts) to pass `{ schema }` to `drizzle(sqlite, { schema })`.
2. Migrate sub-repositories systematically:
   - `administration` (brigades, groups, competition classes)
   - `catalog` (category types, evaluation types)
   - `scoring` (category entries, start-order queries, compactions)
   - `audit` (audit logs recording and paginated retrieval)
   - `dataManagement` (export payload building, preflight counts, batch import)
3. Validate against all backend test suites (`server/database.test.ts`, `server/*.test.ts`).
