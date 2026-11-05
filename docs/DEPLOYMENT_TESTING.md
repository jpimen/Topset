# Step-by-step: view and test the athlete UI preview

The changes are on the GitHub branch `codex/athlete-profile-preview-20261031` at commit `fa04e18`. The production branch is `main`. A Vercel Preview lets you review this branch without changing the production site.

## A. Open the correct Vercel deployment

1. Go to [vercel.com](https://vercel.com) and sign in to the account connected to Topset.
2. Open the **Topset** project.
3. Select **Deployments** in the project navigation.
4. Find a deployment whose branch is `codex/athlete-profile-preview-20261031` and whose commit is `fa04e18` (or a later commit on that branch).
5. Wait for its status to say **Ready**. Open that deployment and click **Visit**.
6. Check the address bar. Use the generated Vercel deployment URL, not the production domain.

The updated athlete UI should have only **Program**, **Progress**, and **Profile** in its navigation. The Profile page heading should say **Your athlete profile** and include **Upload photo** and the training profile form. If you see a **Today** tab and **Your account**, you are still looking at the older deployment.

## B. If the branch deployment is missing

1. In the Vercel project, open **Settings → Git**.
2. Confirm the connected repository is `jpimen/Topset` and the production branch is `main`.
3. Return to **Deployments** and refresh. A push to a non-production branch normally creates a Preview deployment automatically.
4. If no deployment started, choose **Create Deployment**, select or enter `codex/athlete-profile-preview-20261031`, and start the deployment.
5. If the repository is not connected, connect `jpimen/Topset` to this Vercel project first. Do not change the production branch to the preview branch.
6. Open the deployment's build logs if its status is **Error**. A failed build has no working Preview URL.

Vercel may protect Preview URLs. If asked, sign in with an account that has access to the Vercel project.

### If sign-in says “We could not load your account profile”

The app authenticated you, but one of its database reads failed. The current frontend reads the profile row and then the user's capability rows from `profile_capabilities`. A common cause after deploying the Coach/Athlete workspace update is that the frontend was deployed before migration `202611040001_independent_account_capabilities.sql` was applied to the Supabase project configured for that deployment. A wrong Supabase URL, incomplete migration history, or a database permission error can produce the same message. The UI intentionally does not show raw database errors.

Follow these steps for the exact environment that showed the error (Preview and Production may point to different Supabase projects):

1. In Vercel, open **Settings → Environment Variables** for the affected environment and inspect `VITE_SUPABASE_URL`. Identify the Supabase project ref from the URL. Never paste or share `VITE_SUPABASE_ANON_KEY`, and never put a service-role key in a `VITE_` variable.
2. Open that exact project in Supabase. In **SQL Editor**, check whether the capability table exists:

   ```sql
   select to_regclass('public.profile_capabilities') as capability_table;
   ```

   If the result is `null`, the capability migration is missing. If it returns `profile_capabilities`, continue with step 4.
3. From the repository root on a trusted machine, link the CLI to the exact intended project, inspect the migration state, then apply missing migrations:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase migration list
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Review the dry-run output before applying. For a new empty project, this applies the full migration chain in timestamp order. For an existing project, it applies migrations missing from that project's history. Do not run this against Production until you have confirmed the linked project and reviewed the pending migrations. Do not manually add capability rows or edit `profiles.role` to work around a missing migration.
4. If the table exists, open the browser's developer tools, select **Network**, retry sign-in, and inspect the failed request to `/rest/v1/profile_capabilities` or `/rest/v1/profiles`. A `404` usually means the frontend points to a project missing the table/schema; a `401` or `403` points to authentication, grants, or RLS configuration. Confirm the frontend's Supabase URL is the project you inspected, and check that the deployed frontend and database use this repository's matching migration version. If the exact cause is not clear, use the request's HTTP status and Supabase **Logs → API/Postgres** to identify the database error; do not share request headers or tokens.
5. After correcting the database or environment variables, redeploy the affected Vercel environment so it uses the intended variables and current frontend build. Retry sign-in. If the page was left open during deployment, reload it first.

Do not point Preview at Production data or apply migrations to Production just to clear this message. Verify the target project and migration plan first.

### If sign-in says “Your account profile is not available yet”

This means the profile query returned no row for the signed-in Supabase user. It differs from “We could not load your account profile,” which means a database request failed. Supabase Auth accounts and profile rows belong to a specific Supabase project; a user from Production is not automatically present in Staging. Topset normally creates the profile row with a database trigger when the user signs up.

1. Confirm the Preview `VITE_SUPABASE_URL` points to the staging project where you intend to test.
2. In that Supabase project, open **Authentication → Users** and check that your test user exists.
3. Open **Table Editor → profiles** and check whether a row exists for that user's ID.
4. If the user exists but the profile row does not, verify that the initial migration `202610260001_initial_roles_and_access.sql` (which installs the profile-creation trigger) and the remaining migrations were applied successfully, including `202611040001_independent_account_capabilities.sql` for the current app.
5. After the migrations are installed, create a fresh test account from the Preview app using **Create account**. Use a staging-only email address. The signup trigger should create its profile row.
6. Return to the Preview and sign in with that staging test account.

Do not delete or edit production users to fix a staging profile. If a new staging signup still has no profile row, stop and inspect the Supabase Auth/database logs; the signup trigger may have failed.

## C. Point Preview at a staging Supabase project

Use a Supabase staging project for testing. Do not point the Preview deployment at production data.

1. In the Vercel project, open **Settings → Environment Variables**.
2. Add or edit `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the **Preview** environment using the staging project's API URL and anon/public key.
3. Keep the **Production** values pointed at the production Supabase project. Never use a Supabase service-role or secret key in a `VITE_` variable.
4. Save the variables, return to **Deployments**, and redeploy the Preview branch so the new values are included in the frontend build.

The new Profile page selects columns added by migration `202610310004_athlete_profile_details_and_photos.sql`. The staging database must have the application's migrations applied before signing in to the preview.

### Apply migrations to staging

If the Supabase CLI is available on a trusted machine, run these commands from the repository root. Use the staging project's ref, not production's:

```powershell
supabase login
supabase link --project-ref YOUR_STAGING_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push
```

Review the dry-run list before applying. `db push` applies every migration that is missing from that project's history, in timestamp order.

This Windows machine has previously blocked the Supabase CLI executable with Application Control. If it is still blocked, run the commands on another authorized machine or CI runner. Avoid applying only migration `202610310004` to a brand-new, empty database; earlier migrations create the tables and policies it depends on.

If a migration was already applied manually in the Supabase SQL Editor, reconcile migration history before a later `db push`. After verifying the SQL is present, run:

```powershell
supabase migration repair --status applied 202610310004
```

This command changes the migration history record only; it does not apply the SQL. Do not use it unless the migration actually ran.

## D. Sign in and check the updates

Use test accounts that belong to the staging Supabase project.

1. Visit the Preview URL and sign in as an athlete.
2. Open `/athlete`. It should redirect to `/athlete/program`; there should be no Today tab.
3. Log a set and finish the next workout in the **Next workout** section. Refresh and confirm the log remains.
4. Open **Profile**. Enter a bio, category/division, weight class, team/gym, and achievements. Select **Save profile**, refresh, and confirm the details persist.
5. Upload a JPG, PNG, or WebP under 5 MB. Refresh and confirm it appears. Unsupported file types and files over 5 MB should be rejected.
6. To check offline logging, open browser developer tools, switch the Network setting to **Offline**, edit a set, switch back **Online**, and confirm the pending change syncs.

## E. Deploy to production later

After the Preview works, apply the pending migrations to production, then merge the reviewed branch into `main`. Vercel should create a Production deployment from `main`. Apply the database migration before deploying frontend code that reads the new profile columns.

For this repository, the preview branch can be opened as a pull request from GitHub:

`https://github.com/jpimen/Topset/pull/new/codex/athlete-profile-preview-20261031`
