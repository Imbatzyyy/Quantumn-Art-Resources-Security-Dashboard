# Automatic HRMS database activity safeguard

## What runs

Netlify runs `netlify/functions/database-health.mjs` every six hours from the **published production deployment**. It does not depend on a user signing in, an open browser, the developer's computer, GitHub Actions activity, or a Codex session.

- Schedule: `17 */6 * * *` UTC — **2:17 AM, 8:17 AM, 2:17 PM, and 8:17 PM Asia/Manila**, daily.
- One authenticated server-side `HEAD` request to the existing `profiles` table, selecting only the indexed `employee_code` with `limit=1`.
- A real PostgREST database read, without an employee response body, exact row count, write, email, Auth session, or Realtime connection. An empty table is valid.
- Approximately 120 normal database requests per 30 days. HTTP/TLS headers and function execution still have small usage costs; this is low-egress, not zero-usage.
- Eight-second request timeout; only one retry after a network/5xx failure. Permission, configuration, redirect, and rate-limit errors are not retried. Failures throw a sanitized error and appear in Netlify function logs, not as false success.
- Reuses the existing Functions-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No credentials are included in frontend code or logs. Requests are pinned to the HRMS project origin and cannot follow redirects with credentials.

The static website itself does not need browser visits to run this job. The existing `/api/health` endpoint reports configuration metadata only; this separate scheduled function actually reaches the database. Netlify blocks direct public URL invocation of scheduled functions.

## Free-plan limitations

This is a **best-effort activity safeguard**, not a no-pause or uptime guarantee. Supabase may pause Free projects that exhibit low activity over seven days; its documentation does not promise that this particular request schedule prevents every pause. Pro is the supported option that guarantees no inactivity pausing. This release does not change subscriptions or billing.

A database request cannot restore an already-paused project. This job does not hold an account-wide Supabase Management API token or issue project restore operations. If a project is paused, restore it in the Supabase dashboard first, then inspect the next check. Provider outages, quota restrictions, revoked credentials, and pausing the Netlify site can also prevent checks from succeeding.

## Verify, troubleshoot, or disable

1. Open the `quantumnartresources` project in Netlify → Functions → `database-health`.
2. Confirm the **Scheduled** badge and next execution time.
3. Use **Run now**, then inspect the corresponding invocation log. Success reads `Database health check succeeded (read-only, no response body, attempt 1).` A public HTTP 403 is expected and does **not** prove that the job executed.
4. For failures, check the Supabase project status and server environment settings. Do not paste credentials into logs or change RLS to make a health check pass.
5. To disable it, remove the scheduled function and redeploy. Reverting to a deployment without this function also removes its schedule. No employee records require cleanup.

Automated tests cover scheduling, bounded reads, timeouts, sanitized errors, retries, missing credentials, unsafe/wrong-project URLs, and platform runtime configuration. Production verification must include a real Netlify invocation, not only mocks or a locally called function.

## Official references

- [Supabase production availability policy](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/) — available on all plans, UTC scheduling, published-deploy behavior, and Run now verification.

## Release evidence

Pending production verification.
