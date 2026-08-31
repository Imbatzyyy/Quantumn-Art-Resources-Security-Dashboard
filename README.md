# Quantum HRMS — React 19 + TypeScript + Supabase

This repository contains the stable React/Vite production baseline of Quantum HRMS. The former XAMPP/PHP prototype remains available only in the local historical workspace and is intentionally excluded from version control so the repository represents the active Netlify and Supabase architecture.

## What is included

- Administrator and employee login experiences
- Role-protected administrator and employee portals
- Premium employee My Day, schedule, leave, unified requests, action inbox, total rewards, growth, document vault, help center, journey, profile, and account-security modules
- Administrator Action Center, Employee 360, time exceptions, unified approvals, onboarding/offboarding, staged payroll, performance cycles, policy acknowledgements, analytics, communications, and Security Center
- Shared employee/admin workflows for leave decisions, attendance, payroll, performance reviews, announcements, security responses, and profile changes
- Account password changes and administrator-created Supabase employee login accounts
- Integrated administrator Security Center
- Employee Account Security page
- Plain-language security alerts, guided responses, active-session controls, audit activity, and accessible severity labels
- Responsive desktop and mobile layouts with light/dark themes
- Supabase Auth and PostgreSQL as the only runtime data source—no local HR record fallback or browser persistence
- Row-Level Security, specialist administrator roles, database-enforced workflow transitions, notifications, policy acknowledgements, and audit events
- Netlify build, SPA routing, security headers, a serverless health endpoint, and protected employee-account provisioning

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The application does not bundle login credentials. Create fictional Supabase Auth users that match the seeded profile email addresses, or use the protected administrator provisioning workflow.

## Verification

```bash
npx playwright install chromium
npm run typecheck
npm run lint
npm run test
npm run test:visual
npm run build
npm run check
npm run preview
```

`npm run test:visual` renders fictional, in-memory Admin and Employee states in Chromium. It compares approved desktop/mobile light and dark screenshots, checks horizontal overflow, and runs axe’s rendered WCAG color-contrast rule without contacting Supabase or another production service. When an intentional UI change is visually reviewed, update the approved images with `npm run test:visual:update` and inspect the changed PNG files before committing them.

The admin compatibility suite also walks all 12 destinations, Security Center sections, Employee 360 tabs, and create/review dialogs in both themes at 1440, 768, 390, and 320 pixels. It scrolls long surfaces to check content below the fold and covers landscape-to-portrait form resizing. Run it independently with `npx playwright test admin-compatibility.spec.ts`. See [admin theme QA coverage](docs/admin-theme-qa.md).

Authenticated role-isolation QA is deliberately separate from `npm run check` because it requires an isolated Netlify deploy/branch preview, a separate fictional Supabase test project, and the two local-only classroom passwords. See [docs/authenticated-e2e.md](docs/authenticated-e2e.md). The harness rejects production hostnames, non-`@quantum.test` identities, the production Supabase project, and any preview whose server health metadata does not match the explicitly approved isolated backend before opening a browser.

The recommended subscription-free route is the local Supabase gate:

```bash
npm run test:qa:local
```

It applies the migrations locally, runs pgTAP RLS/schema verification, creates fictional Auth users with process-only random passwords, executes real Admin/Employee Playwright journeys, and performs disposable employee, invitation, approval, security, ZAP-import, and Realtime mutation checks without touching hosted Supabase or Resend. See [docs/local-free-qa.md](docs/local-free-qa.md).

For a repeatable classroom presentation, run `npm run demo:prepare:local` and follow [docs/professor-demo.md](docs/professor-demo.md). The command creates random fictional credentials in an ignored, owner-readable local file and never modifies the hosted Supabase project.

## Repository safety

Only production source, migrations, tests, documentation, and required brand assets belong in version control. Local Netlify state, environment files, generated builds, deployment archives, Supabase CLI cache, temporary documents, legacy XAMPP code, SQL dumps, uploaded demo data, and generated OWASP ZAP reports are excluded by `.gitignore`.

Never commit real Supabase secret/service-role keys, Resend API keys, administrator credentials, employee temporary passwords, access tokens, or report evidence containing private request data. Copy `.env.example` locally and configure real values through Netlify environment variables.

The application is undergoing a progressive TypeScript migration. The application entry point, route protection, HRMS context contract, shared UI primitives, portal shell, and Vite configuration are typed. Existing feature modules remain compatible JavaScript/JSX until they are migrated and verified one workflow at a time.

The Admin and Employee experiences intentionally use different visual systems: Admin is a dense enterprise operations console; Employee is a calmer, personal self-service workspace. See [docs/frontend-redesign.md](docs/frontend-redesign.md) for the current checkpoint and safe continuation order.

## Architecture

```text
React 19 TypeScript shell + feature modules
          |
     HRMS context
          |
    dataProvider.js
          |
  supabaseProvider.js
          |
Supabase Auth + PostgreSQL + RLS + RPCs
```

All employee and administrator HR records are read from and written to Supabase. Application code does not place HR records or UI snapshots in browser storage; the Supabase Auth SDK keeps only its signed session token in `sessionStorage` so login survives a refresh but ends when the browser session closes. The non-sensitive light/dark preference is saved separately in `localStorage` under `quantum-hrms-theme` and survives refreshes and logout/login. Both portals default to light when no preference is saved, regardless of the device theme. The preference is shared between portals in the same browser, not synchronized across devices.

## Netlify readiness

Transactional email branding, all supported Supabase Auth templates, verification results, and the two-system release steps are documented in [docs/email-templates.md](docs/email-templates.md). Run `npm run emails:check` to verify generated templates. Hosted Supabase templates must be updated separately from a Netlify deployment.

The public homepage `/` redirects to `/employee/login` in both Netlify routing and React navigation. Administrator sign-in remains at `/admin/login`. An employee who is already signed in continues to their Employee workspace; visiting the homepage does not sign anyone out or change permissions.

Vite embeds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at **build time**. Production builds now fail if either is missing or if the browser key is invalid/privileged. A healthy serverless `/api/health` response alone does not verify the frontend configuration.

For the already-linked production site, use `npx netlify deploy --prod --context production` so Netlify supplies the production build environment. Do not upload a locally built `dist/` with `--no-build` unless its embedded configuration was explicitly verified for that target. Local `npm run build` and `npm run check` also require browser-safe values in an ignored `.env` file or the process environment. Mock visual tests remain configuration-independent.

After publishing, verify the deployed frontend includes the intended public Supabase URL/key and that the public Auth settings endpoint accepts that key, in addition to checking page responses and server health. Never use a secret/service-role key for browser verification.

The included `netlify.toml` provides:

- `npm run build` as the production build
- `dist` as the publish directory
- SPA fallback routing to `index.html`
- `/api/*` routing to Netlify Functions
- baseline browser security headers
- Node.js 22 for builds

The frontend is ready for Git-connected Netlify deployment and manual `dist` deployment. Use Git-connected deployment or the Netlify CLI when administrator-created employee login accounts are required, because dragging and dropping `dist` alone does not deploy the serverless provisioning function.

## Supabase setup

Run all Supabase migrations in filename order, create the initial fictional administrator and employee Auth accounts, and configure the Netlify environment variables described in [docs/supabase-setup.md](docs/supabase-setup.md).

Never expose a Supabase service-role, secret key, Resend API key, or database password in a `VITE_` environment variable because Vite embeds those values in browser code. Secret values are used only inside protected Netlify Functions.
