# Athlete and Coach data caching

Audit and implementation: 2026-11-03. Current routes, repositories and versioned RLS policies are authoritative. No query-cache dependency or database permission changes were needed.

## Screen inventory and policy

| Screen/data | Source | Retention and refresh |
| --- | --- | --- |
| Athlete Program prescriptions | Active `program_assignments`; normalized `programs`/`weeks`/`days`/exercise joins for live plans, assignment JSON for snapshots | One validated offline copy per athlete, with role, assignment, program and last-verification metadata. Every normal load revalidates with Supabase; reuse is only after an offline transport failure. Offline fallback expires 24 hours after successful verification. |
| Athlete Program workout entries | `workout_sessions` with `logged_sets` | One shared assignment-wide response within the mounted Program page, rather than one full-history query per day. Re-fetch after program revalidation or confirmed draft synchronization; manual retry is available. No server history is written to browser storage. |
| Athlete pending workout input | Existing `topset:workout-drafts:v1:<athlete-id>` queue | Durable input, separate from the program cache. Save writes locally before the workspace sync provider submits the RPC. Remove only the exact acknowledged revision; failed, newer and inaccessible-assignment drafts remain queued. |
| Athlete day check-ins | `athlete_workout_checkins` by athlete, assignment and day | Component state only; online load/save and explicit retry. No new offline health-data persistence. |
| Athlete Profile and coach connection | Auth profile, private photo signed URL, `coach_athlete_links` | Profile retained in authenticated memory; explicit refresh after profile save. Coach-link data loads on entry/request. No additional response persistence. |
| Athlete Post Video | Local file/blob preview, metadata insert, private Storage upload | File selection remains temporary and preview URLs are revoked. No upload cache or offline queue. |
| Athlete Progress and both Calculators | Placeholder or local calculations | No server-data cache needed. |
| Coach Dashboard, Programs, Athletes and Exercise Library | Coach-filtered programs, links, assignments, exercises; private photo signed URLs | Fetch on entry; affected lists refresh after confirmed local mutations. In-memory component state only. Navigation reloads can occur, but no measured evidence justifies persistent roster or builder caches. |
| Coach program builder | Program hierarchy and separate exercise library query | Editable document and undo history remain in memory. Removed the unused library query inside `loadProgram`, which duplicated the builder's actual library load and unnecessarily ran for Athletes and videos. Saved documents remain server-authoritative and use the existing timestamp conflict checks. |
| Coach builder athlete responses | Active assignments/links, `athlete_workout_checkins`, `workout_sessions`/`logged_sets` | Shared across day panels. Visible-tab polling every eight seconds, plus focus, tab return, reconnect and manual refresh. Each cycle refreshes membership and responses; no longer reloads the entire live program for unused labels. Failures hide old response values and show an error. |
| Coach training videos | Program/day, active assignments, video rows and profiles; private signed playback URLs | Existing entry/manual-refresh behavior and one-hour signed URLs. No new video/URL persistence. |
| Both appearance settings | Device-local theme keys | User preferences, unaffected by data-cache cleanup. |

## Authority, identity and invalidation

- Online success replaces the visible program, including an empty assignment response. Empty results and server/validation errors invalidate the previous offline copy. A transport failure while the browser still reports online remains an error; it does not become cached success.
- A newly observed assignment invalidates a different cached assignment before its program is loaded. An older request cannot repopulate storage after a newer result or account cleanup.
- Live assignments read confirmed saved program rows. Snapshot assignments read their assigned JSON and never substitute the mutable source program. Removing redundant Coach label queries does not change these rules; response RLS still checks assignment/day membership for both modes.
- Athlete program refresh runs on mount, manual refresh, tab return and reconnect. Refresh pauses while workout or check-in fields have unsaved edits, then revalidates after those edits are saved. A refresh already in flight does not overwrite newly started edits. Background loading keeps the mounted forms intact.
- Confirmed Coach mutations refresh their existing local list flows. Other sessions/devices discover changes on the Athlete refresh triggers above; this is not instantaneous cross-device delivery. Coach response polling refreshes current link/assignment membership as well as the displayed responses.
- An account change or sign-out clears disposable program copies and remounts workspace content. Late profile and data responses cannot restore the previous account. A restored session retains only that athlete's v2 copy; legacy and other-account copies are removed. Same-user token refresh does not reset forms.
- Drafts are deliberately retained on sign-out, role/account changes, assignment ending and link removal. Only the owning authenticated athlete's workspace reads/retries its queue; the server rechecks access for every submission. An unsynchronizable draft must not be expired as cache cleanup.

## Offline and storage limits

This is a bounded prescription fallback inside the existing app, not a fully offline installation. There is no service-worker app-shell cache or cached authorization/profile lookup. A cold offline start may stop at profile loading, and server revocation cannot be checked without a connection. Reconnect and refresh to verify access; cache content never authorizes an RPC.

Cached prescriptions remain visible if workout history cannot load. Existing local drafts can be recovered offline. Without a loaded history or local draft, workout-entry controls remain disabled to avoid overwriting unknown server entries; prescriptions remain readable. Check-ins and videos still require a connection.

Browser local storage is readable by code on this origin and by someone with access to the browser profile. It is not encrypted secure storage. Only the already-existing prescription fallback and pending-workout queue are persisted; no additional bodyweight, nutrition, server workout histories, roster data or signed URLs are persisted. Sensitive pending drafts have no automatic expiry because deleting them would lose user input.

Program write/cleanup failures are reported; malformed or expired disposable copies are rejected. Malformed or unavailable draft storage is reported without treating it as an empty queue or overwriting the original value. Storage cleanup cannot promise physical erasure if the browser rejects deletion; the app reports that failure and blocks affected offline copies in the running session. Manual browser-storage deletion also deletes unsynced drafts.

## Verification

Focused tests cover cache revalidation, expiry, authoritative empty/denied results, snapshots, malformed storage, identity cleanup, late responses, shared history loads, offline prescription rendering, unsaved-edit preservation, failed synchronization and newer-draft retention, plus Coach link-removal and refresh errors. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:db` for client and database verification. The database suite requires the local Docker/Supabase stack.
