# October 2026 security and workflow remediation

Authorized scope: implement the October 14 read-only audit recommendations, preserve main, validate before production deployment and GitHub push. No paid-plan changes.

Release gates (do not treat unchecked items as complete):

- [x] Database access gates for audited paths; profile input validation; negative authorization tests.
- [x] Server-enforced session lifetime and idle expiry; immediate UI lock; stale mutation results discarded after logout.
- [x] Privileged MFA enrollment and recovery implementation; employee personal security history and session controls. Production activation remains a separate release gate.
- [x] Role-safe account recovery; 13 branded templates; signed hosted email-hook transport accepted by Resend's test recipient. Actual end-user inbox placement is not certified.
- [x] Authoritative export/event audit paths, measured security overview and honest freshness.
- [x] Leave policies/balances, approval notes, cancellation and server allowance enforcement, including concurrency and cross-year requests.
- [x] Retained HR workflow integration (admin management, document files, announcements, payroll estimates).
- [x] Targeted Realtime refresh, complete-table cache per JWT, queued refresh events, UI table pagination and request timeouts.
- [ ] Full page-scoped server queries, independent page failure isolation and retention policies. Initial and fallback reads still use complete shared snapshots; no partial totals are substituted.
- [x] Concurrency and negative-access regressions; dependency updates; CI workflow added.
- [x] Staged source secret scan (Gitleaks) and whitespace checks.
- [ ] First remote CI run after GitHub push.
- [x] Encrypted pre-release database backup; authenticated encryption verification; fictional-data restore into an isolated local database.
- [ ] Organization-owned offsite destination, Storage object backups and recurring retention/restore schedule. See backup-and-restore.md; no full disaster-recovery claim.
- [x] Unit, database, authenticated workflow, responsive and accessibility validation. See security-remediation-release.md for counts and boundaries.
- [x] Preview verification, six safe migrations, production release, hosted checks and fast-forward push to main. Application commit: 3f19aec; deployment: 6acee774a5acd078c2b3f4c8.

Any provider limitation, missing recovery authority, real-inbox/device verification gap, or remaining implementation must be disclosed; never silently certify it.
