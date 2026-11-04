# Coach as Athlete

A Coach account can keep its Coach workspace and request a training relationship with another Coach using the same account.

## Set up a Coach relationship

1. The Coach who will provide training opens **Athletes** and creates an invite link.
2. The Coach who wants to train opens **Train with a Coach** in their Coach workspace and submits that invite link or code.
3. The request appears in the other Coach's **Athletes** page. They can approve or decline it.
4. After approval, the providing Coach can assign a program from **Programs**. Choose a start date and live or snapshot behavior as usual.
5. The dual-capability account uses **Switch to Athlete** in the top bar to open its Athlete workspace. The assigned program appears when its start date arrives. **Switch to Coach** returns to its Coach workspace.

Submitting a valid request through the server RPC grants the account Athlete capability so the user can open Athlete navigation and see request status. A pending relationship grants no program, workout, or check-in access. Those remain scoped by the active relationship, assignment status, and start date. The Athlete tools use the same program loader, workout records, check-ins, and offline draft queue as Athlete-only accounts.

## Data model and migration

`profiles.role` remains the immutable signup persona for compatibility. Authorization uses the normalized `profile_capabilities` table, with one row for each granted capability. The migration backfills each existing profile from its current role; profile creation grants only the selected signup capability. Authenticated clients can read their own capability rows but cannot insert, update, or delete them. A valid invite request can add Athlete capability only through the server-side request RPC. Coach capability is never granted through that RPC.

Apply the migration with the rest of the Supabase migration set:

```powershell
npx supabase db reset
```

For a linked environment, use the normal reviewed migration workflow (`supabase link` followed by `supabase db push`). Do not manually edit `profiles.role` or `profile_capabilities` from the client.

The migration preserves existing Coach and Athlete accounts, links, assignments, and assignment snapshots. The legacy role column is not removed; it is no longer used as an access grant after migration. The migration file documents rollback considerations because removing capabilities added after migration would require review.

## Verification

The database suite adds pgTAP checks for self-invite rejection, server-side capability grants, pending-link access, approval and assignment, dual-role program and workout access, isolation of Coach-owned programs, and revocation after link removal. Run it with:

```powershell
npm run test:db
```

Vitest covers workspace preference and capability routing. A repeatable browser end-to-end test for this two-account flow remains follow-up work.
