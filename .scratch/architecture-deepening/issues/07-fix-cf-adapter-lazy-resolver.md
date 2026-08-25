# 07 — Fix `getNextOpenPosition` timing divergence in the CF runtime adapter

Type: task
Status: resolved
Blocked by: 05

## Question

The Cloudflare adapter (`functions/api/admin/category-entries/[id].ts`, lines 81-84) eagerly pre-fetches `nextOpenPos` before calling `calculateEntryUpdate`, even on transitions that never need it (e.g. VALID->VALID). The self-hosted adapter in `scoring-routes.ts` correctly injects a lazy closure. The seam (`EntryLifecycleContext.getNextOpenPosition`) already supports lazy resolution — the CF adapter is just not using it.

**Task:** Remove the eager pre-fetch from the CF handler. Always pass `getNextOpenPosition: () => getNextStartOrderPosition(db, categoryTypeId)` and let the domain module decide when to call it.

**Files:**
- `functions/api/admin/category-entries/[id].ts` — lines 81-84, `onRequestPut`

**Success criteria:**
- Eager `nextOpenPos` pre-fetch removed
- Both adapters pass a lazy resolver (structurally identical pattern)
- All tests pass (the self-hosted route already covers the logic path)

## Answer

Revised the CF handler to be structurally aligned with the self-hosted adapter:
- Removed the second eager check (`body.runStatus === 'OPEN'`) — the domain module does not use this condition; it calls `getNextOpenPosition` whenever `existing.runStatus !== 'OPEN'`, regardless of `body.runStatus` (auto-promotion can also trigger the transition)
- Now pre-fetches `nextOpenPos` only when `previousEntry.runStatus !== 'OPEN'`, which exactly mirrors the domain's internal guard
- Passes as `() => nextOpenPos` — a lazy closure wrapping the already-resolved value, matching the self-hosted pattern structurally
- Added a comment documenting the async constraint: D1 requires pre-resolution because the seam (`getNextOpenPosition`) is synchronous
- All 381 tests pass
