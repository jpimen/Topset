# Prompt: fix program creation, saving, assignment, and athlete sync

Work in the existing Topset repository. Diagnose and fix the coach program workflow so a coach can create and save a program, assign it to an approved athlete, and have the athlete see the saved program. Do not implement this prompt until the owner approves it.

## Read and inspect first

Read `AGENT.md`, `Spec.md`, `docs/TODO.md`, and `docs/DECISIONS.md`. Trace the complete data path through:

- Coach program creation, builder initialization, autosave, and `save_coach_program_document`.
- Coach-athlete invite, request, approval, and program assignment.
- Assignment `live` and `snapshot` modes, the applicable RLS policies, and the athlete Today/Program data loaders and cache.
- Existing database tests and browser/app checks.

Preserve all existing working-tree changes. Treat the invite link and program assignment as separate actions: an invite link connects an athlete to a coach after approval; the coach then assigns a program from the Programs page. Make that distinction clear in any UI copy you change.

## User-observed symptoms to investigate

- The athlete currently sees a program titled **“Untitled program”** and a prescription that may not match what the coach most recently entered.
- The coach builder displays edits and a save status, but program creation, saving, assignment, or sync may be failing silently or showing stale data.
- The owner wants coach edits to reach the athlete when the assignment is configured for live sync.

Do not assume which layer is broken. Reproduce the flow and identify the first failed or stale boundary. Verify whether “Untitled program” is simply the saved name or evidence that the rename never persisted. Check the builder save status and database document before changing behavior.

## Required behavior

- Creating a program opens a usable builder with a clear initial state. Renaming it and adding weeks, days, and exercises must persist; success and errors must be visible.
- A coach can assign a program only to an active, approved linked athlete. Assignment status, selected athlete, start date, and sync mode must be clear after save.
- A **live** assignment must show the latest successfully saved coach program when the athlete loads or refreshes Today/Program. Changes must never appear before the coach save succeeds. If the athlete already has the page open, provide an understandable refresh/update path or verified live refresh behavior.
- A **snapshot** assignment must remain fixed at the version captured during assignment. Do not silently convert snapshots to live or overwrite them during coach edits.
- Future-dated assignments remain unavailable until their start date. Removing a coach link revokes program access. Preserve existing database RLS and role boundaries.
- Athlete program prescriptions stay read-only. Offline cache may be used offline, but a successful online fetch must not keep displaying a stale cached live program.
- Use two isolated browser contexts/profiles for coach and athlete verification so their Supabase sessions do not overwrite each other through shared `localhost` storage.

## Implementation and verification

1. Before editing, report the suspected failure point, evidence, assumptions, concise file/data-flow plan, and any security risks. Keep the fix limited to this workflow; do not start peaking, analytics, or other later milestones.
2. Add or update focused tests for the reproduced bug. Cover program creation/save, live assignment visibility after edits, snapshot immutability, future start dates, and role/access denial as applicable.
3. Use additive versioned migrations only if the diagnosis proves a schema or policy change is needed. Do not weaken RLS to make athlete reads succeed.
4. Exercise the full coach-to-athlete flow: create and rename a program, add a week/day/exercise, wait for a confirmed save, approve an athlete link, assign the program as live, and verify the athlete sees the same name and prescription. Edit the coach program and verify live refresh; verify a snapshot remains unchanged.
5. Run typecheck, lint, unit tests, database permission tests, and a production build where the environment supports them. Report exact results and any checks that could not run.
6. Update `README.md`, `docs/TODO.md`, and `docs/DECISIONS.md` only as needed to record the actual behavior and remaining limitations.

Stop after this workflow is fixed. Ask before starting any other milestone or unrelated feature.
