# Map: Architecture Deepening and Storage Unification

## Destination

A deepened, unified codebase architecture where:
1. Category entry mutation and lifecycle rules (status transitions, `OPEN` -> `VALID` auto-promotion, start-order compaction, score derivation, and audit payload assembly) live in a single pure deep domain module (`shared/domain/entry-lifecycle.ts`) used identically by Cloudflare Pages Functions and Self-Hosted Hono routes.
2. The Self-Hosted server storage layer (`server/database.ts`) is migrated to Drizzle ORM over `better-sqlite3` using the shared schema (`shared/db/schema.ts`), eliminating divergent raw SQL queries and establishing true storage parity with Cloudflare D1.

## Notes

- **Domain**: Refer to [CONTEXT.md](file:///d:/developement/web-scoreboard/CONTEXT.md) for domain terminology.
- **Skills**: Adhere to [codebase-design](file:///d:/developement/web-scoreboard/.agents/skills/codebase-design/SKILL.md) and [DEEPENING.md](file:///d:/developement/web-scoreboard/.agents/skills/codebase-design/DEEPENING.md) (deep modules, in-process computation, seam discipline).
- **Parity**: Both deployment variants (Cloudflare Pages edge vs. Docker self-hosted container) must preserve identical API and audit behavior.

## Decisions so far

- [01-design-entry-lifecycle-interface](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/01-design-entry-lifecycle-interface.md) — Created pure `shared/domain/entry-lifecycle.ts` module handling status transitions, auto-promotion, compaction flags, score derivation, and audit generation.
- [03-integrate-entry-lifecycle-into-routes](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/03-integrate-entry-lifecycle-into-routes.md) — Refactored Cloudflare Pages Functions and Self-Hosted Hono routes to delegate all entry lifecycle and deletion validations to `shared/domain/entry-lifecycle.ts`.
- [02-research-drizzle-better-sqlite3-parity](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/02-research-drizzle-better-sqlite3-parity.md) — Researched Drizzle Better-SQLite3 synchronous execution, schema sharing with Cloudflare D1, and migration roadmap for `server/database.ts`.
- [04-migrate-server-database-to-drizzle](file:///d:/developement/web-scoreboard/.scratch/architecture-deepening/issues/04-migrate-server-database-to-drizzle.md) — Migrated `server/database.ts` from raw SQL `sqlite.prepare` queries to type-safe Drizzle ORM queries over `shared/db/schema.ts`.

## Not yet specified

- **Shared Repository Helpers**: Whether to extract common query builders (e.g., joined entry detail queries) into a shared Drizzle query helper module across D1 and Better-SQLite3.
- **Client State Unification**: Alignment of TV and public mobile data polling hooks once backend endpoints share unified response contracts.

## Out of scope

- Visual styling or layout modifications to the Television Scoreboard (`/tv`) or Admin views (`/admin`).
- Breaking changes to existing Drizzle schema tables or SQLite columns.
- Modifying authentication mechanisms (local cookie vs Cloudflare Access).
