# Milestone 5 implementation prompt: athlete workouts

Work in the existing Topset repository. Implement Milestone 5 from `Spec.md`: the athlete-facing assigned-program view and workout logging experience. Before editing, read `AGENT.md`, `Spec.md`, `docs/TODO.md`, `docs/DECISIONS.md`, and inspect the current routes, program document model, assignment access, and Supabase migrations. Treat current project code and migrations as authoritative; do not assume a table, policy, or API exists without checking it.

## Scope

- Give signed-in athletes a mobile-first **Today**, **Program**, **Progress**, and **Profile** navigation structure, using the existing app styling and routing conventions.
- Implement **Today** for the athlete's active assignment: show the current workout as readable exercise cards, prescribed sets/reps/RPE/load, coach notes, and inputs to log actual load, actual RPE, and athlete notes. Include a clear session completion action and useful empty, loading, and error states.
- Implement **Program** as a read-only overview of the athlete's assigned weeks and days. Respect the assignment start date, live versus snapshot sync behavior, and coach-to-athlete link status. Never expose prescription editing controls to athletes.
- Persist workout logs safely, with a database migration and data-access layer if the current schema does not already support them. Design the log record granularity to preserve individual logged sets and associate each log with the assigned exercise/session. Validate inputs and handle repeat saves without duplicate records.
- Make logging offline-friendly: retain unsynced entries locally, show which entries are pending or synced, retry synchronization when connectivity returns, and avoid losing or duplicating logs across reloads. Do not claim a log is saved remotely until the server confirms it.
- Keep coach views and existing coach workflows intact. Use the engine for any displayed load conversion or plate calculation; do not invent training prescriptions.

## Security and data rules

- Enforce every log permission in Postgres RLS: an athlete may read and write only their own logs, and only for exercises in an assignment they can currently access. A coach may read logs only for currently linked athletes they coach. Do not broaden existing policies to make the UI work.
- Keep prescription rows read-only for athletes. Do not allow a removed or unlinked athlete to continue reading an assignment or its logs. Respect future assignment start dates.
- Treat notes as untrusted user input. Follow the existing Supabase client, validation, error-reporting, and authorization patterns. Never add secrets.
- Add database permission tests for athlete self-access, cross-athlete denial, unrelated-coach denial, and removed-link access revocation, following the existing pgTAP test style.

## Implementation process

1. Summarize your understanding, assumptions, top risks, and a short file/data-flow plan before editing. Keep the change within Milestone 5; do not add analytics, peaking, coach comments, or other later features.
2. Describe the athlete screen layout and loading, empty, and error states before building them. Keep feature code organized under the existing athlete component and data/domain conventions.
3. Make additive, versioned database migrations. Keep persistence and validation out of UI components. Reuse existing program and assignment types where appropriate, and add narrow types/modules when needed.
4. Implement and review one coherent slice at a time. Ensure both live and snapshot assignments render correctly and that athlete routes remain role guarded.
5. Update `README.md`, `docs/TODO.md`, and `docs/DECISIONS.md` to reflect the completed milestone and any deferred gaps. Review the diff for accidental scope expansion, stale code, and weakened permissions.
6. Run the project checks required by `AGENT.md` where the local environment supports them. Report exact commands and results; state clearly if database or browser verification could not run.

## Acceptance criteria

- An athlete with no active, started assignment sees a clear empty state; a future assignment does not appear early.
- An athlete with a live assignment sees the coach's current program; an athlete with a snapshot assignment sees the immutable assigned snapshot.
- Athlete can record actual load, actual RPE, and notes for prescribed sets, revisit the workout, and see saved values.
- Athlete cannot change coach prescriptions or read another athlete's assignment/logs, even by direct Supabase requests.
- Coach access to athlete logs is limited to currently linked athletes; removing a link revokes access.
- The athlete navigation and workout controls are usable at mobile widths and by keyboard, with visible focus and labels.
- Existing coach builder, assignments, role routing, and calculator routes continue to work.
- Migrations, security tests, app checks, docs, and final report agree on what is implemented and what remains deferred.

Stop after Milestone 5. Ask for approval before starting Milestone 6 or any other later milestone.
