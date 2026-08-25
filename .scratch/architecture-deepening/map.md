# Map: Architecture Deepening and Storage Unification

## Destination

A deepened, unified codebase architecture where:
1. Category entry mutation and lifecycle rules (status transitions, `OPEN` -> `VALID` auto-promotion, start-order compaction, score derivation, and audit payload assembly) live in a single pure deep domain module (`shared/domain/entry-lifecycle.ts`) used identically by Cloudflare Pages Functions and Self-Hosted Hono routes.
2. The Self-Hosted server storage layer (`server/database.ts`) is migrated to Drizzle ORM over `better-sqlite3` using the shared schema (`shared/db/schema.ts`), eliminating divergent raw SQL queries and establishing true storage parity with Cloudflare D1.
3. `SelfHostedDatabase.catalog` is a deep module: all constraint logic (duplicate checks, ref-integrity guards, transaction boundaries) lives behind the seam — routes call one method per mutation.
4. The test seam is clean: `scoring-routes.test.ts` seeds via `database.catalog` methods, not raw SQL.
5. The Cloudflare and Self-Hosted adapters for `entry-lifecycle` are structurally identical: both pass a lazy `getNextOpenPosition` resolver.
6. `updateEntry` in `scoring-routes.ts` is either inlined or documented as a handler alias — not mistaken for a deep module.

## Notes

- **Domain**: Refer to [CONTEXT.md](file:///d:/developement/web-scoreboard/CONTEXT.md) for domain terminology.
- **Skills**: Adhere to [codebase-design](file:///d:/developement/web-scoreboard/.agents/skills/codebase-design/SKILL.md) and [DEEPENING.md](file:///d:/developement/web-scoreboard/.agents/skills/codebase-design/DEEPENING.md) (deep modules, in-process computation, seam discipline).
- **Parity**: Both deployment variants (Cloudflare Pages edge vs. Docker self-hosted container) must preserve identical API and audit behavior.
- **Architecture vocabulary**: module, interface, implementation, depth, seam, adapter, leverage, locality — from [codebase-design](file:///d:/developement/web-scoreboard/.agents/skills/codebase-design/SKILL.md).

## Decisions so far

- [01-design-entry-lifecycle-interface](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/01-design-entry-lifecycle-interface.md) — Created pure `shared/domain/entry-lifecycle.ts` module handling status transitions, auto-promotion, compaction flags, score derivation, and audit generation.
- [03-integrate-entry-lifecycle-into-routes](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/03-integrate-entry-lifecycle-into-routes.md) — Refactored Cloudflare Pages Functions and Self-Hosted Hono routes to delegate all entry lifecycle and deletion validations to `shared/domain/entry-lifecycle.ts`.
- [02-research-drizzle-better-sqlite3-parity](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/02-research-drizzle-better-sqlite3-parity.md) — Researched Drizzle Better-SQLite3 synchronous execution, schema sharing with Cloudflare D1, and migration roadmap for `server/database.ts`.
- [04-migrate-server-database-to-drizzle](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/04-migrate-server-database-to-drizzle.md) — Migrated `server/database.ts` from raw SQL `sqlite.prepare` queries to type-safe Drizzle ORM queries over `shared/db/schema.ts`.
- [06-fix-seedcatalog-test-seam](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/06-fix-seedcatalog-test-seam.md) — Replaced raw-SQL `seedCatalog` helper with `database.catalog.createCategoryType/createEvaluationType` calls; removed `database.drizzle` dependency from test layer.
- [05-deepen-catalog-module](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/05-deepen-catalog-module.md) — Deepened `SelfHostedDatabase.catalog`: moved duplicate-check, ref-integrity, and transaction logic inside `createCategoryType/updateCategoryType/deleteCategoryType` and eval type equivalents. Exported 4 typed error classes. Routes now call one method per mutation.
- [07-fix-cf-adapter-lazy-resolver](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/07-fix-cf-adapter-lazy-resolver.md) — Removed double-condition eager fetch from CF handler; now pre-fetches `nextOpenPos` only when `runStatus !== 'OPEN'`, matching the domain's internal guard exactly. Both adapters are now structurally equivalent.
- [08-clarify-updateentry-handler-alias](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/08-clarify-updateentry-handler-alias.md) — Added JSDoc to `updateEntry` declaring it a handler alias, not a module or seam, with explicit guidance not to grow it.

## Not yet specified

- **Shared Repository Helpers**: Whether to extract common query builders (e.g., joined entry detail queries) into a shared Drizzle query helper module across D1 and Better-SQLite3.
- **Client State Unification**: Alignment of TV and public mobile data polling hooks once backend endpoints share unified response contracts.

## Out of scope

- Visual styling or layout modifications to the Television Scoreboard (`/tv`) or Admin views (`/admin`).
- Breaking changes to existing Drizzle schema tables or SQLite columns.
- Modifying authentication mechanisms (local cookie vs Cloudflare Access).
