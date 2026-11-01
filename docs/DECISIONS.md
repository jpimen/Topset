# Decisions

## 2026-11-01 — Athlete training video uploads

- Attach video uploads to the active assigned training day from the workout log action row; collect a `Topset` or numbered set label on a dedicated athlete page.
- Keep videos private in Supabase Storage, validate assignment/day access for athlete uploads, and allow only the athlete and currently linked coach to read active-assignment video rows and objects.
- Limit uploads to MP4, MOV, M4V, and WebM files up to 100 MB. Coach-side video review remains a separate UI task.

## 2026-11-01 — Role-specific appearance settings

- Keep Coach and Athlete theme preferences in separate device-local storage keys so changing one workspace does not restyle the other.
- Place the Coach appearance control in Settings and the Athlete control in Profile; remove the duplicate workspace-sidebar control.
- Read the previous device-wide preference as a migration fallback until each role selects its own theme.

## 2026-11-01 — Mobile and tablet layout

- Scope responsive layout changes to viewports below 1024 CSS pixels so the desktop UI at 1024 pixels and wider keeps its existing rules and appearance.
- Use mobile-scoped CSS to stack auth forms, keep role navigation discoverable, add safe-area and fixed-nav spacing, and contain horizontal scrolling inside the coach builder and athlete prescription tables.
- Support narrow phones from 320 CSS pixels through tablet widths below 1024 pixels without changing routes, data behavior, or authorization.

## 2026-11-01 — Device-level Dark and Light appearance

- Offer Dark and Light as the two appearance choices. Dark remains the first-visit default and preserves the existing dark palette; the user requested a two-choice toggle, so System is not an option.
- Store the choice in browser local storage for this device. Apply the document theme before React starts, set native `color-scheme`, and keep the browser theme-color metadata in sync. If storage is blocked or invalid, use Dark.
- Keep all color values in `src/theme/tokens.css`. Use semantic tokens in components and styles, and enforce the rule with the color-literal check in lint and Vitest.
- Do not add database fields or sync theme preference to profiles in this task; keep that as follow-up work.

## 2026-10-31 — Remove athlete next-workout logging section

- Remove the entire Next workout section and its set-entry controls from the athlete Program page, as requested. Program remains a read-only prescription overview with per-day check-ins.
- Keep the background sync provider so workout drafts already queued on a device can still sync; show pending/error status globally because Program no longer has an inline sync panel.
- New workout sets cannot be entered in the athlete UI until a replacement logging surface is requested.

## 2026-10-31 — Athlete program landing and profile details

- Remove Today as a separate athlete destination and route `/athlete` to Program. Keep the existing next-workout logging controls, offline drafts, and sync status inside Program so the navigation change does not remove workout capability.
- Store athlete bio, category, achievements, team, weight class, and photo path on the existing profile row. Profile fields remain scoped by current profile RLS and role identity protections.
- Store athlete pictures in a private Supabase Storage bucket under the athlete UUID. Allow the athlete to manage their own files and currently linked coaches to read them; render signed URLs in the athlete profile.

## 2026-10-29 — Program save and live refresh

- Flush the latest builder document before leaving through either an app link or the Exit button. Keep the coach in the builder if that save fails, so a visible retry can recover the edits instead of discarding them during unmount.
- Expose a manual refresh on athlete Today and Program pages for an already-open live assignment. The loader re-reads the assignment and program from Supabase; local cached data remains an offline fallback only.
- Refresh those pages when the browser tab becomes visible again so coach edits made in another tab are picked up without requiring a page reload.
- Keep live and snapshot assignment semantics and all existing RLS policies unchanged; no migration is needed for this client-side save-loss fix.

## 2026-10-29 — Athlete program overview table

- Render assigned exercise prescriptions in a semantic, read-only table so athletes can scan the same exercise, set type, sets, reps, RPE, load, and coach-note fields used in the coach builder.
- Keep the full table on narrow screens in a horizontally scrollable region with a mobile hint and keyboard focus, rather than dropping columns.

## 2026-10-29 — Athlete workout-day check-ins

- Show a separate private check-in table beside every assigned training day. Save at most one check-in per assigned day, keyed by assignment and day; do not ask the athlete to choose a calendar date.
- Use numeric controls for quantities (bodyweight with an explicit kg/lb unit, protein and carbs in grams, calories in kcal); use dropdowns for sleep quality (1–5), sleep duration (half-hour steps), and fatigue (1–10).
- Restrict athlete read/write access to their own currently accessible assignment day with RLS. Permit read-only access to the coach only while the athlete link and assignment are active, and only for days in that assignment. The athlete may leave values blank and only needs to enter the fields they track.
- Show coaches a read-only response panel alongside every day in the program builder, selectable among athletes assigned to that program. Display metrics vertically as label/value rows and share assignment/check-in data loading across the day panels. Keep the panel scoped to started active assignments and filter each row through RLS, including for snapshot day IDs. Let the builder area scroll horizontally when the screen is too narrow for both columns.
- Retain existing date-based check-in records without automatic migration because the matching training assignment/day cannot be inferred safely. New check-ins are online-only for this iteration; offline queueing remains deferred.

## 2026-10-29 — Milestone 5 athlete workouts

- Show Today as the earliest incomplete workout in week/day order because assignments do not define calendar-day scheduling. A future-dated assignment remains invisible through RLS.
- Render live assignments from normalized rows and snapshot assignments from their immutable JSON document. Validate both through one athlete-facing program schema before rendering.
- Store a workout session per performed day and logged set per program row/set number. Use client-generated session UUIDs and an atomic, access-checking RPC so offline replay updates the same session without duplicates.
- Keep pending logs and the last assigned program in browser local storage for offline use. Retain failed syncs and show pending/error state; remove a pending draft only after the server confirms it.
- Enforce session and set reads with RLS for the athlete and currently linked coach. Validate assignment, start date, link, day, and exercise again inside the logging RPC. Fix exercise-row RLS to honor future start dates as well.
- Keep the four athlete tabs in place, implement Today and Program in this milestone, and leave Progress analytics and editable profile settings for later work.
- Accept either a 48-character invite code or the full coach share URL in athlete signup and coach-connection forms. The earlier 48-character input limit silently truncated URLs before the invite query value.

## 2026-10-29 — Milestone 4 coach links and assignments

- Keep coach invite codes high entropy and store only SHA-256 digests. Return plaintext only from the authenticated rotate-code RPC; code possession creates a pending athlete request, never an automatic active link.
- Use database RPCs for link request, approval, decline, removal, assignment, and assignment ending. Enforce one active coach per athlete and one current assignment per athlete in partial unique indexes.
- Store snapshot assignment documents as immutable JSON on the protected assignment row; live assignments read normalized coach-owned rows only after their start date. Removing a coach link immediately removes athlete access through RLS.
- Keep email delivery deferred because no email provider is configured. Coaches share private signup links; athlete workout views remain for Milestone 5.

## 2026-10-28 ? Code organization

- Added a reusable Topset code-organization prompt in `docs/prompts/maintain-clean-code-organization.md`.
- Split the combined coach route module into focused coach page modules, shared coach page helpers, and a dedicated program builder module. Kept routes, UI behavior, and data/domain modules unchanged.

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
