# TODO

## Local development checks

1. Resolve local Supabase CLI startup failure on this Windows machine: the `supabase.exe` is blocked by Application Control (`spawn UNKNOWN` from `npx`), even though Docker's Supabase containers are running. `npm run test:db` runs pgTAP through the Docker database container.

## Calculation engine follow-up

1. Find a reliable source for 11–12 rep RPE values. The table is limited to 1–10 effective reps; unsupported combinations return an explicit range error rather than guessed values.
2. Recheck official coefficient version/range when updating DOTS, Wilks, or IPF GL scoring support.

## Before using a hosted deployment

1. Apply the initial migration to a local Supabase project and run the database permission tests.
2. Configure email confirmation and Google OAuth redirect URLs for the deployed origin.
3. Resolve account onboarding for Google signups so a new OAuth account receives a selected role before entering a role route.

## Milestone 3 Phase B (requires approval)

1. Add keyboard-accessible drag/drop reorder and cross-day moves, bulk row actions, superset groups, day/week duplication, and progression-copy previews.
2. Add optional blocks and athlete e1RM preview sources; use `src/lib/engine` for rounded loads, volume summaries, plates, and warm-up estimates.
3. Build the linked-athlete roster and athlete detail/max editing only after M4 linking exists. No fake roster data is used in Phase A.
4. Add the requested 500-row performance and accessibility checks with the Phase B grid features.

## Later milestones

1. Implement secure coach invites, athlete join requests, and link approval/removal flows (deferred from M2).
2. Add secure role-choice onboarding for new Google OAuth accounts (deferred from M2).
3. Do a mobile responsive pass on the authentication screens (deferred from M2).
4. Define program versioning and true snapshot storage for snapshot assignments.
5. Continue with the approved build order and request approval before each later milestone.
