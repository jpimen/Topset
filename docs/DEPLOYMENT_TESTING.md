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

The new frontend is loading, but its request to the configured Supabase project failed. This version reads profile fields added by migration `202610310004`.

1. In Vercel, open **Settings → Environment Variables** and inspect the **Preview** value for `VITE_SUPABASE_URL`. The project ref is the part before `.supabase.co` in that URL. Do not share the anon key.
2. Open that exact Supabase project and check whether the Topset migrations are applied.
3. If it is a staging project with the earlier Topset schema already installed, apply `supabase/migrations/202610310004_athlete_profile_details_and_photos.sql` there.
4. If it is a new empty staging project, apply all the application's migrations in timestamp order. Migration `202610310004` depends on tables created by earlier migrations.
5. Return to Vercel and redeploy the Preview, then sign in again.

Do not apply the migration to production just to clear this error. First confirm the Preview environment points to the intended staging project.

### If sign-in says “Your account profile is not available yet”

This means the profile query returned no row for the signed-in Supabase user. Supabase Auth accounts and profile rows belong to a specific Supabase project; a user from Production is not automatically present in Staging. Topset normally creates the profile row with a database trigger when the user signs up.

1. Confirm the Preview `VITE_SUPABASE_URL` points to the staging project where you intend to test.
2. In that Supabase project, open **Authentication → Users** and check that your test user exists.
3. Open **Table Editor → profiles** and check whether a row exists for that user's ID.
4. If the user exists but the profile row does not, verify that the initial migration `202610260001_initial_roles_and_access.sql` (which installs the profile-creation trigger) and the remaining migrations were applied successfully.
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
