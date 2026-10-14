# October 14, 2026 security and HR workflow release

Baseline: `20c429a` on `main`. This release preserves the previous premium UI and all existing history. No paid plan or infrastructure upgrade was enabled.

## Security changes

- Privileged accounts require authenticator enrollment after password and email-code verification when the production policy is enabled. The mobile setup shows the QR/manual key and eight single-use recovery codes. Recovery requires password, session-bound email verification and a saved recovery code, ends other HRMS sessions, and requires a new authenticator.
- The database enforces administrator idle/absolute limits of 15 minutes/8 hours and employee limits of 30 minutes/12 hours. Background refresh cannot renew idle time. The browser immediately removes private data on sign-out, expiry or revocation, even during a network failure. Late reads/mutations cannot restore a logged-out workspace.
- Profile phone/avatar operations validate authorization inside their database functions. Administrator membership changes serialize the last-active-administrator invariant.
- Personal security history includes the user's own Supabase Auth events. The admin overview adds measured authentication trends, RLS/private-bucket counts and enforced security-policy details, with readable exact totals. It does not invent failed-password counts, a protection score or online-user certainty.
- Report exports, released own payslips and authorized document reads record preparation in the same database transaction that returns their data. This is not an unverifiable claim that a browser saved a file. Legacy/client-reported events are distinguished from database-confirmed evidence. CSV formulas are neutralized.
- A Standard Webhooks-signed email handler renders all 13 branded account templates. Unknown/expired signatures fail; event delivery uses an idempotency key; public administrator recovery emails are suppressed. Existing audited administrator reset/invitation and sign-in-code flows remain available.

## HR workflows and usability

- Leave balances are per employee/type/calendar year, split across years, reserve pending plus approved days, and are enforced under concurrent submissions. HR can edit the existing organization-wide policies; null allowance means case-by-case review. Requests still use calendar days, not invented statutory entitlements.
- Approval reasons and employee cancellation are integrated; administrator role changes, activation/deactivation and announcement correction/withdrawal use confirmation flows.
- Identical announcement text no longer links unrelated inbox copies. Notifications use a stable announcement ID; historical backfill is deliberately conservative.
- HR documents accept private PDF, DOCX, text and supported images within the existing 10 MiB limit. Metadata is validated against Storage; failed publication cleans up unattached uploads. Downloads recheck access and use short-lived links.
- Payroll supports the retained flat-rate method and itemized Philippine statutory **estimates**, with a clear review requirement. This is not certified payroll/legal compliance or a complete annualization engine.
- Targeted Realtime refresh reuses complete authorized data for the same JWT and queues changes arriving during a read. Requests have timeouts; tables paginate in the UI. First-time account setup no longer gets signed out by a premature protected heartbeat. Mobile-menu scroll restoration is synchronous with closing the sheet.

## Pre-production verification

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed |
| Unit/component tests | 330 passed, 39 files |
| pgTAP permission/schema assertions | 166 passed, 6 files |
| Local real security scenarios | 17 passed |
| Local HR workflow scenarios | 7 passed |
| New remediation scenarios | 12 passed, including concurrent leave, duplicate notices, private downloads and mandatory MFA recovery |
| Authenticated browser checks | 17 passed, including mandatory mobile MFA setup and saved-code acknowledgment |
| Protected mutation browser workflows | 8 passed |
| Full visual/responsive/accessibility suite | 191 passed in the final uninterrupted run |
| Extra mobile resize repetitions | 10 passed |
| Branded template validation | All 13 passed |
| Hosted signed email hook | Valid signed test accepted; unsigned request 401; unknown administrator recovery suppressed |
| Dependency audit | 0 known vulnerabilities reported |
| Staged secret scan | Gitleaks: no leaks found |
| Encrypted production database backup | Verified authenticated encryption and contents; key kept separately in macOS Keychain |
| Restore drill | Fictional schema/data restored and checked in an isolated disposable local database |

The full suite includes light/dark and mobile/desktop coverage. The security overview also runs in Chromium, Firefox and WebKit. Earlier transient visual failures were investigated; the final frozen-source run passed all 191 without relaxing assertions.

The preview passive ZAP baseline examined 49 URLs: 0 High, 0 Medium, 2 Low and 6 Informational rule entries. Cross-origin isolation warnings are retained for popup/private-image compatibility; no security certification or authenticated production penetration-test claim is made.

## Safe rollout

1. Preserve an encrypted pre-deployment backup and verify it. Do not reset production.
2. Apply only migrations `20261014010000` through `20261014060000`. The MFA-required policy initially remains disabled for compatibility with the old frontend.
3. Deploy the tested production-context bundle and matching Netlify functions.
4. Verify the live hook, then enable the Supabase Send Email Hook and seven account-security notification categories using a targeted configuration patch. Preserve existing SMTP/template configuration.
5. Enable `set_privileged_mfa_required(true)` and verify the database flag and function permissions. Existing users may need to sign in again; administrator roles must complete authenticator setup and save their codes.
6. Check live routing, Supabase configuration, anonymous denial, mobile layouts and deployed assets. Push without force; record deployment/commit evidence below.

Netlify Free does not permit the granular-scope secret configuration used on paid accounts. The signing secret is a standard server environment variable, never a `VITE_` value, never committed and never included in the browser bundle. It is configured for production and deploy-preview; provider team access should remain restricted.

## Explicit remaining boundaries

- Shared initial/fallback snapshots remain. Full page-scoped server pagination, independent page failure isolation, query-plan tuning and organizational retention rules are further scaling work. Existing snapshots do not silently display truncated totals.
- The encrypted backup does not include Storage object bytes, provider secrets/settings or point-in-time recovery. Offsite retention and recurring full restore drills need an organization-owned destination; see [backup-and-restore.md](backup-and-restore.md).
- Automated tests use fictional local identities. Hosted email acceptance was tested with Resend's official test mailbox, not a real employee inbox. Inbox placement, every personal device and every production account are not certified.
- Philippine payroll/privacy policy settings require organizational/legal review before use for real employment administration. Free-tier availability and provider rate limits remain; no paid leaked-password protection was silently enabled.
- Not every create operation has durable offline-retry idempotency. The current UI prevents duplicate in-flight submissions and the tested critical transitions are database-serialized; this is not an offline queue.

## Production record

- Application commit: `3f19aec086a814e83d01c4b84781803086f4c83f`, pushed as a fast-forward from `20c429a` to `origin/main`. No prior commits were removed.
- Production Netlify deployment: `6acee774a5acd078c2b3f4c8`, serving **https://quantumnhr.com**. Immutable URL: https://6acee774a5acd078c2b3f4c8--quantumnartresources.netlify.app. This was a direct tested production-context deploy; GitHub continuous deployment was not configured by this release.
- All six migrations applied successfully. A subsequent linked dry run reported no pending migrations. Catalog checks found 25/25 public tables with RLS and zero public Storage buckets. Avatar access-gate and administrator-membership lock definitions were verified. Anonymous execution of new export/recovery functions and authenticated editing of the MFA policy are denied.
- The live signed hook accepted the branded message for Resend's official delivery-test address. Supabase readback confirmed the production hook URL and all seven notification categories enabled; unrelated Auth/SMTP/template settings matched the pre-change values. Mandatory privileged MFA was enabled and read back as true only after publishing the matching UI/functions.
- Anonymous requests to the protected function routes were denied, including the actual `send` action on the administrator reset endpoint. Anonymous REST reads of profiles, payroll, documents, audit logs and sessions, plus the access-assertion RPC, returned 401.
- Both login pages passed Chromium checks at 320, 390 and 1440 pixels without horizontal overflow, uncaught page errors or a missing-Supabase configuration message. Entry/recovery/setup/policy routes responded successfully; `/` redirects to `/employee/login`.
- All 34 deployed JavaScript/CSS assets matched the local production build byte for byte. The stable `/email-assets/quantumn-art-resources-blue.png` endpoint serves the original blue logo bytes. Build HTML SHA-256: `0583970e54c0b782311bc1314bff3ce1b740705f59696393fd85fbc039f93eb0`.
- Live passive ZAP scan, generated `2026-10-14 02:27:26 UTC`: 49 URLs; **0 High, 0 Medium, 2 Low, 6 Informational** JSON rule entries. Runner summary: 61 PASS, 6 WARN, 0 FAIL (exit 2 because warnings exist). The two Low rules concern COEP/COOP; the popup/private-image compatibility boundary remains explicit. This was not an authenticated production scan.
- Production database backup verified from `2026-10-14T01:51:01.114Z`, encrypted and Git-ignored. No production rows were deleted for this release. Full disaster-recovery limitations remain as documented above.
- GitHub workflow https://github.com/Imbatzyyy/Quantumn-Art-Resources-Security-Dashboard/actions/runs/38501100808 is checking the exact application commit. Final remote outcome is recorded separately after it completes.
