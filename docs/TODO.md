# TODO

## IPF Rulebook reference

- The 2026 Technical Rulebook refers to “Appendix 2, Lifters profile and passport” on printed page 45, but the form is not included in the PDF and is not listed in its contents. Link or summarize it only if IPF publishes an authoritative copy.

## Local development checks

1. Resolve local Supabase CLI startup failure on this Windows machine: the `supabase.exe` is blocked by Application Control (`spawn UNKNOWN` from `npx`), even though Docker's Supabase containers are running. `npm run test:db` runs pgTAP through the Docker database container.
2. Re-run `npm run test:db` with Docker Desktop's Linux engine and the local Supabase stack running. On 2026-11-03 the engine pipe was unavailable, so database permission checks could not execute during the caching changes.

## Calculation engine follow-up

1. Find a reliable source for 11–12 rep RPE values. The table is limited to 1–10 effective reps; unsupported combinations return an explicit range error rather than guessed values.
2. Recheck official coefficient version/range when updating DOTS, Wilks, or IPF GL scoring support.

## Before using a hosted deployment

1. Apply all versioned migrations to a local Supabase project and run the database permission tests.
2. Configure email confirmation and Google OAuth redirect URLs for the deployed origin.
3. Resolve account onboarding for Google signups so a new OAuth account receives a selected role before entering a role route.

## Milestone 5 follow-up

1. Extend the existing Coach builder log review with planned-versus-actual analysis.
2. Add an end-to-end browser test for create, rename, confirmed save, live update, and snapshot immutability using isolated coach and athlete sessions.
3. Add offline draft storage and retry for workout-day check-ins; they currently require an active connection to load and save.
4. Replace the Progress and Profile placeholders with athlete analytics, meet details, bodyweight history, maxes, unit, and plate settings.
5. Add the rest timer and next-set focus mode to Today.
6. Consider IndexedDB for larger offline histories; the current queue stores compact pending workout drafts in browser local storage.
7. If requested, add a deliberate recovery/export flow for malformed or permanently unsynchronizable pending workouts. Existing input is retained and errors are shown; never delete these drafts as cache expiry.
8. Full offline app startup and immediate cross-device updates remain outside the bounded prescription fallback. See [data caching audit](DATA_CACHING.md); collect navigation/request timing evidence before adding more Coach caches.

## Milestone 3 Phase B (requires approval)

1. Add keyboard-accessible drag/drop reorder and cross-day moves, bulk row actions, superset groups, day/week duplication, and progression-copy previews.
2. Add optional blocks and athlete e1RM preview sources; use `src/lib/engine` for rounded loads, volume summaries, plates, and warm-up estimates.
3. Build the linked-athlete roster and athlete detail/max editing only after M4 linking exists. No fake roster data is used in Phase A.
4. Add the requested 500-row performance and accessibility checks with the Phase B grid features.

## Later milestones

1. Add secure role-choice onboarding for new Google OAuth accounts (deferred from M2).
2. Do a mobile responsive pass on the authentication screens (deferred from M2).
3. Build the coach-only peaking module and athlete-facing peak results in Milestone 6.
4. Add deeper athlete/coach analytics and program export in Milestone 7.
5. Continue with the approved build order and request approval before each later milestone.

6. add a chat system between coach and athlete.

## Appearance follow-up

- Sync the user's Light/Dark theme preference to their profile when cross-device settings are implemented.

