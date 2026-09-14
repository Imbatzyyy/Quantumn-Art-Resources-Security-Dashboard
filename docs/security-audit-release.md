# Security overview and audit hardening release

Release date: 15 September 2026 (Asia/Manila). Baseline: `bc4c597`.

## What changed

The Admin Action Center now includes a role-restricted **Security at a glance** section backed by PostgreSQL aggregates, not client-side sample totals. It provides 7/30/90-day Philippine-time alert trends, exact accessible daily counts, open severity drill-downs, resolution counts, account and privileged MFA coverage, recent session observations, prioritized open alerts, and dated vulnerability evidence. Loading, unavailable, stale, empty, light/dark, and mobile states are explicit.

The statistics deliberately distinguish alerts from confirmed attacks, recently observed sessions from online users, and passive scan evidence from authenticated security verification. No invented protection percentage is shown.

## Original finding disposition

| Finding | Implemented protection / remaining boundary |
| --- | --- |
| F01: MFA and setup bypass | REST, RPC, Storage and protected server endpoints check the real Auth session, current profile status and current setup flags. Enrolled MFA requires AAL2. Setup bootstrap returns only minimal own identity. Enrollment is not made mandatory for existing accounts during this rollout. |
| F02: cosmetic session revocation | Auth-session IDs are derived from the caller JWT. A database denylist blocks revoked HRMS access, including refreshed tokens. Historical unlinked observations are explicitly not revocable sessions. This is HRMS access revocation, not a claim that an administrator deleted the provider's Auth session. |
| F03: inactivity timer reset | Timers depend on stable identity/portal values rather than every refreshed identity object. Admin: 15 minutes; Employee: 30 minutes. Private UI state clears even if the sign-out request fails. |
| F04: inactive RPC access | Shared current-user/role guards and restrictive RLS policies reject inactive and revoked accounts behind the UI. |
| F05: client-owned session labels | Ownership, session ID and assurance level are server-derived; device/time-zone text is labeled browser-reported. Heartbeats are throttled and cannot create arbitrary ownership records. |
| F06: misleading imported evidence | Official-shaped JSON, timestamp, authorized sites/instance URLs, size and finding count are validated. Counts come from findings; duplicate hashes reuse the evidence record. Only baseline evidence is accepted. Atomic RPC stores the scan, findings and audit record together. JSON validation does not authenticate a report author's identity. |
| F07: inconsistent metrics | Shared open-status logic, severity ordering and database aggregates; false positives are excluded from open backlog. MFA failures and data refresh failures no longer imply a healthy system. |
| F08: date/clock exceptions | Philippine business dates, explicit clock-in/out intent, serialized writes, rest-day guard, late-shift comparison and overnight clock-out handling up to 24 hours. Longer unresolved attendance requires HR correction. |
| F09: full snapshots / refresh loops | Reduced self-triggering session/audit refresh, heartbeat throttling, paginated reads with stable ordering and an explicit size limit, on-demand document bodies and short-lived cached avatar URLs. **Partially addressed:** the portal still uses a shared full snapshot. Page-scoped queries and retention are the next scaling work, not claimed complete. |
| F10: specialist-role mismatch | Security administrators receive a minimal account picker; auditors can inspect security aggregates but cannot mutate alerts. HR cannot modify privileged employment records. Report actions are role-filtered. Personal Account Security is available to administrators. |
| F11: repeated writes | Pending submissions are coalesced and key forms have synchronous submission locks. HR requests use durable idempotency keys. Leave, clock, payroll and lifecycle transitions are serialized in PostgreSQL. **Boundary:** not every create operation has durable network-retry idempotency. |
| F12: alert/audit divergence | Alert changes and response/audit records share a database transaction; closure requires a reason. Employee responses cannot silently reopen closed cases. |
| F13: lifecycle reopen | Reopening a completed task reopens its completed parent case; it does not automatically reactivate an offboarded account. |
| F14: recovery/password mismatch | Admin and Employee recovery routes, shared 15-character passphrase validation, MFA verification during recovery, isolated current-password verification that preserves the primary AAL2 session, and provider-enforced current-password checks for ordinary changes. |
| F15: mobile heading | Both mobile login pages retain an accessible top-level heading and fit the 320px layout. |
| F16: misleading reports | Workforce counts exclude privileged accounts; request exports include HR requests and leave; availability and report names reflect their actual contents. |

Additional fixes: sensitive documents require a named recipient; expired employee documents cannot be downloaded or acknowledged; downloads read current authorized content. Payroll regeneration reconciles ineligible draft recipients and cannot modify released/paid/locked runs. Published performance reviews cannot be overwritten by a new draft; use a new period/revision label. Missing foreign-key indexes were added without deleting unrelated indexes. A dashboard-installed maintenance function no longer needs anonymous/authenticated execution grants. The private revocation table has RLS and no client table grants.

## Verification evidence

The local QA database contains fictional accounts only. Generated passwords, recovery links and authenticator secrets stay in process memory; captured provisioning emails are local, not delivered to real employees.

- TypeScript and ESLint checks passed.
- 226 unit/component tests passed across 28 files.
- 23 pgTAP database permission/schema assertions passed.
- 17 real local security scenarios passed via `node scripts/verify-security-audit-local.mjs`: session identity/revocation, inactive/setup accounts, MFA and recovery, specialist roles, clock/leave/request concurrency, payroll locking, lifecycle reopening, immutable published reviews, document expiry and closed-alert responses.
- 4 authenticated browser scenarios passed for both portals, including appearance persistence and role boundaries.
- 7 protected browser mutation scenarios passed: employee provisioning/first-password setup, administrator invitation, realtime HR request/decision, profile edit, WebP and PNG cropping/private storage, alert lifecycle and local baseline import.
- The full visual/accessibility/responsive suite contains 167 scenarios, including 12 security-overview cases across Chromium, Firefox and WebKit. The final broad run passed 166; one Employee 360 screenshot was interrupted by a generated report triggering Vite's HTML watcher. That case passed on rerun and three further repetitions without snapshot changes. Generated reports are now excluded from the watcher.
- 13 branded email templates passed generation validation. This is not a new end-to-end production inbox-delivery claim.
- Production dependency audit reported no known vulnerabilities; Gitleaks found no secrets in the publishable text-source inventory.
- Candidate login and recovery navigation were checked at 320, 390, 768 and 1440px for both portals without horizontal overflow or uncaught page errors.

## Deployment and operational notes

- Apply `20260914113100_security_overview_audit.sql` and publish its matching frontend/server bundle together. Some old RPC signatures are deliberately revoked: already-open browser tabs should be refreshed after release.
- The Netlify build must use the production context and validate browser Supabase configuration. Never publish a bundle with missing configuration or a service-role key in a `VITE_` variable.
- Auth configuration is updated with a targeted patch only: disable public signup, require at least 15 characters for newly set passwords, require the current password for ordinary password changes, and allow the exact Admin/Employee recovery/setup URLs. Preserve email provider settings and all branded templates.
- A schema-only pre-release dump is kept under ignored `test-results/`. It is not a data backup or a tested full disaster-recovery plan. No production HR records are deleted to install this migration.
- Existing privileged accounts must enroll an authenticator through **My Account Security**. The live pre-release check found **0 of 5** active privileged accounts enrolled. This release exposes that gap rather than silently enabling a factor or locking users out.
- Private photo signed URLs expire after five minutes; previously issued URLs may work until expiry. Revocation cannot recall downloaded files.
- Supabase Free is retained. No paid branch, plan upgrade, new authentication provider, or paid leaked-password feature was enabled.
- The authenticated local tests are not evidence of every real production account/device or production email inbox working. Passive ZAP results do not prove authenticated access control.

## Follow-up work not represented as fixed

1. Enroll administrators in MFA, verify recovery ownership, and agree on a mandatory-enrollment policy before enforcing it organization-wide.
2. Replace shared snapshots with page-scoped, server-paginated queries as records grow; define audit/session retention and measure actual query plans. Existing permissive-policy and intentionally callable definer-function advisories require interpretation, not indiscriminate removal.
3. Establish encrypted data exports and a tested restore procedure appropriate to the Free plan. This release does not establish a backup schedule or automatic retention cleanup.
4. Confirm leave balance, weekend/holiday and retroactive-request policies with HR. Current requests count calendar days and require current/future dates; no new entitlement rules were invented.
5. Add durable retry keys to the remaining create operations if offline/retry delivery is introduced, and design a formal revision workflow if published reviews must be amended in place.

## Final release record

- Migration `20260914113100_security_overview_audit.sql` applied successfully to the linked production project. Catalog checks verified all 24 public tables have the new session guard, anonymous overview execution is denied, legacy clock execution and direct session creation are revoked, and the denylist has RLS. The maintenance-function anonymous/authenticated advisory is cleared.
- Auth readback verified public signup disabled, minimum password length 15, current-password requirement enabled and all three exact recovery/setup redirects present. All 50 inspected mail/template/provider configuration fields remained unchanged.
- Production browser checks passed for both portals at 320px and 1440px, including Forgot password navigation. Public entry/recovery/setup routes, correct Supabase project configuration, denial on all six unauthenticated protected endpoints and byte-for-byte matching JS/CSS/Admin bundle/logo assets were verified.
- The production passive ZAP scan completed at **2026-09-14 16:51:05 UTC** across 26 URLs. The JSON contains **0 High, 0 Medium, 2 Low and 6 Informational findings**. The runner groups these into six warning rules and exits 2; this is not a clean all-pass scan. Low findings concern cross-origin isolation: COOP intentionally permits popups and COEP is not forced because signed cross-origin profile images must remain compatible. Informational findings concern static caching, redirects, SPA detection and a minified routing-string false positive, not an exposed password. No authenticated production scan was performed.
- Real scan output revealed a final importer compatibility gap: the known Supabase project can appear before the website in ZAP's site list. The importer now matches the selected scanned target, accepts only the exact related backend in addition to the approved web origins, still rejects unrelated Supabase projects, and requires an explicit generator time zone for unzoned timestamps. Low findings are marked Review Needed instead of Passed.
- Production advisors still list intentionally callable authenticated definer functions and the Free-plan leaked-password warning. Performance advisors report five multiple-permissive-policy warnings and unused indexes; there are no remaining unindexed-FK notices. These are retained for measured policy/query optimization, not described as zero advisories.
- Final Netlify deployment and Git revision are identified in the accompanying release response. The last importer adjustment passed all 15 focused light/dark/responsive/cross-browser checks and all seven protected-mutation tests before publication.
