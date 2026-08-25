# Issue 04: Migrate Server Database Layer to Drizzle ORM

Status: open
Type: task
Blocked by: 02

## Question

How should `server/database.ts` be systematically refactored to execute type-safe Drizzle queries (`drizzle(sqlite, { schema })`) instead of raw SQL `sqlite.prepare` statements, ensuring the existing `SelfHostedDatabase` interface remains satisfied and existing route tests pass?
