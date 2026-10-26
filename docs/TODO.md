# TODO

## Local development checks

1. Repair the existing `npx supabase test db` failures in `supabase/tests/database/roles.test.sql` (a data-modifying `WITH` error, the assigned-program assertion, and the test plan mismatch).
2. Add or document the lint command; this project currently has no `lint` script.

## Before using a hosted deployment

1. Apply the initial migration to a local Supabase project and run the database permission tests.
2. Configure email confirmation and Google OAuth redirect URLs for the deployed origin.
3. Resolve account onboarding for Google signups so a new OAuth account receives a selected role before entering a role route.

## Later milestones

1. Implement secure coach invites, athlete join requests, and link approval/removal flows.
2. Define program versioning and true snapshot storage for snapshot assignments.
3. Continue with the approved build order and request approval before each later milestone.
