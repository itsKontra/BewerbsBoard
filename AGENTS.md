# Agent Guidelines — web-scoreboard

## Command Execution (Windows / PowerShell Environment)

Always be careful when executing commands in the Windows / PowerShell environment.

- **NPM / NPX scripts**: To avoid `.ps1` execution policy restrictions in PowerShell, invoke them directly using their `.cmd` wrappers (e.g., `npm.cmd run test` or `npx.cmd drizzle-kit generate`) instead of using `cmd /c`.
- **Chaining Commands**: If you need to chain commands, use PowerShell's `;` operator instead of `&&`, or run them as separate tool calls. 
- **Git and Quoting**: **Do NOT** wrap `git commit` or any command with complex nested quotes in `cmd /c "..."`. Windows `cmd.exe` parses quotes unpredictably, which will cause pathspec errors. Run these directly in PowerShell (e.g., `git commit -m "Your message"`).

## UI Debugging & Testing (Playwright)

Playwright is installed and available for UI testing, debugging, and capturing screenshots.

### Viewport Requirements
- **`/tv` and `/admin`**: Viewport must always be **1920x1080**.
- **`/`**: Viewport must always be **360x740**.

Execute Playwright via `npx.cmd playwright test` (or using Playwright scripts).

## Agent skills

### Issue tracker

Local Markdown issues under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

## Skills

### ask-matt

Use the `ask-matt` skill when unsure which skill or flow fits the current situation. It is a router over all installed skills — the main flow (idea → ship), on-ramps (bugs, triage, wayfinder), codebase health, vocabulary layers, and standalone tools.

---

### Setup (run once before first use of the engineering flows)

Use `setup-matt-pocock-skills` before the first use of any engineering skill. It configures the issue tracker (`docs/agents/issue-tracker.md`), triage label vocabulary, and domain doc layout. Skills that read the tracker (`to-tickets`, `to-spec`, `triage`, `wayfinder`) require it.

---

### Main flow — idea → ship

**grill-with-docs** — Use when the user wants to sharpen an idea and is working inside a repo. Runs the `grilling` interview and writes to `CONTEXT.md` and ADRs as decisions land. Prefer this over `grill-me` whenever a working directory exists.

**grill-me** — Use when the user wants a relentless interview to sharpen a plan or design but has no repo to write into. Stateless — saves nothing locally.

**to-spec** — Use when the user wants to turn the current conversation into a spec on the issue tracker. No interview — pure synthesis of what's already discussed.

**to-tickets** — Use when the user wants to break a plan, spec, or conversation into tracer-bullet tickets with blocking edges, published to the configured tracker.

**implement** — Use when the user wants to build a spec or set of tickets. Drives `tdd` internally, runs `code-review` at the end, then commits.

---

### On-ramps

**triage** — Use when the user has bug reports or feature requests arriving raw from outside. Moves issues through triage roles (`needs-triage` → `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`). Only for issues the user did not create — skip triage for tickets `to-tickets` already made.

**diagnosing-bugs** — Use when the user reports something broken, throwing, failing, or slow. Builds a tight feedback loop before theorising. Hands off to `improve-codebase-architecture` when no good seam exists to lock the bug down.

**wayfinder** — Use when the user brings a large, foggy idea — too big for one agent session, with no clear path to the destination yet. Charts a shared map of decision tickets on the issue tracker, then resolves them one at a time until the route is clear.

**Before first use:** `setup-matt-pocock-skills` must have been run. Wayfinder reads `docs/agents/issue-tracker.md` for all tracker operations.

Two invocation modes:
- **Chart the map** — user supplies a loose idea; grill to name the destination, map the frontier into tickets, fire research subagents.
- **Work through the map** — user supplies a map URL or number; pick (or accept) a frontier ticket, claim it, resolve it, record the answer, graduate any cleared fog.

Never resolve more than one ticket per session (research tickets excepted).

---

### Codebase health

**improve-codebase-architecture** — Use when the user wants to find deepening opportunities in the codebase. Scans for shallow modules, generates an HTML report with before/after diagrams, then grills through the chosen candidate. Invokes `codebase-design` and `domain-modeling` internally.

---

### Vocabulary layers

**domain-modeling** — Use when the user wants to sharpen domain language: challenge a fuzzy term, resolve an overloaded word, or record a hard-to-reverse decision as an ADR. Also invoked internally by `grill-with-docs`, `triage`, and `improve-codebase-architecture`.

**codebase-design** — Use when the user wants to design or improve a module's interface: deep modules, seams, adapters, leverage, locality. Invoked internally by `tdd` and `improve-codebase-architecture`.

---

### Standalone

**handoff** — Use when the user wants to compact the current conversation into a portable markdown document for a fresh agent session, a new directory, or a colleague.

**prototype** — Use when a design question is hard to settle on paper and needs a small, throwaway runnable artifact. The detour in step 2 of the main flow.

**research** — Use when the user wants to delegate reading legwork to a background agent. It investigates against primary sources and writes a cited Markdown file in the repo.

**to-questionnaire** — Use when the blocker is knowledge held by someone else. Grills the user about the send (who, what's needed back), then writes a Markdown questionnaire to hand that person.

**resolving-merge-conflicts** — Use when an in-progress merge or rebase conflict is already underway. Resolves hunk by hunk by intent, never by picking lines. Never aborts.

**tdd** — Use when the user wants to build a concrete behaviour test-first. Also driven internally by `implement`.

**code-review** — Use when the user wants to review a branch or PR against a fixed point — two axes: Standards and Spec.

**wizard** — Use when the user needs to provision infrastructure, set up credentials or CI secrets, click through a third-party dashboard, or run a one-off migration. Generates an interactive bash script for steps only a human can take.

**teach** — Use when the user wants to learn a skill or concept over multiple sessions in a stateful workspace.

**wait-what** — Use mid-conversation when the last message did not land. Re-pitches in plain language using `CONTEXT.md` vocabulary.

**writing-for-agents** — Use when creating or editing skills, or modifying `AGENTS.md` / `CLAUDE.md`.

**grilling** — The interview primitive itself. `grill-me` and `grill-with-docs` are the named ways in; reach for `grilling` directly only when you want the interview with no wrapper.
