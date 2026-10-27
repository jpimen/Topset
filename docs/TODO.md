# TODO

## Local development checks

1. Add or document the lint command; this project currently has no `lint` script.
2. Resolve local Supabase CLI startup failure on this Windows machine: the `supabase.exe` is blocked by Application Control (`spawn UNKNOWN` from `npx`), even though Docker's Supabase containers are running.

## Calculation engine follow-up

1. Decide whether to publish/approve RPE chart entries beyond 10 all-out reps; unsupported combinations currently return an explicit range error rather than guessed values.
2. Recheck official coefficient version/range when updating DOTS, Wilks, or IPF GL scoring support.

## Before using a hosted deployment

1. Apply the initial migration to a local Supabase project and run the database permission tests.
2. Configure email confirmation and Google OAuth redirect URLs for the deployed origin.
3. Resolve account onboarding for Google signups so a new OAuth account receives a selected role before entering a role route.

## Later milestones

1. Implement secure coach invites, athlete join requests, and link approval/removal flows (deferred from M2).
2. Add secure role-choice onboarding for new Google OAuth accounts (deferred from M2).
3. Do a mobile responsive pass on the authentication screens (deferred from M2).
4. Define program versioning and true snapshot storage for snapshot assignments.
5. Continue with the approved build order and request approval before each later milestone.
