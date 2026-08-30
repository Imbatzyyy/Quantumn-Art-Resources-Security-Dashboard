# Authenticated end-to-end QA

This harness verifies real Supabase Auth, profile loading, role routing, protected portal navigation, and sign-out with the two fictional classroom identities. It intentionally does not create employees, submit requests, change attendance, alter security alerts, or mutate another HR record.

## Required isolation

Run it only against either:

- localhost backed by an isolated Supabase test project and working Netlify Functions; or
- a Netlify deploy/branch preview backed by a separate Supabase test project containing fictional records.

The safety gate rejects ordinary production hostnames, including `quantumnhr.com` and a primary `*.netlify.app` site. Remote targets must use HTTPS and have the Netlify deploy-preview or branch-preview hostname shape. Both identities must end in `@quantum.test`, the data classification must be exactly `fictional-classroom-only`, and each password must be at least 12 characters.

Before opening a browser, the harness also calls `/api/health` and requires the remote deployment to identify itself as a Netlify deploy/branch preview with `qa-preview` environment metadata. Its server-side Supabase URL must resolve to the exact isolated project reference named in `E2E_EXPECTED_SUPABASE_PROJECT_REF`. The known production Quantum HRMS project reference is rejected even if every other setting appears valid.

Do not point a deploy preview at the production Supabase project. Authentication creates and then closes a tracked security session, so even this read-oriented test belongs only in an isolated test environment.

## Configure without committing credentials

```bash
cp .env.e2e.example .env.e2e
```

Fill the ignored `.env.e2e` file with the isolated preview URL and the two classroom-only passwords. Never use personal credentials or a production administrator account.

Configure the preview deployment itself with `QUANTUM_ENVIRONMENT=qa-preview`, the isolated project values for both the browser-safe and server-only Supabase variables, and an `APP_URL` matching the preview origin. Do not copy production Supabase values into a preview.

## Run

```bash
npm run test:e2e
```

For the recommended subscription-free local environment, start Colima once and run the complete database plus authenticated gate:

```bash
npm run test:qa:local
```

The local runner generates both passwords in memory, verifies the Auth-to-profile links, supplies the credentials directly to Playwright, and destroys the temporary web process afterward. No `.env.e2e` file is required. See [local-free-qa.md](local-free-qa.md).

The command fails closed before opening a browser when configuration is missing or the target, identities, classification, or password length violates the isolation policy. Failure traces, screenshots, and videos are written only to ignored local test-result folders.

## What is verified

- Admin authentication reaches the real Action Center.
- Admin navigation exposes People Directory and Security Center.
- The Admin identity is redirected away from the Employee workspace.
- Employee authentication reaches the real My Day workspace.
- Employee navigation does not expose administrator account controls.
- My Profile shows the same fictional work email used for authentication.
- The Employee identity is redirected away from the Admin workspace.
- Both sessions can sign out cleanly.
- No HTTP 5xx response or browser console error occurs during either journey.
- The health preflight proves the preview context and explicitly approved isolated Supabase project match before authentication begins.

MFA is intentionally not automated with a stored TOTP secret. If the isolated account requires MFA, the harness stops and reports that an account-owner-approved test factor is required.
