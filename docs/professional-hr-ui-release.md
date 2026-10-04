# Professional HR UI and workflow release (October 2026)

This release has two parts:

- A redesign of both portals' frontends.
- One additive Supabase migration for the HR workflows the evaluation flagged as needing backend support.

## Frontend

- One design system (`src/styles.css`, Inter self-hosted). `workspace-redesign.css` and `readable-ui.css` were merged into it and removed.
- Every page has its own address. Back, forward and deep links work in both portals, and the sign-in flow returns to the page that was asked for.
- A new shell for both portals:
  - Grouped sidebar that can be collapsed.
  - Breadcrumbs and global search.
  - Notifications popover.
  - Phone bottom navigation with an "All pages" sheet.
- A shared `DataTable` with sorting, filters, paging, CSV export, row selection and a card layout on phones.
- An HR-first admin dashboard.
- Employee 360 as a full page.
- Shared approvals queues.
- Payroll pipeline with payslip preview.
- Document register.
- Charts, calendars and the Philippine holiday calendar.
- Plain-language security pages.

## Backend: `20261004090000_hr_workflow_enhancements.sql`

All changes are additive. Existing RPC call shapes keep working, because every new parameter has a default.

| Area | Change |
| --- | --- |
| Leave decisions | `review_leave_request(request_id, decision, decision_note default null)` stores HR's note and sends it to the employee. The UI requires a reason before rejecting. |
| Leave cancellation | New `cancel_leave_request(request_id)`. Only the owner can call it, and only for pending leave or approved leave that has not started. The new `Cancelled` status frees the dates. |
| Leave allowances | New `leave_policies` table (Vacation 12, Sick 12, Emergency 3, Other case by case). Every active user can read it. HR changes it through `save_leave_policy`. Balances are shown per type. |
| Statutory payroll | `generate_payroll(..., calculation_method default 'Flat rate')` adds `Philippine statutory`. It itemizes the employee shares of SSS, PhilHealth and Pag-IBIG (2025 schedules) and BIR TRAIN monthly withholding, using `private.ph_statutory_deductions`. Payslips list each line. |
| Document files | New private `hr-documents` bucket (PDF, DOCX, PNG, JPEG, TXT; 10 MB). A file is readable exactly when its document record is visible to the caller. File size and type are taken from Storage, never from the browser. Files attached to a record cannot be deleted. |
| Announcements | HR can correct or delete announcements. Inbox copies follow the change. Inbox messages are truncated to the notification limit, so long announcements can be published. |
| Admin accounts | New `manage_admin_account(operation, target_code, new_role)`, for System Administrators only. Operations: change role, deactivate, reactivate. Self-changes are blocked, and at least one active System Administrator always remains. Role changes and deactivation end every existing sign-in for the account. |

The payroll figures are estimates for the academic deployment. Confirm the current SSS, PhilHealth, Pag-IBIG and BIR tables before using them for real payroll.

## Verification

Run these locally:

```bash
npm run typecheck
npm run lint
npm test
npx supabase test db --local
node scripts/verify-hr-workflows-local.mjs
node scripts/verify-security-audit-local.mjs
npm run test:e2e:local
npm run test:mutations:local
npx playwright test
```

`scripts/verify-hr-workflows-local.mjs` exercises the new workflows through the same `supabase-js` calls the browser makes, against the local stack only:

- private upload
- signed download
- rejected file types
- role-scoped access
- role change and deactivation

## Production release: October 4, 2026, 3:48 PM Asia/Manila

- **Source.** Branch `ui-professional-overhaul` on top of `bce0462`; the fetched `origin/main` (`14082f0`) is an ancestor. Before publishing, the only newer deploy was this release's own draft; nothing published since `6abf2993` was overwritten.
- **Database.** Applied only `20261004090000_hr_workflow_enhancements.sql` to linked project `ndzgmrmpsqqpcmoxvyfu`.
  - The dry run before applying listed only this migration; the dry run after reported the remote database up to date.
  - Production has the `hr-documents` bucket, the three file policies, the five workflow functions and the seeded leave allowances.
  - The old two-argument `review_leave_request` no longer exists.
  - Anonymous calls to the new and changed functions, and to `leave_policies`, return `permission denied`.
- **Netlify.** Deploy `6ac204261eb2524116185e3a` was built with production context and verified as a draft, then published at `2026-10-04T07:48:05Z`.
  - The draft and the live domain both serve all 43 built files byte for byte.
  - `/api/health` reports the intended Supabase project, and the security headers are unchanged.
  - All 10 Netlify functions are included, among them the scheduled database safeguard.
- **Rollback.** Restore deploy `6abf29936028d55d5d2dd8f0`. The migration is additive, and the previous frontend works with it.

### Checks before release

| Check | Result |
| --- | --- |
| TypeScript and ESLint | clean |
| Unit tests | 361 passed |
| Database tests (pgTAP), on a database reset from all migrations | 166 passed (73 new) |
| HR workflow scenarios against real local Supabase | 7 passed |
| Existing security scenarios | 17 passed (rest-day fixture moved off Sunday for the run) |
| Authenticated browser tests, ported to the new labels | 16 passed |
| Protected mutation workflows | 8 passed |
| Visual, responsive and accessibility tests (light and dark, 320–1440 px, every page and dialog) | 322 passed with no baseline updates |
