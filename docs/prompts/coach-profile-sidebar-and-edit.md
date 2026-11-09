# Implementation prompt: coach profile page

Work in the existing Topset repository. Add a **Profile** destination to the Coach workspace sidebar and implement a Coach profile page where the signed-in Coach can view their complete, relevant profile and choose **Edit profile** to update it. This is an implementation task: make the application changes, not another prompt or a visual-only mockup. Before editing, read `AGENT.md`, `Spec.md`, `docs/TODO.md`, `docs/DECISIONS.md`, and inspect the current routes, navigation, auth/profile types, profile schema and policies, photo storage policies, and the existing Athlete profile implementation. Treat the current repository and migrations as authoritative; verify every table, field, policy, and helper before relying on it.

## Existing patterns to verify

- Coach routes and the shared sidebar live in `src/App.tsx`; navigation links are provided by `src/lib/workspaceNavigation.ts`.
- The auth context exposes the signed-in `UserProfile` and `refreshProfile` from `src/auth/AuthProvider.tsx`.
- `src/components/athlete/AthleteMorePages.tsx` contains an existing profile display/edit and photo-upload pattern. Reuse its applicable behavior and visual conventions without making Coach profile controls appear in Athlete pages.
- Coach and Athlete profiles share a database row. Current profile fields include name, team/gym name, weight class, bio, category, achievements, and profile-photo path. The signed-in email comes from Supabase Auth, not the profile row. Verify the current schema and migration history before using this inventory.
- Profile photos are stored privately and the existing bucket policies are Athlete-oriented. Do not assume a Coach can upload, read, or delete objects there; inspect and update authorization safely if photo editing is included.

## Scope and behavior

- Add a Coach-only sidebar item labeled **Profile** and a role-guarded route at `/coach/profile`. Keep all existing Coach and Athlete routes and navigation behavior intact.
- The page should clearly identify the signed-in Coach and present every applicable, populated Coach profile/account detail supported by the current schema. At minimum, inspect and handle the Coach's name, email, team/gym, bio, category or discipline, achievements, and profile photo. Show email as read-only unless the repository already has a secure, supported email-change flow. Do not invent profile values or present Athlete-only metrics as Coach fields; if an existing populated field is relevant, do not silently omit it.
- Include a clearly visible **Edit profile** control. In edit mode, allow changes to the editable Coach profile fields, with clear **Save profile** and **Cancel** actions. Cancel restores the last saved values; a successful save refreshes the auth profile and returns to a truthful saved/read-only state.
- Reuse existing data-access and validation patterns. Save only the authenticated user's own profile. Do not alter role, identity, or other protected columns. If photo upload is supported, enforce the existing file type/size constraints and ensure storage and database policies authorize only the owner (without granting unrelated users access).
- Match the app's existing Coach design tokens and components. Preserve desktop-first Coach density while making the page usable on narrow screens, keyboard accessible, and consistent with the Athlete profile experience where appropriate.

## Reliability and security

- Provide explicit loading, missing-profile, save-in-progress, saved, and error states. Surface failures in the UI and log technical causes using established conventions; do not silently ignore them.
- Validate user-editable fields using the repository's existing validation approach and schema limits. Treat text as untrusted input and render it as text.
- Keep authorization enforced by Supabase RLS/storage policies. Do not weaken policies or expose another user's profile or private photo.
- Make database changes only through additive, versioned migrations when inspection proves they are needed. Do not make a migration just to duplicate fields or bypass existing policy boundaries.
- Do not add a dependency or refactor unrelated profile, authentication, or workspace behavior.

## Implementation process

1. Summarize the existing profile and navigation flow, assumptions, security risks, and a concise file/migration plan before coding. Follow `AGENT.md` approval requirements for any broader or security-sensitive change.
2. Describe the page layout and its loading, view, edit, save, cancel, and error states before implementation.
3. Implement the Coach route/navigation and profile view/edit flow using existing conventions. Keep Coach and Athlete behavior separated.
4. Add or update focused tests for navigation, rendering, edit/cancel/save behavior, and any changed authorization policy. Test both authorized own-profile access and denial of cross-user access if policies change.
5. Run the smallest relevant tests, then the required typecheck/lint/build checks supported by the environment. Review the diff for regressions and accidental scope expansion.
6. Update directly related documentation and `docs/DECISIONS.md` / `docs/TODO.md` as appropriate. Report changed files, behavior, checks and results, and any remaining limitations. Do not claim browser or database verification unless it actually ran.

## Acceptance criteria

- A Coach sees a **Profile** link in the Coach sidebar; it opens `/coach/profile` and is not added to Athlete navigation.
- The page shows the signed-in Coach's applicable existing profile and account information, with email handled as read-only unless a secure email-change flow already exists.
- **Edit profile** opens an accessible editing state; Save persists allowed changes and refreshes the displayed profile, while Cancel discards unsaved edits.
- Loading and failures are clearly communicated; successful saves are confirmed only after the backend succeeds.
- No role/identity fields or other users' data can be changed or exposed. Any photo access follows verified owner-only authorization.
- Existing Coach and Athlete routes, profile behavior, and appearance remain intact.
