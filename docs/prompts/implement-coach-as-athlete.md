yft\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\dnmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm








# Implementation prompt: coach account that is also an athlete

Work in the existing Topset repository. Implement the ability for a Coach to train under another Coach using the same account: the account keeps its own Coach workspace and can also join another Coach as an Athlete, receive an assigned program, and use the Athlete workout experience. Before editing, read `AGENT.md`, `Spec.md`, `docs/TODO.md`, `docs/DECISIONS.md`, and inspect the current auth model, role guards, navigation, coach-athlete linking, program assignments, athlete program loading, workout logging, migrations, and database permission tests. Treat the current repository as authoritative; verify every table, policy, helper, and route before relying on it.

## Current constraints to account for

- `profiles.role` currently allows exactly one value (`coach` or `athlete`), is set during signup, and is protected from updates.
- Auth context and route guards model one role and redirect users to one workspace.
- Coach-athlete links and assignment RPCs/RLS distinguish roles using that single profile role.
- The Athlete program screen already supports assigned live and snapshot programs, workout logging, check-ins, and offline sync.
- Coaches already have their own program builder, program assignments, roster, and Coach-only workspace.

Do not implement this as a Coach-only UI shortcut or by changing a Coach's role to `athlete`. The database must represent both capabilities safely, and existing Coach behavior must remain available.

## Desired behavior

- Existing Coach accounts retain all current Coach capabilities and data.
- A Coach can use the existing invite-code/link flow to request a relationship with a different Coach as an Athlete. Do not allow linking an account to itself.
- The other Coach can approve or decline the request using the existing relationship workflow.
- Once approved, the dual-role account can receive one active assignment from that Coach, with the existing start-date and live-versus-snapshot semantics.
- The user can intentionally switch between Coach workspace and Athlete workspace. Make the active workspace obvious and provide an accessible way to switch without signing out. Keep Coach and Athlete navigation separate; in Athlete mode, show the assigned program and athlete tools, not Coach builder controls.
- In Athlete mode, the Coach-as-Athlete can review the assigned program, log their own workouts, and manage their own check-ins using existing behavior. Their workout and check-in data belongs to their own user ID and is not visible to unrelated users.
- In Coach mode, their own programs, roster, assignments, settings, and existing Coach routes continue to work unchanged.
- An account may be a Coach for other users while being an Athlete of one other Coach. Preserve the existing one-active-coach-per-athlete rule and one-current-assignment behavior unless repository evidence shows a different current invariant.

## Data model and authorization

- Design an additive, versioned migration that represents Coach and Athlete capabilities independently while preserving all existing accounts and their current behavior. Choose a normalized capability/role representation that fits the existing schema, and document the migration/backfill and compatibility strategy before coding. Do not permit a user to grant themselves Coach capability or modify protected role state from the client.
- Update signup/profile creation and any role checks so existing Coach and Athlete signup flows remain valid. Provide a secure, server-authorized way for a Coach to enable Athlete capability when they request or accept a relationship; a pending request must not grant access to an assignment.
- Review every affected security-definer function, RPC, trigger, profile visibility policy, coach-athlete link policy, assignment policy, program policy, workout-session/log policy, check-in policy, and storage policy. Authorization must be based on the appropriate capability and active relationship, not on one mutually exclusive role value.
- Keep enforcement in Postgres RLS/RPCs. Never broaden access to all programs, assignments, logs, check-ins, profiles, or files to make the client work.
- Verify that a dual-role user can act as a Coach only on programs and athletes they own/link, and as an Athlete only on their own active relationship and assignment. Preserve access revocation when a relationship is removed and future-start-date restrictions.
- Prevent a dual-role user from using their Coach authority to read or alter their own Athlete assignment/logs unless the existing Athlete permissions independently allow that access. Prevent the other Coach from gaining access to the dual-role user's Coach-owned programs or roster.

## Implementation process

1. Before editing, summarize the current role/link/assignment flow, the data-model choice, top risks, and a concise file and migration plan. Follow the repository's approval requirements for multi-surface changes.
2. Implement the secure data-model and database permission changes first, with focused pgTAP coverage. Keep migrations additive and follow local naming conventions.
3. Update auth context, route guards, home redirect, workspace navigation, and workspace switching so each capability is gated independently and the selected workspace survives navigation appropriately. Do not weaken logged-out or wrong-capability redirects.
4. Reuse the existing Coach invite/link and Athlete assigned-program/workout systems where appropriate. Avoid duplicating the athlete program loader or creating a second workout data model. Preserve live/snapshot behavior, offline draft safety, and current Coach builder behavior.
5. Add focused tests for navigation, workspace switching, role/capability routing, signup/backfill behavior, and relevant data access. Follow existing test conventions; do not create a parallel testing framework.
6. Update `README.md`, `docs/TODO.md`, and `docs/DECISIONS.md` with completed behavior, migration/setup notes, decisions, and any deferred work.
7. Run the relevant typecheck, lint, unit/integration, and database permission checks. Exercise the Coach-to-Athlete relationship and workspace switch in the app when the local environment permits. Report exact commands and results, including any checks blocked by local Supabase or browser setup.

## Acceptance criteria

- Existing Coach-only and Athlete-only accounts continue to sign in and reach the correct workspace with unchanged access.
- A Coach can request to join another Coach through the supported invite flow, cannot join themselves, and gains no Athlete access before approval.
- After approval, the user can switch between Coach and Athlete workspaces without changing accounts or losing either capability.
- The Athlete workspace shows only the active, started assignment from the linked Coach and supports the existing live/snapshot, workout logging, check-in, and offline behavior.
- The Coach workspace retains its program builder, linked-athlete roster, assignments, and other existing Coach features.
- RLS tests prove allowed self/owner access and deny cross-user, unrelated-coach, pending-link, removed-link, future-assignment, and cross-workspace privilege escalation cases.
- No client-side role editing, permissive fallback policy, duplicate workout store, or regression to existing account authorization is introduced.
- Migrations, application behavior, security tests, documentation, and final report agree on the implemented capabilities and remaining limitations.
