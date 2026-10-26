# Topset

Topset is a powerlifting program builder for coaches and athletes. This first milestone contains the app scaffold, role-based account flow, route guards, and the initial Supabase schema and row-level security policies. The calculation engine and training workflows have not been started.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A Supabase project, or the Supabase CLI and Docker for local development

## Run the web app

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set the Supabase project URL and anon/publishable key.
3. Start the dev server:

   ```powershell
   npm run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:5173`). Use **Create account** to choose Coach or Athlete, then complete the relevant signup fields.

If email confirmations are enabled in Supabase, confirm the email before signing in. Google sign-in is shown for existing accounts after enabling the Google provider and setting its callback URL in Supabase Auth. New Google account onboarding is deferred because it needs a secure role-choice callback.

## Database setup

For a local Supabase stack, install Docker and the Supabase CLI, then run:

```powershell
npm install
npx supabase start
npx supabase db reset
Copy-Item .env.example .env
npx supabase status
notepad .env
npm run dev
```

`npx supabase db reset` applies the migrations in `supabase/migrations`. Copy the `API_URL` and `ANON_KEY` values from the status output into the matching variables in `.env`, save the file, and then start Vite. The local database starts empty, so open the app and create an account before trying to sign in. If you already have a `.env`, update it instead of copying over it.

Use the `API_URL` and `ANON_KEY` values shown by `npx supabase status` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. For example, the local API URL is usually `http://127.0.0.1:54321`. Never put the service role or secret key in the web app's `.env`.

For a hosted project, link the project with the Supabase CLI and push the migration:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from that project in `.env`.

## Troubleshooting

- Docker Desktop must be running before starting local Supabase.
- Run the local setup commands in this order: `npm install`, `npx supabase start`, `npx supabase db reset`, copy `.env.example` to `.env`, then `npm run dev`.
- Get the local API URL and anon key with `npx supabase status`; put those values in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. Do not use the example placeholders or the service role key.
- If `.env` changes while Vite is running, stop the dev server and run `npm run dev` again.
- The local database starts empty. Create a coach or athlete account on the signup screen before attempting to sign in.
- If sign-in reports that the server cannot be reached, confirm Supabase is running with `npx supabase status`, then check that the URL and anon key in `.env` match that output.

## Verify

```powershell
npm run build
supabase test db
```

The SQL permission tests cover role profile visibility, coach-owned programs, athlete assignment reads, blocked prescription edits, and immutable account roles. They require a running local Supabase stack.

## Current milestone boundary

The role home screens are placeholders. Coach-athlete link requests, invite-code validation, program editing, athlete logging, and the calculation engine are later milestones. The schema includes the initial link and assignment tables so access rules can be established early; it does not yet implement link management or immutable snapshots for `sync_mode = 'snapshot'`.
