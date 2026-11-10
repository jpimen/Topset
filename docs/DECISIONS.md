# Decisions

## 2026-11-10 - Mobile athlete set log rows

- On narrow screens, show each prescribed exercise as a full-width clickable “Log sets” disclosure row with dividers. Keep its inputs in the expanded panel and preserve the existing wide prescription table on larger screens.

## 2026-11-10 - Sync program blocks to the Athlete view

- Keep Coach-defined block names, notes, and week membership in the Athlete program schema and render blocks as a level above their weeks.
- Include blocks and each week's `block_id` in new saved snapshots as well as live program loads. Existing snapshots without block metadata remain readable and are grouped under a single legacy Block without changing snapshot immutability.
- Keep weeks with missing or invalid block references visible under a legacy Block so no assigned training content disappears.

## 2026-11-10 - Calculator visibility preferences

- Show all six calculators by default and let each signed-in user hide or restore individual cards from the Calculators page.
- Let users order cards with move-up and move-down controls, and store both order and visibility in browser local storage under versioned keys scoped by profile ID. This follows existing device-local preference patterns and keeps accounts on a shared device separate.
- Keep visibility separate from calculator input state and calculations; removing a card only removes it from the page layout.

## 2026-11-10 — Minus percentage calculator

- Add a signed percentage calculator to the shared Calculators page. Treat the entered percentage as signed, calculate `base × (percentage ÷ 100)`, and add that amount to the base; allow negative and decimal values for both fields.
- Keep the arithmetic in the pure calculation engine and display the signed amount alongside the adjusted result.

## 2026-11-09 — Coach-defined program set types

- Start the Coach builder's set-type menu with Topset, Backoff, Working, Warmup, and AMRAP, and allow coaches to manage built-in and custom options in a popup. Save the full list per coach in browser storage, matching the current device-local preference model.
- Renaming an option updates matching rows in the current program as one undoable document change.
- Store prescription set types as text so custom labels survive program saves, snapshots, and athlete validation. Limit labels to 40 characters in both the UI and database.
- Keep custom types as display labels; training calculations do not branch on set type. Custom options remain device-local until account-synced coach preferences are introduced.

## 2026-11-06 — Coach profile page

- Add a Coach-only Profile destination that reads the signed-in profile row and Auth email, with read-only and explicit edit states. Keep Athlete-only metrics out of the Coach form; allow the Coach to edit their name, team/gym, category or discipline, bio, achievements, and profile photo.
- Keep profile updates owner-scoped through the existing `profiles` RLS policy and immutable identity trigger. Add separate storage policies for Coaches to upload, read, and delete only objects in their own UUID folder in the existing private photo bucket; retain the Athlete and linked-Coach policies unchanged.
- Stage a replacement photo until Save so Cancel discards it; update the profile path only after upload succeeds and remove the previous object only after the database update succeeds.

## 2026-11-06 — Coach profile implementation prompt

- Add a reusable prompt for a Coach-only Profile sidebar page with a complete view and an explicit Edit profile flow. The prompt requires the implementation to verify current profile fields and RLS/storage policies before editing, because Coach and Athlete profiles share a row while existing photo policies are Athlete-oriented.
- This request produces an implementation prompt only; it does not change application routes or behavior.

## 2026-11-04 — Warm-up calculator methods and rounding

- Add a configurable barbell and smallest total-load increment to the calculator. Defaults are 20 kg / 45 lb and 1.25 kg / 2.5 lb; preserve these conventional paired defaults when switching units, and convert custom values.
- Round all generated warm-up loads to the nearest configured increment. The increment is the total change to the bar load, matching the requested example.
- Standard ramp uses the empty bar for 8 reps, then 50% x5, 70% x3 and 90% x1. Even jumps use four equal increments from the bar to the top set with 8/5/3/1 reps; since the fourth jump reaches the top-set load, tell the lifter to use that single as the top set instead of repeating it.

## 2026-11-04 — Show one plate stack in the calculator diagram

- Draw one side of the barbell loading only. The heading continues to tell users to load the displayed stack on each side, while the diagram remains uncluttered.
- Show one grey collar beside the displayed stack when collars are enabled; keep collar weight applied to both sides in the total load calculation.

## 2026-11-03 — Plate calculator collar setting

- Let the user choose whether collars are loaded. Default to no collar, pass zero collar weight into plate math, and include the standard 2.5 kg-per-side collars only when selected.
- Show grey collars in the barbell diagram only when the setting is enabled. Convert the standard collar weight to the active display unit.

## 2026-11-03 — Competition plate colors

- Match plate colors to standard kilogram sizes: 25 kg red, 20 kg blue, 15 kg yellow, 10 kg green, 5 kg white and 2.5 kg black. Smaller fractional plates use black as well.
- Choose colors from kilogram-equivalent weights so pound displays retain the nearest matching plate color. Keep collars grey on both themes.

## 2026-11-03 — Plate calculator loading diagram

- Show the calculated plate stack as a mirrored barbell diagram with the same per-side plates on both ends, keeping the existing plate math as the single source of truth.
- Label plate weights, group duplicate plates, and display the full loading instruction accessibly. Cap only the drawing at eight plates per side and mark any additional plates with a count so large loads remain legible.
- Explain when the requested target is below the bar weight and retain the achieved load and difference for unreachable targets.

## 2026-11-03 — IPF Technical Rulebook reference

- Add one read-only rulebook page under both role-guarded workspace routes and include it in the existing Coach sidebar and Athlete mobile/desktop navigation.
- Keep the English Technical Rulebook effective 1 March 2026 as the governing source. Maintain original short summaries, section identifiers and printed-page links in `src/lib/ipfRulebook.ts` so an edition update can replace one focused data file.
- Keep the IPF Changes Explanations and Approved List visibly labeled as separate resources. The PDF contents cover Chapters 1–10; its Coach Responsibilities section refers to an Appendix 2 form on printed page 45, but the form itself is not included.

## 2026-11-03 — Editable blank exercise rows

- Let Coaches save an unassigned prescription row so exercise, set type, sets, reps, RPE, load and notes can be entered independently. Store the exercise reference as nullable so blank rows and partial entries persist.
- Keep incomplete rows out of Athlete live prescriptions. Snapshot generation already joins assigned exercise records, so unassigned rows are not included in snapshots. No RLS policy changes are needed.

## 2026-11-03 — Live Athlete program updates

- Publish Coach program row updates through `supabase_realtime`; existing row triggers touch the parent program after saved changes.
- An Athlete with a live assignment listens only for that program's update, then re-reads the assignment and prescription through Supabase so RLS and server data remain authoritative. Snapshot assignments stay immutable; manual refresh and tab return remain fallbacks.

## 2026-11-03 — Program save ordering

- Defer week-number and day-number uniqueness checks until the save transaction commits. The document save RPC can temporarily reuse a number while deleting or renumbering entries; immediate checks caused valid week/day edits to fail intermittently.
- Blank program documents are valid. Blank exercise rows require the nullable `program_exercises.exercise_id` migration; the builder now points to the relevant migration when the server reports that schema mismatch.

## 2026-11-03 — Program blocks

- Treat a block as a named group of weeks. Adding a block creates its first week and selects the block; subsequent weeks are added to the selected block.
- New blocks and weeks start with the plain names “Block” and “Week”; Coaches can rename both in the builder. Numeric positions remain internal for ordering only.
- Keep rename fields inline in the selected block/week tab so renaming does not shift the control to a separate part of the builder.
- Legacy weeks without a `block_id` are presented as an editable default Block; their association and block order persist on the next confirmed program save.
- Persist blocks and week-to-block links through one coach-authorized RPC alongside the program document. Athlete program views continue to display the assigned weeks without exposing Coach-only block editing controls.

## 2026-11-03 — Bounded Athlete caching and shared screen reads

- Keep the existing Athlete prescription fallback, validate a v2 identity/role/assignment envelope and expire offline fallback after 24 hours. Revalidate on entry, manual refresh, tab return and reconnect; invalidate on authoritative empty results, access/validation failures and account cleanup. Keep live and snapshot sources separate.
- Pause program refresh while workout or check-in edits are unsaved. Preserve mounted forms during revalidation, share workout-history reads within the Program page and keep server history out of browser persistence.
- Persist workout saves before RPC submission and use the workspace sync provider as the sole writer. Retain drafts until their exact revision is confirmed; malformed/unavailable storage is an error, never an empty queue. Account cleanup preserves queued input and device settings.
- Remove unused program-loader exercise queries and Coach response-label program loads instead of adding caches. Refresh Coach response membership while polling, and hide old response values on failure. Do not introduce persistent Coach, health-metric, video or signed-URL caches without demonstrated need.
- Guard profile requests and remount identity-specific workspace state on account changes. Keep ordinary same-user token refresh from resetting forms. Cross-device changes retain manual/tab-return/reconnect freshness rather than adding a realtime mechanism.
- See [data caching audit and limits](DATA_CACHING.md) for the complete screen inventory, cleanup rules and offline revocation/storage limitations.

## 2026-11-02 — Coach training video review

- Add a Videos action to each program day card and show videos for that day on a dedicated coach page.
- Query video records through existing row-level access policies and issue short-lived signed playback URLs from the private bucket; provide manual refresh for new uploads.

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

## 2026-11-04 — One-sided plate loading visual

- Match the calculator diagram to the supplied compact bar, plate and collar reference. Draw one side of the bar with the loaded stack and collar when enabled; retain per-side instructions and calculate total load for both sides.
- Use diagram-scoped muted colors so this visual can match the reference without changing the plate badges elsewhere.

## 2026-11-06 - Per-set athlete logging and program totals

- Give athletes one load, RPE, and notes input for each prescribed set so three prescribed sets produce three independently editable workout logs.
- Calculate coach-facing lifted totals as logged load multiplied by prescribed reps, and summarize squat, bench, and deadlift volume for the selected athlete across the visible week.
- Label totals as load times prescribed reps because performed rep counts are not currently stored per logged set.

## 2026-11-09 - Program-only custom exercises

- Typing a new exercise in the Coach program builder adds it to that program draft without a browser confirmation or inserting it into the shared Exercises library.
- Persist program-only exercise names on prescription rows with a nullable exercise reference, and carry them through live and snapshot athlete programs. Existing shared exercises continue to use the Exercises library.

## 2026-11-09 - Automatic Coach program saves

- Save program edits automatically after a short idle period, then flush the latest draft before internal navigation. Attempt a final save when the page becomes hidden or starts unloading, and remove browser confirmation prompts.
- Remove the manual Save changes button; keep save status, conflict recovery, and automatic retries after a new edit or reconnection.

## 2026-11-09 - Athlete workout set logging layout

- Render one log row per prescribed exercise and group per-set load, RPE, and athlete-note controls inside that row. Load fields are separated with plus signs to make a sequence such as 80 + 80 + 80 read as three sets.
- Build log entries only for the coach-prescribed set count. An unset count produces no athlete set inputs; each entered set remains stored as its own logged_sets record for coach review and analytics.
- Keep the current desktop table and horizontal scroll behavior while reducing its minimum width after removing the standalone Set column.

## 2026-11-09 - Athlete workout set alignment

- Group each set's load, RPE, and athlete note controls on a single horizontal line inside the exercise row, so entries stay associated and aligned by set number.

## 2026-11-09 - Athlete prescription completeness and log layout

- Render set log labels and entries on a shared four-column grid. Collapse the set editor by default above six prescribed sets.
- An athlete log is available only when set count, reps, and either a prescribed load or target RPE are present. Named incomplete rows remain as one compact not-prescribed line; unnamed rows are omitted.
- Read the set count directly from the program prescription field; do not reinterpret it as reps.

## 2026-11-09 - Compact athlete set log disclosure

- Keep the workout log column and set field grid in place, but collapse each Log sets section by default. The closed disclosure shows only its label and prescribed set count to keep exercise rows compact.

## 2026-11-09 - Athlete add and remove set logs

- Let athletes add or remove per-set log entries without changing the coach's set prescription. Renumber remaining entries after deletion; the workout session RPC replaces the session's log rows, so removed entries stay deleted after sync.
- Start a new workout with the prescribed number of sets. For an existing saved workout, restore its saved set count so athlete additions and deletions persist when the workout reloads.

## 2026-11-09 - Athlete log number field controls

- Hide native up/down steppers on athlete workout log number inputs while keeping numeric input behavior and validation.
- Scope the styling to the workout log input class so other number fields retain their current controls.

## 2026-11-09 - Keep athlete workspace horizontally contained

- Constrain athlete page and workspace grid items to their available width so focusing a check-in control cannot shift the full page sideways.
- Keep horizontal scrolling inside the workout table viewport.

## 2026-11-09 - Athlete workout log autosave

- Autosave changed workout set logs to the existing local draft queue after 450 ms of inactivity, then use the existing background sync flow to send them to the coach.
- Remove the manual Save changes control; the status indicates whether edits are saved locally or synced.

## 2026-11-09 - Prevent workout save layout shifts

- Keep athlete sync feedback in a fixed notice so queued drafts do not push workout content down when syncing starts or ends.
- Retain loaded workout rows during background refreshes and show the loading row only before the first session response.
- Keep the loaded program visible if a background refresh fails, and reserve a status line for refresh feedback.

## 2026-11-10 - Remove manual athlete workout save

- Remove the Save changes button after autosave is established; keep the save and sync status visible and retain the separate Post Video action.

## 2026-11-10 - Silent athlete workout autosync

- Hide normal syncing and waiting-to-sync banners so autosave does not show temporary popups or move attention away from the workout.
- Keep the retry notice for actual sync failures.
