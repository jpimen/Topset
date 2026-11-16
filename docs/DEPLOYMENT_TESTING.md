# Staging and production deployment guide

Use this guide when a code change needs a Supabase migration. Test the current branch against a staging Supabase project first. Do not point a Vercel Preview deployment at production data.

## 1. Create a staging Supabase project

1. Open the Supabase Dashboard and select the organization that owns Topset.
2. Select **New project**.
3. Name it `Topset Staging`, choose a region close to the production project, set a strong database password, and create the project.
4. Wait until the project is ready. In **Project Settings → General**, copy its **Project ID** (the project ref).
5. In **Project Settings → API**, note the **Project URL** and the publishable/anon key. These are used only for the staging Preview environment.

Keep the staging project separate from Production. It starts with its own Auth users and database; production accounts and data are not copied automatically.

## 2. Check and apply migrations to staging

Open PowerShell at the repository root. Sign in to the Supabase CLI if needed, then link this checkout to the staging project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase migration list --remote
```

The CLI may ask for the project's database password when linking. This is the database password set when the project was created, not the Supabase CLI login code.

Check the target name and ref in the output. The target must be the staging project. Then preview all migrations that are missing there:

```powershell
npx supabase db push --remote --dry-run
```

Read the full list. `db push` applies **every** migration missing from that project's history, in timestamp order, not just the migration for the current feature. If the target or pending list is unexpected, stop and investigate; do not use `migration repair` to bypass the mismatch.

If the target and list are correct, apply them:

```powershell
npx supabase db push --remote
```

Run the remote list again and confirm the local and remote versions match:

```powershell
npx supabase migration list --remote
```

To switch this checkout to another Supabase project later, run `npx supabase link --project-ref` with that project's ref, then repeat the target and dry-run checks before applying anything.

## 3. Point Vercel Preview at staging

1. In Vercel, open the Topset project and go to **Settings → Environment Variables**.
2. Set `VITE_SUPABASE_URL` to the staging Project URL for the **Preview** environment.
3. Set `VITE_SUPABASE_ANON_KEY` to the staging publishable/anon key for the **Preview** environment.
4. Leave the **Production** environment variables pointed at the production Supabase project. Never put a service-role or secret key in a `VITE_` variable.
5. Save the variables and redeploy the Preview deployment for the branch being reviewed. Vite embeds these values at build time, so an already-built deployment will not pick them up until redeployed.
6. Open the generated Vercel Preview URL and confirm it is not the production domain.

## 4. Test the Preview

Use accounts created in the staging project. A production account does not automatically exist in staging.

For the Athlete coach-removal change:

1. Create or sign in to a staging Coach account and generate an invite link/code.
2. Create or sign in to a staging Athlete account. Enter the Coach invite link/code and have the Coach approve the request.
3. Open Athlete **Profile** and confirm the linked Coach is shown.
4. Select **Remove coach**. Confirm the Athlete returns to the invite form and sees the reconnect guidance.
5. Enter the Coach invite again, then approve the new request from the Coach account.
6. Confirm the Athlete is linked again. Also confirm the removed Coach no longer has active linked-athlete access.

If removal still fails, open browser developer tools → **Network**, retry once, and inspect the request to `/rest/v1/rpc/remove_athlete_coach_link`. Use its status and error message with Supabase **Logs → API/Postgres** to diagnose the issue. Do not share request headers, cookies, or access tokens.

## 5. Apply migrations and deploy to Production

Do this only after the Preview works and the pending migrations have been reviewed.

1. In Supabase, confirm the production project's ref. Do not assume the currently linked project is staging or production.
2. Link the checkout to the production project and inspect its migration state:

   ```powershell
   npx supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
   npx supabase migration list --remote
   npx supabase db push --remote --dry-run
   ```

3. Verify the output explicitly names the intended production project. Review every pending migration; production `db push` applies all missing migrations, not only the current feature.
4. If the pending list is expected and the release is approved, apply migrations before deploying frontend code that depends on them:

   ```powershell
   npx supabase db push --remote
   npx supabase migration list --remote
   ```

5. Merge the reviewed branch into `main`. Vercel should build and deploy `main` to the Production environment, which must retain the production Supabase URL and key.
6. Open the production site and repeat the essential smoke test with an authorized test account.

## Local development

The repository's local `.env` may use `http://127.0.0.1:54321`. That is the local Supabase stack and has no hosted project ref. To apply migrations locally:

```powershell
npx supabase start
npx supabase migration up
```

Local migrations and hosted project migrations are separate. Use `--remote` only when you have verified which hosted project is targeted.
