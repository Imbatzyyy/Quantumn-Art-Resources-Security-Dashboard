# Email verification at sign-in

Implemented for the Admin and Employee portals on 28 September 2026.

## Expected experience

1. An existing, active, setup-complete user enters the correct email and password.
2. The portal opens `/admin/verify-email` or `/employee/verify-email` and sends a six-digit email code.
3. The code opens only that sign-in session. Enrolled authenticator MFA remains an additional requirement.
4. First-time employee password setup and administrator invitations keep their existing setup flows. The server grants a session-specific setup handoff only after validating the temporary password and completing employee setup. Subsequent password sign-ins require email verification.

Refreshing the verification page reuses an unexpired challenge instead of sending duplicate emails. Cancelling an unfinished sign-in signs out only that browser session. Existing open sessions at migration time are grandfathered to avoid unexpectedly interrupting current work; all newly created password sign-ins are challenged.

## Enforcement and delivery

- `private.hrms_access_allowed()` now checks a verified email record tied to the Auth session, user and current Auth email. Existing RLS, Storage policies and protected RPC/API authorization inherit the check. A dashboard redirect alone cannot bypass it.
- The client cannot execute `manage_signin_email` or read the private verification tables. The server obtains the recipient, account setup status, portal and session ID from the authenticated bootstrap RPC, not from browser-supplied user/email values.
- Codes are cryptographically generated, six digits including possible leading zeroes, HMAC-SHA256 hashed with a server-only key, and never returned to the browser, logged, or retained in plaintext in the database.
- Codes expire after 10 minutes. Resends replace the previous challenge for that session. Limits: 60 seconds between sends per account, 10 sends/hour/account, 5 attempts/challenge, 20 verification attempts/hour/account. Failed attempts commit rather than roll back.
- The server activates a challenge only after Resend returns a successful receipt. Provider failure, timeout, or missing receipt fails closed. Email acceptance is not proof of receipt in a particular user's inbox.
- Both portal emails use the shared responsive HTML layout, original blue logo, escaped names, expiration instructions and a plain-text alternative. This is a dedicated sign-in template; it does not replace Supabase's invitation, recovery or notification templates.
- This email check is separate from Supabase AAL2. It does not impersonate a native authenticator factor or remove existing TOTP requirements.

## Required production configuration

The existing Netlify functions use `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. Initial employee setup also needs the existing publishable key. Never expose the service/provider keys as Vite variables. No new paid Supabase feature is required; email sends remain subject to the existing provider's plan limits.

Deploy the application/function bundle together with migration `20260928083351_email_signin_verification.sql`. Build and test a production-context candidate first, apply the migration, then publish that candidate. Old app bundles cannot complete new sign-ins once the database gate is enabled; restoring only an old frontend is not a complete rollback. Any emergency rollback must coordinate the application with a reviewed compensating database migration while retaining the prior active-account, session-revocation, setup and TOTP guards.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run emails:check`.
- `npx supabase test db --local`: RLS/RPC denial before verification, expiry, send/guess limits, refresh deduplication, stale callback rejection, challenge replacement, session isolation, correct-code access, email changes and incomplete setup.
- `npm run test:e2e:local`: actual local Supabase password sign-in and the real email handler, with provider transport captured locally. Both portals cover wrong code, direct-route denial, refresh, correct code, desktop/mobile, theme and accessibility.
- `npm run test:mutations:local`: employee setup, invitations and established HR workflows.
- `node scripts/verify-security-audit-local.mjs`: existing session/revocation/TOTP/recovery and authorization regression scenarios.
- `npm run test:visual`: responsive portal and email template checks.

Local-only fixture helpers refuse remote targets and reset only the isolated fictional database's rate-limit fixtures. They are not shipped as production API endpoints. Real endpoint rate limits are tested separately in pgTAP.

Release email smoke tests use Resend's documented `delivered@resend.dev` test sink with fictional, unusable code values. Production employee/admin credentials and inboxes are not used for automated tests. Confirm receipt and rendering in the user's real mail client during their next sign-in.
