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
npm run typecheck
npm run lint
npm run build
npm run check
npm run preview
```

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

All employee and administrator HR records are read from and written to Supabase. Application code does not place HR records or UI snapshots in browser storage; the Supabase Auth SDK keeps only its signed session token in `sessionStorage` so login survives a refresh but ends when the browser session closes. The light/dark preference lasts only for the current page session.

## Netlify readiness

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
