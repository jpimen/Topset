# Deployed preview testing

Use a Vercel Preview deployment connected to a separate Supabase staging project to test changes before production.

## 1. Prepare the staging database

Create or select a Supabase project reserved for testing. From the repository root, authenticate and link the Supabase CLI to that staging project:

```powershell
supabase login
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

Review the dry-run output before applying migrations. The current athlete profile update requires migration `202610310004_athlete_profile_details_and_photos.sql`; it adds profile fields and creates a private profile-photo bucket with storage access policies.

If the SQL was already applied manually in the Supabase SQL Editor, do not run `db push` until migration history is reconciled. After confirming the SQL completed successfully, mark the migration as applied with:

```powershell
supabase migration repair --status applied 202610310004
```

`migration repair` only updates migration history; it does not apply SQL. Use it only after verifying that the migration has already run on that project.

## 2. Configure Vercel Preview

In the Vercel project settings, set these variables for the **Preview** environment to the staging Supabase project values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Keep Production variables pointed at the production Supabase project. Vite embeds these values into the frontend build, so redeploy after changing them.

Push the changes to a branch other than the configured production branch. If the Git repository is connected to Vercel, Vercel creates a Preview deployment for that branch. Use its generated URL for the checks below.

## 3. Smoke-test the athlete changes

Use test accounts in the staging project:

1. Sign in as an athlete and open `/athlete`. Confirm it redirects to `/athlete/program` and the Today tab is gone.
2. Log a set and finish the next workout from Program. Refresh and confirm the session remains logged.
3. In Profile, save a bio, category/division, weight class, team/gym, and achievements. Refresh and confirm they persist.
4. Upload a JPG, PNG, or WebP image under 5 MB. Refresh and confirm it appears. Confirm an unsupported image type and an image over 5 MB are rejected.
5. Temporarily take the browser offline, edit a workout set, reconnect, and confirm the pending change syncs.
6. Sign in as a different, unlinked athlete and confirm the first athlete's private profile photo cannot be read.

## 4. Promote after Preview passes

Apply the pending migrations to the production Supabase project, then deploy the changes through the configured production branch. Apply the additive database migration before serving the frontend that reads the new profile columns.

## Local CLI note

This Windows setup has previously blocked the Supabase CLI executable with Application Control. If the CLI remains blocked, use an authorized development machine or CI runner with the CLI to link and push migrations. The Supabase Dashboard SQL Editor is a fallback for applying the migration SQL, but migration history must then be reconciled as described above.
