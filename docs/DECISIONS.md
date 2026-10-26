# Decisions

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
