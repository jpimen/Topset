# Decisions

## 2026-10-28 — Milestone 3 Phase A coach builder

- Keep the program grid custom and lightweight. It supports cell editing, keyboard movement, commit/cancel, and the requested columns without adding a table or drag-and-drop dependency; drag and drop remains deferred to Phase B.
- Store the complete coach program document as normalized program, block, week, day, exercise-library, and program-exercise tables. Extend `programs` additively with unit and archive fields; do not rewrite existing migrations.
- Save the document through one coach-checked Postgres RPC transaction. Lock the program row, compare `updated_at`, and reject stale saves with a conflict result; child changes also touch the parent timestamp for direct row edits.
- Debounce editor saves by 600 ms, retain the in-memory document after errors, and keep a 50-entry undo/redo history. Warn for browser unload and internal navigation when a save is pending or failed.
- Use the engine's RPE range validation and load rounding helpers. Phase A has no athlete e1RM preview source, so it stores percentage and RPE prescriptions and explains when a calculated load is unavailable.
- Do not show roster fixtures or seeded people. Keep `/coach/athletes` as an empty state until M4 introduces real coach-athlete links.
- Use `jsdom` only as a development dependency so Vitest can exercise the real React grid cell keyboard behavior; no table, drag-and-drop, or state-library package was added.
- Tighten program visibility to coach-owned documents during M3. Assignment-backed athlete reads return with M4/M5 assignment features; no policy is broadened.

## 2026-10-27 — Milestone 2 calculation engine

- Keep all calculations pure in `src/lib/engine` and store/compute loads in kilograms; UI unit selection converts at the boundary.
- Add Vitest with V8 coverage and a minimal ESLint setup for engine and app checks.
- Use the classic IPF GL powerlifting coefficient set by default. Score functions validate the supported bodyweight ranges instead of silently clamping.
- Treat the requested RPE-to-percent conversion as an approximation: use the verified common RTS/Tuchscherer all-out table through 10 reps and reject combinations outside that data. No 11–12 rep values were guessed.
- Use a configurable linear taper multiplier, editable Banister parameters, and a replaceable session training-load proxy. These are planning primitives, not an automated peaking prescription.
- Added role-guarded calculator routes for both roles. The page is a manual testing tool and stores no data.
- Limit RPE inputs to 1–10 effective reps (`reps + reps in reserve`), the verified range of the configured approximation. Keep 11–12 rep cells unavailable until a reliable source is supplied.
- Provide calculators links in both the coach sidebar and athlete navigation.
- Deferred coach invite-code linking, new-account Google signup onboarding, and a mobile pass on auth screens; also kept the program builder, athlete logging, and peaking generator out of M2.

## 2026-10-27 — Authentication UI and profile metrics

- Replaced the green auth treatment with warm charcoal surfaces and gold tokens, and bundled Syne, Plus Jakarta Sans, and Space Mono locally to avoid external font requests.
- Split signup into role selection and a single role-specific credentials form. Kept the existing Supabase sign-in, signup, Google existing-account flow, role redirects, and honest deferrals.
- Added nullable validated squat, bench, and deadlift max columns and persisted them from athlete signup metadata. No RLS policy was weakened.
- Qualified the outer program ID in the athlete assigned-program policy after its RLS test exposed an ambiguity; this restores the intended assigned-program read without broadening access.
- Omitted a forgot-password link and keep-signed-in checkbox because the app has no password-reset flow and Supabase already persists sessions.

## 2026-10-27 — Local Supabase auth diagnostics

- Treat missing or example-valued Supabase environment variables as a startup configuration error, because passing those values into the client produces opaque fetch failures.
- Keep local Supabase credentials in the developer's ignored `.env`; the example environment file remains placeholder-only.
- Map known auth and connectivity failures to plain-language UI messages and keep Supabase's technical error details in the browser console.
- Kept the fix within the existing auth flow and deferred all later milestone work.

## 2026-10-26 — Milestone 1 scaffold and access model

- Chose Vite + React + TypeScript with Supabase Auth and Postgres because these match the product spec and keep the initial app small.
- Profile role is created from signup metadata by a database trigger, and a database trigger rejects changes to a profile's role or identity. Frontend route guards are usability checks; RLS remains the data boundary.
- Added minimal coach-athlete link, program, and assignment tables now because program access policies depend on those relationships. Link creation/approval and program snapshot versioning remain for later milestones.
- Kept role landing pages as placeholders to present the approved auth flow without starting the coach builder or athlete workout UI.
