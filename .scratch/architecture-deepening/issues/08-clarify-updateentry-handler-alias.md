# 08 — Clarify `updateEntry` as a handler alias, not a module

Type: task
Status: resolved
Blocked by: 05

## Question

`updateEntry` in `scoring-routes.ts` (lines 307-336) is a shallow pass-through extracted only to share PUT and PATCH handlers. It fails the deletion test: removing it concentrates no complexity; it just merges into two identical inline route handler bodies. There is no seam, no locality gain, and no interface to test through.

**Task:** Either inline `updateEntry` into the PUT and PATCH handlers, or keep it as an explicit handler alias but document it clearly as such (not a module, not a seam). If kept, add a comment making its purpose unambiguous so future maintainers don't grow it.

**Files:**
- `server/scoring-routes.ts` — `updateEntry` function and its callers

**Success criteria:**
- `updateEntry` is either gone (inlined) or clearly documented as a handler alias only
- No logic has been added to it
- All tests pass

## Answer

Added a JSDoc comment to `updateEntry` that:
- Names it explicitly as a "handler alias — shared by PUT and PATCH /api/admin/category-entries/:id"
- Declares it is "a deduplication helper, not a module or seam"
- States it "should not grow any [independent logic]"
- Gives a future instruction: "If constraint or domain logic accumulates here, promote it to a proper seam at that point"

Decided to keep it rather than inlining — the extraction is 6 lines cheaper than two identical 30-line handlers, and a clear comment stops it from being misread as an abstraction. All 381 tests pass.
