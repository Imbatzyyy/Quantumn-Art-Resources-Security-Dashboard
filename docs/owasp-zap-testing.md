# Quantum HRMS OWASP ZAP Testing Standard

## Authorized scope

- Production passive baseline: `https://quantumnhr.com`
- Active scanning: isolated Netlify deploy preview with fictional test data
- Out of scope: Supabase, Netlify, Cloudflare, Resend, and third-party dashboards

## Safety rules

1. Never run a ZAP active scan against the production HRMS.
2. Never scan real employee records or credentials.
3. Use accounts created specifically for authorized testing.
4. Do not commit reports that contain sensitive URLs, headers, or evidence.
5. Manually validate every medium/high finding.
6. Test RBAC and Supabase RLS separately; scanners cannot prove business-logic authorization.

## Passive production baseline

```bash
./security/zap/run-baseline.sh https://quantumnhr.com
```

Import the generated JSON from **Admin > Security Center > Vulnerability testing**. The protected Netlify function scope-checks and hashes the report, stores findings in Supabase, and writes an audit event.

## Active staging scan

Create a deploy preview connected to a separate Supabase test project with fictional records. The command supports either Docker or a local ZAP installation through `ZAP_HOME`:

```bash
ZAP_STAGING_TARGET="https://DEPLOY-ID--quantumnartresources.netlify.app" \
  ./security/zap/run-active-staging.sh
```

The script refuses the production domain.

Do not use the unique URL of a production deploy as the staging target when it still connects to the production Supabase project. The preview must use separate test environment variables and fictional accounts.

## Latest verified production baseline

- Completed: 29 August 2026
- Scan reference: `ZAP-MTE6GSIV-36ADE5`
- Crawled URLs: 28
- Result: Passed
- High / Medium / Low: 0 / 0 / 0
- Informational observations: 4
- Evidence: JSON and HTML reports generated locally; the JSON report was scope checked, SHA-256 hashed, imported into Supabase, and recorded in the administrator audit trail.

## Defense evidence

- Authorized scope statement
- Scan configuration and command
- Before-remediation report
- Manually validated findings
- Remediation record
- After-remediation report
- Security Center summary and SHA-256 hash
- Separate employee/admin authorization tests
