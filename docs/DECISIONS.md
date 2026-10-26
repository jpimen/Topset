# Decisions

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
