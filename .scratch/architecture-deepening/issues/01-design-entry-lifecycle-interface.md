# Issue 01: Design and Implement Pure Entry Lifecycle Domain Module

Status: resolved
Type: task

## Question

How should the pure `applyEntryUpdate` interface in `shared/domain/entry-lifecycle.ts` be defined to encapsulate all category entry mutation rules — including status transitions, automatic promotion from `OPEN` to `VALID`, start-order compaction, score calculation, and audit payload preparation — with 100% test coverage and zero I/O?

## Answer

Designed and implemented the pure domain module [`shared/domain/entry-lifecycle.ts`](file:///d:/developement/web-scoreboard/shared/domain/entry-lifecycle.ts) with full test coverage in [`shared/domain/entry-lifecycle.test.ts`](file:///d:/developement/web-scoreboard/shared/domain/entry-lifecycle.test.ts).

### Key Decisions:
1. **Interface Contract**:
   - `calculateEntryUpdate(existing: CategoryEntry, input: EntryUpdateInput, context: EntryLifecycleContext): EntryUpdateResult`
   - `validateEntryDeletion(existing: CategoryEntry, context?: { groupName?: string; categoryName?: string }): EntryDeletionResult`
2. **Invariants Enforced**:
   - Time and error parsing with strict validation (using `EntryValidationError` with status code 400).
   - Auto-promotion: `OPEN -> VALID` when required fields are present (accounting for `hasRelayRace`).
   - Start-order management: resets `startOrderPosition` to `null` on non-OPEN status, signals `requiresCompaction: true` when leaving `OPEN` status.
   - Score derivation: on-the-fly computation of `scoreHundredths` via `computeEntryScore`.
   - Standardized audit log structure (`{ operation: 'UPDATE' | 'DELETE_CATEGORY_ENTRY', previous_value, new_value }`).
3. **Zero I/O**: Pure in-process computation with no database or network dependencies.
