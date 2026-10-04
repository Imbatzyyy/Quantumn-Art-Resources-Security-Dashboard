# HR workflow database migration (October 2026)

## Status

- **Production frontend.** Netlify deploy `6abf29936028d55d5d2dd8f0`. A redesign of both portals, with screens for the features below, was published on October 4, 2026 as deploy `6ac204261eb2524116185e3a`. At the owner's request it was rolled back the same day, at 07:53 UTC.
- **Redesign source.** Saved on branch `ui-professional-overhaul` (commit `2371959`). It is not on `main`.
- **Production database.** `20261004090000_hr_workflow_enhancements.sql` stays applied to `ndzgmrmpsqqpcmoxvyfu`. It is additive, and the current frontend works with it unchanged: every new RPC parameter has a default, and the current UI does not read the new tables or columns. The migration file stays in this repository so that the local and remote migration histories match.

## What the migration adds

| Area | Change |
| --- | --- |
| Leave decisions | `review_leave_request(request_id, decision, decision_note default null)` stores HR's note and sends it to the employee. |
| Leave cancellation | New `cancel_leave_request(request_id)`. Only the owner can call it, and only for pending leave or approved leave that has not started. Adds the `Cancelled` status. |
| Leave allowances | New `leave_policies` table (Vacation 12, Sick 12, Emergency 3, Other case by case). Every active user can read it. HR changes it through `save_leave_policy`. |
| Statutory payroll | `generate_payroll(..., calculation_method default 'Flat rate')` adds `Philippine statutory`. It itemizes the employee shares of SSS, PhilHealth and Pag-IBIG (2025 schedules) and BIR TRAIN monthly withholding, using `private.ph_statutory_deductions`. |
| Document files | New private `hr-documents` bucket (PDF, DOCX, PNG, JPEG, TXT; 10 MB). A file is readable exactly when its document record is visible to the caller. File size and type are taken from Storage. Files attached to a record cannot be deleted. |
| Announcements | HR can update or delete announcements, and inbox copies follow the change. Inbox messages are truncated to the notification limit. |
| Admin accounts | New `manage_admin_account(operation, target_code, new_role)`, for System Administrators only. Operations: change role, deactivate, reactivate. Self-changes are blocked, and at least one active System Administrator always remains. |

Payroll figures are estimates for the academic deployment. Confirm the current SSS, PhilHealth, Pag-IBIG and BIR tables before using them for real payroll.

## Verification

- **Database tests.** `npx supabase test db --local` ran on a database reset from all migrations: 166 passed, 73 of them for this migration.
- **Real-client check.** `node scripts/verify-hr-workflows-local.mjs` passed 7 scenarios through `supabase-js` against the local stack:
  - leave notes and cancellation
  - allowances
  - statutory payroll
  - private file upload and signed download
  - announcement edits
  - admin role changes
- **Production checks.**
  - Before applying, the dry run listed only this migration; afterwards the remote database was up to date.
  - The bucket, storage policies and functions are present.
  - Anonymous calls to the new and changed functions, and to `leave_policies`, are denied.
