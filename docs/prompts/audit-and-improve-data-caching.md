# Prompt: audit and improve Topset data caching

Work in the existing Topset repository. Audit how data is fetched, retained, refreshed, and cleared on **both Athlete and Coach screens**, then implement caching improvements for those screens where they address a demonstrated performance or offline-use need. Do not add a generic caching framework or a new dependency without evidence that existing patterns cannot meet the need.

## Read and inspect first

Read `AGENT.md`, `Spec.md`, `README.md`, `docs/TODO.md`, and `docs/DECISIONS.md`. Inventory the Athlete and Coach routes/screens and trace their displayed data through React components and hooks, Supabase repositories, local storage, and tests. Treat the current code, schema, and RLS policies as authoritative; verify every API and access rule before relying on it.

The project is a React + TypeScript + Vite application using Supabase Auth and Postgres/RLS. It does not currently have a query-cache library. Existing browser persistence includes:

- Athlete assigned-program data in `src/lib/athlete/programs.ts`, used as an offline fallback.
- Pending workout drafts in `src/lib/athlete/logs.ts`, which are a durable retry queue and must not be treated as an ordinary disposable cache.
- Device-local theme preferences in `src/lib/themePreference.ts`, which are user settings rather than server-data cache.

These are starting points, not a complete inventory. Inspect both roles for other repeated-fetch or persistence patterns, including Coach program lists/builder data, roster and assignments, check-ins, training videos, and Athlete assigned-program and workout-related screens where present. Do not assume every item needs caching. Do not conflate persisted user input, settings, and cached server responses.

## Goals

- Identify concrete duplicate requests, expensive reloads, or offline gaps before changing behavior. If the current implementation is adequate, explain why and make no unnecessary code changes.
- Cover data displayed on both Athlete and Coach screens. For each proposed cache, identify the screen, source query, expected reuse, freshness policy, and the events that invalidate or refresh it.
- Keep server data authoritative whenever the user is online. A successful response, including an authoritative “no active assignment” result, must not be replaced with older cached data.
- Preserve the distinct semantics of live and snapshot assignments: live data must refresh from the coach's saved program; snapshot data remains the assigned immutable version.
- Keep each user's and role's data isolated. Cache keys must account for the authenticated user and relevant resource/query parameters; Coach data must never appear in Athlete views, and data from a previous account must not flash or remain accessible after an account switch or sign-out.
- Keep Coach edits and Athlete views coherent. A confirmed Coach save or change to a program, assignment, or link must trigger the appropriate invalidation or refresh; do not expose unsaved Coach edits through an Athlete cache.
- Keep workout drafts durable until the server confirms synchronization. Never silently discard pending user input.
- Define when cached data is refreshed, invalidated, or cleared, including account changes, role changes, link removal, assignment changes, and sign-out where applicable.
- Consider bodyweight, workout logs, prescriptions, and notes sensitive. Browser storage is not a secure vault; do not broaden persistence or cache sensitive data without a clear, bounded product need and explicit expiration/cleanup behavior.
- Do not bypass Supabase RLS, cache authorization decisions, or allow cached data to grant access after the server denies it. Be explicit about the unavoidable offline limitation that revocation cannot be verified without a connection.
- Keep loading, error, empty, offline, and stale-data states understandable. Report storage and network failures using established project patterns; do not silently turn online errors into successful stale responses.

## Implementation process

1. Before editing, summarize the current caching and fetch behavior, evidence of the problem (if any), risks, and a concise file/data-flow plan. Ask one focused question only if an unresolved product decision would materially change the solution; otherwise state reasonable assumptions.
2. Keep changes scoped to data caching on Athlete and Coach screens. Do not redesign screens, alter database permissions, or add unrelated features.
3. Use the existing validation and error-handling conventions. Validate data read from browser storage, handle unavailable or full storage explicitly where the data matters, and avoid broad catches that hide online failures.
4. Add or update focused tests for cache hits, online revalidation, invalidation, offline fallback, malformed stored values, account isolation, and pending-draft preservation as applicable to the change.
5. Update `README.md`, `docs/TODO.md`, and `docs/DECISIONS.md` only where actual behavior or limitations change.
6. Run the smallest relevant tests first, then typecheck, lint, and build if the scope warrants them. Report exact commands and results, including checks that could not run.

## Acceptance criteria

- The change solves an observed caching or offline problem and does not add cache infrastructure speculatively.
- The audit explicitly covers both Athlete and Coach screens; any implemented cache is tied to a demonstrated screen/data need.
- Online Supabase results remain authoritative; a successful fetch cannot leave stale data presented as current.
- Live and snapshot assignment behavior remains correct.
- Coach and Athlete data are isolated by authenticated identity and role, and confirmed Coach changes become visible to Athletes according to the existing live/snapshot rules.
- Pending workout drafts are preserved until confirmed by the server.
- Persisted data is correctly scoped, validated, refreshed, invalidated, and cleared, with sensitive data exposure and offline access limitations documented.
- Errors and stale/offline states are not presented as successful fresh loads.
- Focused tests cover the changed behavior, and existing coach, athlete, authentication, and authorization behavior remains intact.

Stop after the Athlete and Coach screen caching audit and approved scope are complete. Do not begin unrelated milestones.
