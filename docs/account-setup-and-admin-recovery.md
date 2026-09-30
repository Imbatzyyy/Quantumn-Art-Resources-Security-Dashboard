# Employee setup and administrator recovery

This change builds on `10f256a` (readable portal UI) and preserves the earlier session-bound email sign-in, MFA, mobile navigation, and Supabase access controls.

## Employee first-use acknowledgment

- Only employees marked `must_change_password: true` see the required two-step setup.
- Step one displays the Terms and Conditions and Privacy Notice before any password fields. Separate, initially unchecked controls record agreement and acknowledgment. The user may review them again or sign out.
- `src/utils/accountPolicies.js` is the shared source for the text and version identifiers. Bump the relevant version whenever its text changes.
- `/api/complete-initial-password` rejects missing, false, or outdated acknowledgment values. It verifies the temporary password and saves the server timestamp, document versions, and flags in protected Supabase Auth `app_metadata.setup_acknowledgment` in the same Auth update as the new password. Browser-editable `user_metadata` is not used.
- The audit event also identifies the accepted versions. Existing setup-complete employees are not forced through onboarding again.

The included copy describes the implemented academic portal, not a legal-compliance certification or blanket consent. On September 30 the user authorized publication and requested Philippine-law-informed wording for a school project. The user supplied `quantumnhr@gmail.com` as the demonstration contact; mailbox ownership and monitoring are unverified. The illustrative Metro Manila location and Project Privacy Coordinator role are labeled as academic details, not a verified postal address or appointed/registered DPO. Genuine employment use still requires verified controller/contact details, a record-specific retention schedule, appropriate provider arrangements, and operational privacy governance.

### Philippine-law-informed policy edition

Both document versions are now `2026-09-30.2`. Public `/terms` and `/privacy` pages use the same source as employee setup; links are available from both sign-in pages and Employee HR Help Center. Acceptance remains server-validated and versioned. Existing setup-complete employees are not silently treated as having accepted a new version.

- Ordinary personal-information bases are distinguished from the stricter requirements for sensitive or privileged information: [DPA Sections 12 and 13](https://privacy.gov.ph/data-privacy-act/).
- Acknowledgment is distinct from specific, freely given consent; optional unrelated processing is not bundled into required account setup: [NPC Circular 2023-04](https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf).
- Sources, purposes, methods, recipients, security, retention limitations, and controller-contact limitations are explained: [NPC right-to-be-informed guidance](https://privacy.gov.ph/the-right-to-be-informed/).
- Access, correction, objection, erasure/blocking, conditional portability, damages, and complaint rights are described without pretending they are absolute: [NPC data subject rights](https://privacy.gov.ph/data-subject-rights/), [DPA IRR](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/).
- The public notice links directly to [NPC complaint instructions](https://privacy.gov.ph/file-a-complaint-2/). No invented filing deadline, universal data-deletion schedule, or compliance certification is presented.
- The terms preserve mandatory Philippine employment/privacy remedies, use fictional HR records for demonstrations, and do not impose forced arbitration or a blanket waiver of rights.

## Administrator recovery

- Admin sign-in has no Forgot password link. The old `/admin/forgot-password` route redirects to `/admin/login`. Employee self-service recovery is retained.
- In **Admin Accounts & Roles**, an active System Administrator can confirm the identity of a selected active, setup-complete privileged account and select **Send reset email**. HR, payroll, security, auditor, and employee roles cannot issue this action.
- The recipient email comes from the matching Auth/profile records, never a client-supplied email address. Sending changes neither the account’s password nor its role.
- The original blue logo, HTML and plain-text versions, single-use warning, and 30-minute expiry are included in the application email template. Provider acceptance is reported as acceptance, not inbox delivery.
- A 256-bit random capability goes in the URL fragment. Only its SHA-256 digest is stored in a private RLS-enabled table. The page immediately removes the fragment; it never stores it in local/session storage. Mail-scanner GET requests do not consume the link.
- On explicit **Continue securely**, the server checks the deadline and atomically claims the capability. It then generates and consumes a Supabase recovery OTP internally and binds the request to that exact recipient Auth session. No provider recovery OTP is exposed in the email or client response.
- Completion requires the bound session, the original deadline, active account eligibility, password policy, and existing enrolled MFA. A different session—even of the same account—cannot consume the grant. Success revokes existing HRMS sessions and requires normal sign-in again.
- Limits: one request per recipient per minute, three per recipient per hour, ten per issuing administrator per hour. Successful newer deliveries replace prior grants, including already-open reset forms. Failed delivery never deletes or modifies an existing account.
- Delivery and completion have audit events. Expired request rows are pruned after seven days during normal issuance; audit events remain under the existing audit retention rules.

This removes the public Admin recovery **UI**; it does not disable Supabase Auth’s project-wide recovery API. That provider API is also used by employee self-service recovery. Do not represent UI removal as a project-wide Auth endpoint prohibition. Existing password changes requiring current credentials remain available.

## Release and verification

Apply only `20260930090000_admin_password_reset.sql` before publishing the matching frontend/functions. The migration is additive and does not alter account roles or existing records.

Tests cover private RPC permissions, recipient eligibility, expiry, replacement, replay, session binding, limits, revocation, acknowledgments, branded email, responsive light/dark UI, and a complete local browser flow with real local Supabase and enrolled TOTP. Outgoing emails are captured locally; no real administrator inbox is used for QA.

Run:

```sh
npm run typecheck
npm run lint
npm test
npx supabase test db --local
npm run test:mutations:local
npm run test:e2e:local
npm run test:visual
npm run emails:check
npx netlify build --context production
```

Do not run the local mutation suite concurrently with other local database suites: it resets the fictional QA database before and after execution.

## Verification record — September 30, 2026

- TypeScript, ESLint, and production-context Netlify build: passed.
- Unit tests: 281 passed across 36 files.
- Database tests: 93 passed; additional real local security checks: 17 passed.
- Authenticated browser tests: 16 passed; isolated mutation workflows: 8 passed.
- Visual and responsive regression tests: 183 passed, including the new forms in light/dark mode at 320px and 1440px.
- Branded Supabase email template checks: 13 passed; the new application reset email is also covered by unit, visual, and captured-email integration tests.
- Staged changes passed the Gitleaks secret scan.

The initial local checkpoint was commit `77959be` on `codex/account-setup-admin-reset`, based on fetched `origin/main` commit `10f256a`. The user subsequently authorized deployment and push, including the revised academic-policy edition above. The linked database dry run identified only the new additive migration as pending. See the release record below for the actual publication result; local email tests do not establish real-inbox delivery.

## Production release — September 30, 2026, 8:00 PM Asia/Manila

- Application source: `54014b7`, including `77959be`; the fetched main branch `10f256a` remains an ancestor. No previous pushed changes were removed.
- Netlify deployment: `6abcf916b3d7afaeca1fefc8`, published at `2026-09-30T12:00:31.664Z` to [quantumnhr.com](https://quantumnhr.com). The candidate was verified before promotion, and the published deployment ID was checked afterward.
- Applied only `20260930090000_admin_password_reset.sql` to linked Supabase project `ndzgmrmpsqqpcmoxvyfu`. The subsequent dry run reported the remote database up to date, with no pending migrations, seeds, or roles.
- Final checks: TypeScript, ESLint, 283 unit tests, 191 visual/responsive tests, 93 database tests, 16 authenticated browser tests, 8 protected mutation workflows, 17 real-local security checks, 13 generated-email template checks, and the production-context Netlify build passed.
- The mutation suite initially caught an outdated expected policy version in its assertion. The expectation was updated to `2026-09-30.2`, and all eight workflows passed on rerun.
- Live-domain verification matched the HTML and all 34 built JavaScript/CSS assets to the release build. Health confirmed the intended Supabase project. Both sign-in pages, root-to-employee redirect, and legacy Admin recovery redirect passed.
- Public [Terms](https://quantumnhr.com/terms) and [Privacy Notice](https://quantumnhr.com/privacy) passed live light/dark checks at 320px and 1440px, with no horizontal overflow, browser runtime errors, or WCAG 2 A/AA Axe violations in the checked pages. These public reads made zero database/API requests.
- Live reset guards returned the expected 405 for GET, 401 for unauthenticated send/complete, and 400 for an unknown capability through the deployed database RPC. Production configuration includes the required Supabase and email-provider settings; no secret values were logged.
- The branded reset email, 30-minute deadline, enrolled MFA, one-use grant, and session revocation were tested with real local Supabase and locally captured email. No real administrator password was changed or production reset email sent for QA; real-inbox delivery remains unverified.
- `quantumnhr@gmail.com` remains the user-supplied, unverified academic contact. No mailbox, legal entity, postal address, or DPO appointment was created or verified by this release.
