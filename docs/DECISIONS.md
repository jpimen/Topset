# Decisions

## 2026-10-27 — Milestone 2 calculation engine

- Keep all calculations pure in `src/lib/engine` and store/compute loads in kilograms; UI unit selection converts at the boundary.
- Add Vitest and its V8 coverage provider as the only new development dependencies. The repo still has no lint script, so lint remains a documented tooling gap.
- Use the classic IPF GL powerlifting coefficient set by default. Score functions validate the supported bodyweight ranges instead of silently clamping.
- Treat the requested RPE-to-percent conversion as an approximation: use the verified common RTS/Tuchscherer all-out table through 10 reps and reject combinations outside that data. No 11–12 rep values were guessed.
- Use a configurable linear taper multiplier, editable Banister parameters, and a replaceable session training-load proxy. These are planning primitives, not an automated peaking prescription.
- Added role-guarded calculator routes for both roles. The page is a manual testing tool and stores no data.
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
