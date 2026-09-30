# Employee setup and administrator recovery

This change builds on `10f256a` (readable portal UI) and preserves the earlier session-bound email sign-in, MFA, mobile navigation, and Supabase access controls.

## Employee first-use acknowledgment

- Only employees marked `must_change_password: true` see the required two-step setup.
- Step one displays the Terms and Conditions and Privacy Notice before any password fields. Separate, initially unchecked controls record agreement and acknowledgment. The user may review them again or sign out.
- `src/utils/accountPolicies.js` is the shared source for the text and version identifiers. Bump the relevant version whenever its text changes.
- `/api/complete-initial-password` rejects missing, false, or outdated acknowledgment values. It verifies the temporary password and saves the server timestamp, document versions, and flags in protected Supabase Auth `app_metadata.setup_acknowledgment` in the same Auth update as the new password. Browser-editable `user_metadata` is not used.
- The audit event also identifies the accepted versions. Existing setup-complete employees are not forced through onboarding again.

The included copy describes the implemented portal, not a legal compliance certification or blanket consent. The organization should review it before publication and supply its approved privacy contact, lawful-basis information, retention policy, and any jurisdiction-specific language. No unverified contact address or retention deadline has been invented.

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

At this checkpoint the work is local on `codex/account-setup-admin-reset`, based on the fetched `origin/main` commit `10f256a`. No production migration, deployment, GitHub push, or live-inbox delivery test has been performed. The linked database dry run identified only the new additive migration above as pending. Release still requires approval and organizational review of the policy copy.
