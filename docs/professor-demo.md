# Quantum HRMS professor demonstration

This walkthrough presents Quantum HRMS as a usable-security project: security decisions are understandable, appropriately scoped, recoverable, and supported by protected evidence. Use only fictional local data during the demonstration.

## Prepare the isolated demonstration

```bash
colima start
npm run demo:prepare:local
npm run local:app
```

The preparation command resets only the local Supabase stack, applies every migration, and creates fictional Auth identities for the seeded profiles. Random credentials are written to `tmp/local-demo-credentials.json` with owner-only permissions. The file is ignored by Git and must never be used on `quantumnhr.com`.

Open `http://127.0.0.1:4175`. Keep Supabase Studio available at `http://127.0.0.1:54323` if database evidence is required.

## Ten-minute connected demonstration

### 1. Role separation

1. Sign in through `/admin/login` using the local System Administrator.
2. Show People Directory, Admin Accounts & Roles, and Security Center.
3. Explain that the administrator receives organization-level operations while employees receive only self-service pages and their own protected records.
4. Point out that Supabase Row-Level Security is the data boundary; hiding a navigation item is not the security control.

### 2. Employee provisioning and first-login protection

1. Open People Directory and choose **Create employee & login**.
2. Explain the identity, employment, safety-contact, and portal-access groups.
3. Use a unique `@quantum.test` address and a generated temporary password.
4. Create the account and explain the transactional behavior: a failed credential email rolls the new profile and Auth user back.
5. Sign in through `/employee/login` with that fictional account.
6. Show the mandatory password-replacement dialog and its plain-language security guidance.

### 3. Shared HR decision

1. As the employee, submit a General HR or Attendance Correction request.
2. In the Admin portal, open Unified Approvals and record a decision reason.
3. Return to the Employee Request Center and show the synchronized status and notification.
4. Explain that the employee sees the outcome and next step, while internal administrator notes remain hidden.

### 4. Employee-centered security alert

1. As the administrator, open Security Center and create a reviewable alert for the fictional employee.
2. Use a calm title, evidence-based description, realistic impact, and a direct safe action.
3. As the employee, open Account Security and show that the alert is limited to the affected account.
4. Record **This was me** or **This was not me** and explain why the interface avoids asking for passwords or authentication codes.
5. Return to the Admin Security Center, investigate the alert, record evidence, and resolve it with a reason.

### 5. OWASP ZAP evidence

With the local application still running, use another terminal:

```bash
ZAP_STAGING_TARGET="http://host.docker.internal:4175" \
  ./security/zap/run-active-staging.sh
```

1. Explain that ZAP is an external dynamic-testing tool; it does not continuously run inside React or Supabase.
2. Import the generated JSON report through **Security Center → Vulnerability testing**.
3. Show the authorized target, environment, finding counts, SHA-256 report hash, and evidence detail.
4. Explain that the public production domain permits passive baseline assessment only. Active testing remains on the isolated local or explicitly authorized staging target.

## Usable-security points to emphasize

- **Comprehension:** alerts explain what happened, why it matters, and the safest next action.
- **Least privilege:** employee, HR, payroll, security, auditor, and System Administrator roles have different database permissions.
- **User control:** employees manage their own password, MFA, sessions, and alert responses.
- **Accountability:** sensitive transitions produce audit evidence without exposing passwords or MFA secrets.
- **Recovery:** first-login replacement, password reset, invitation setup, rollback on email failure, and session revocation provide safe recovery paths.
- **Evidence integrity:** imported ZAP reports are target-validated and SHA-256 hashed before findings enter the register.
- **Data minimization:** employee pages receive personal records; internal notes and organization-wide security evidence stay role restricted.

## Cleanup

After the presentation:

```bash
npm run local:supabase:reset
npm run local:supabase:stop
colima stop
```

Delete `tmp/local-demo-credentials.json` if the machine will be shared. The file is local and ignored, but it contains active credentials for the disposable local stack until the next reset.
