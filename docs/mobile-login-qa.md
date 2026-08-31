# Mobile sign-in refinement

## Scope

The Admin and Employee sign-in screens use a compact brand header and one form on mobile. Desktop promotional content remains in the desktop layout but is hidden on mobile instead of being stacked below the form. Admin retains navy framing; Employee uses a light blue-gray canvas. Inputs are 16px, password visibility targets are 44px, and the primary action is at least 52px high.

Production changes are CSS-only and scoped to login screens at widths up to 900px, plus short coarse-pointer landscape screens up to 1100px. Desktop login JSX, authentication, MFA, recovery links, Supabase configuration, and account permissions are unchanged. The document can still scroll when errors, larger text, or a short viewport need more room; no content is cropped with a fixed-height overflow lock.

## Verification — 31 August 2026

- 20 focused mobile browser tests passed: both roles at 320 × 568, 360 × 640, 375 × 667, 390 × 844, 430 × 932, 768 × 1024, and 844 × 390; reduced-height form/error checks; authenticator/cancellation checks; and 932 × 430 coarse-pointer phone landscape.
- Both desktop sign-in screenshot baselines passed unchanged (one existing test).
- Four new phone snapshots at 320px and 390px were visually reviewed. The default forms fit entirely in the tested portrait viewports without horizontal or vertical overflow.
- Tests cover text contrast, field labels, accessible button/link names, password reveal/hide, recovery link destination, error visibility, and preserved input during viewport resizing.
- TypeScript, ESLint, all 133 unit tests, and all 4 authenticated local Supabase journeys passed.
- Local fictional login-state fixtures are only in the visual test entrypoint; they do not ship in the production build or submit to hosted Auth.

These checks use Chromium viewport/touch emulation and an in-app browser. The reduced-height test models available screen space; it is not physical iOS/Android keyboard verification. Real account sign-in is not automated on production.

## Published verification

Published to `https://quantumnhr.com` with production deployment `6a95608b6f29746a3fb4a1d1` using the existing Netlify production environment. All 17 JavaScript/CSS assets matched the local release output; both login routes loaded the new `index-Bq4Wmo1h.js` entrypoint. Supabase public Auth settings returned HTTP 200 and server health reported the intended production project.

Live browser inspection confirmed the Employee page at 390 × 844 and Admin page at 320 × 568 had no document overflow, with the promotional section hidden and the submit button fully in view. No account credentials or production HR records were changed.

## Repeat the focused checks

```sh
npx playwright test mobile-login.spec.ts portal.visual.spec.ts --grep 'compact mobile login|errors remain readable|mobile authenticator|landscape phone|sign-in pages remain'
npm run typecheck
npm run lint
npm run test
npm run test:e2e:local
```
