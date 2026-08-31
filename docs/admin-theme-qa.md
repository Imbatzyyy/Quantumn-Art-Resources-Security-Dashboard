# Admin light/dark and responsive QA

## Saved appearance

Admin and Employee both default to light mode, regardless of the operating-system theme. The theme toggle saves a shared, non-sensitive browser preference under `quantum-hrms-theme`. It survives refreshes and Supabase logout/login without modifying account data. It is browser-local, not synchronized between devices, and clearing site storage resets the preference. If storage is blocked, the toggle still works for the mounted session.

The admin sidebar has separate light/dark palettes for its background, logo, profile card, navigation, group labels, connection status, and footer. Desktop, collapsed, and mobile navigation follow the chosen theme. `theme-preference.spec.ts` tests default/persistent appearance, while the authenticated local tests exercise actual logout/login for both roles.

## Scope

The compatibility suite uses fictional, populated data in the local visual harness (`/visual.html?screen=admin&audit=1`). It never submits records to hosted Supabase. The opt-in fixture includes payroll runs, performance cycles/reviews/goals, benefits, and lifecycle tasks as well as the existing employee, attendance, document, and security records.

| Surface | Coverage |
| --- | --- |
| Main navigation | Action Center, People Directory, Time & Attendance, Approvals, On/Offboarding, Payroll Runs, Performance, Documents & Policy, Analytics & Reports, Communications, Security Center, Admin Accounts & Roles |
| Security sections | Overview, Alerts, Sessions, Audit trail, Vulnerability testing, Security controls |
| Employee 360 | Overview, Attendance, Pay & benefits, Growth, Documents, Account access; add benefit dialog |
| Forms | Create/edit employee, assign schedule, review HR request, start checklist, generate/advance payroll, create cycle, assign goal, save review draft, publish document/announcement, create alert, invite administrator |
| Additional states | Empty main pages/security sections, all administrator role choices, goal category choices, investigation resolution fields, session review, ZAP finding detail, search results, notification menu, theme toggle |
| Responsive matrix | Light/dark at 1440, 768, 390, and 320 pixels; an additional 844 × 390 landscape check that resizes an open form to 390 × 844 without losing its input |

Long pages and dialogs are scanned in overlapping viewport segments. Assertions check rendered text contrast, document/dialog overflow, and clipped badges/buttons. Wide data tables remain horizontally scrollable inside their containers; no columns are removed to make a page fit.

## Changes protected by these tests

- Theme-aware native controls and field placeholders, including dark dropdowns/date controls.
- Readable dark-mode filters, initials, payroll stage labels, invitation hints, search/notification content, and Employee 360 review notes.
- Content-sized performance review badges, separated from icon/initials styling.
- Wrapping Performance actions and phone-sized employee/payroll/lifecycle form footers.
- 16px mobile text-entry controls and keyboard-visible administrator role selection.
- Dynamic viewport bounds for dialogs, navigation, and the notification menu.

## Run checks

```sh
npm run typecheck
npm run lint
npm run test
npm run test:visual
npm run test:e2e:local
```

The visual tests use Chromium viewport emulation, not physical-device Safari/Firefox verification. The authenticated suite checks real local Supabase sessions using fictional identities; production account behavior is not inferred from fixture-only tests. No database, authorization, or Supabase mutation logic changed in this compatibility pass. Deployment is separate from these checks.

## Verified checkpoint — 31 August 2026

- TypeScript and ESLint: passed.
- Unit tests: 133 passed across 22 files.
- Visual suites: 79 passed (28 admin compatibility cases, 48 existing visual regressions, and 3 theme-preference checks).
- Authenticated local Supabase journeys: 4 passed, including administrator and employee refresh/logout/login theme persistence.
- Optimized Vite build: passed using isolated local test configuration, not a production deploy artifact.
- Four intentionally changed mobile screenshot baselines and the light-admin sidebar baselines were visually reviewed and refreshed. Dark-admin and employee baselines remain unchanged by the sidebar update.
- Production was not deployed as part of this pass.

## Production publication — 31 August 2026

The follow-up request to make these changes visible on the website was published to `https://quantumnhr.com` at 06:01 UTC / 14:01 Philippine time. Netlify deployment `6a9518b95c482a36ac81f2c0` completed successfully using the production build environment.

- Fresh release checks: TypeScript, ESLint, 133 unit tests, 3 theme-preference browser tests, and 4 authenticated local Supabase journeys passed.
- Both live login routes returned HTTP 200 and loaded the new entrypoint `index-fxZZYoYX.js` and stylesheet `index-CA885nLF.css`.
- All 17 published JavaScript/CSS assets matched the local release output, including the shared theme-preference module and light-admin sidebar rules.
- The public Supabase Auth settings endpoint returned HTTP 200 using the browser-safe key embedded in this release. Server health reported the intended production project.
- Both live login pages rendered without browser errors. Authenticated theme interactions were tested with fictional local Supabase accounts, not production credentials.
- No Supabase records, schema, permissions, or account credentials were changed by this publication.
