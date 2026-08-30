# Connect Quantum HRMS to Supabase and Netlify

The application includes a Supabase provider and a security-first PostgreSQL migration. All seed records are fictional.

## 1. Apply the database migration

In the Supabase dashboard, open **SQL Editor** and run all migrations in filename order:

- `supabase/migrations/20260825090000_quantum_hrms.sql`
- `supabase/migrations/20260825110000_complete_workflows.sql`
- `supabase/migrations/20260825150000_premium_hrms.sql`
- `supabase/migrations/20260829114500_people_directory_realtime.sql`
- `supabase/migrations/20260829180000_unified_security_center.sql`

They create the HRMS tables, fictional data, unified requests, schedules, benefits, goals, lifecycle cases, payroll runs, performance cycles, documents, notifications, workflow RPCs, audit triggers, grants, and Row-Level Security policies.

## 2. Create the two fictional Auth accounts

In **Authentication → Users**, create these users and mark their email addresses as confirmed:

- Administrator: `admin@quantum.test`
- Employee: `employee@quantum.test`

Use a unique, strong classroom-only password for each account. Supabase mode intentionally does not display or autofill either password on the public login page. Do not reuse a personal password.

The database trigger links each Auth user to the fictional employee profile with the same email address. Do not create Auth users for real people in a public classroom demonstration.

## 3. Add Netlify environment variables

In Netlify, open **Project configuration → Environment variables** and add:

```text
VITE_SUPABASE_URL=https://ndzgmrmpsqqpcmoxvyfu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your Supabase publishable key
SUPABASE_URL=https://ndzgmrmpsqqpcmoxvyfu.supabase.co
SUPABASE_SECRET_KEY=your server-only Supabase secret key
```

Use the Supabase **publishable** key for `VITE_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` is read only by the Netlify Function that lets an authenticated administrator create an employee profile and its matching Auth login together. Never use a secret key or service-role key in a `VITE_` variable, commit it to the repository, place it in `dist`, or send it to the browser.

Trigger a fresh Netlify production deployment after saving the variables. Vite places the selected public configuration into the JavaScript bundle at build time, so an already-built deployment will not receive new variables until it is rebuilt.

## 4. Authentication settings

For this controlled demonstration:

- Disable public user sign-ups after creating the two fictional accounts.
- Add the final Netlify HTTPS origin under Supabase Auth URL configuration.
- Use the Netlify URL as the Site URL.
- Add localhost only as a development redirect URL if needed.
- Enable MFA for administrator accounts when the course demonstration reaches that phase.

## 5. Verification checklist

- Administrator login opens the administrator portal.
- Employee login opens the employee portal.
- An employee sees only their own profile, attendance, leave, payroll, performance, sessions, and alerts.
- An employee cannot use the administrator portal.
- An administrator can view organization records and update security-alert status.
- An administrator-created employee receives both a profile row and a matching Supabase Auth account.
- Leave submission and review, attendance clocking, schedules, HR requests/comments/decisions, notifications, document acknowledgements, benefits, goals, lifecycle tasks, payroll transitions, performance draft/publish, profile phone updates, announcements, password changes, alert responses, and session removal persist after refresh.
- Draft performance reviews and Draft/Validation/Approved payroll records are not visible to employees.
- Released payroll creates employee notifications; published performance reviews appear only to the matching employee.
- Completing an offboarding checklist changes the employee profile to Inactive and prevents subsequent login.
- Sensitive API requests return no data when signed out.
- Supabase Table Editor shows RLS enabled for every HRMS table.
- Netlify deployment has no browser-console or failed-network errors.

## Security boundary

The publishable key identifies the Supabase project; it is not an authorization secret. Supabase Auth supplies the user's access token, while PostgreSQL Row-Level Security decides which rows and operations that user may access. The privileged secret key exists only in Netlify's server-side environment and is used by one endpoint after that endpoint independently verifies the caller is an active HR administrator. Employee, payroll, request, document, workflow, and security data are never stored in browser storage.

## Free local QA

Use the local Supabase workflow for authenticated automation, migration resets, and OWASP ZAP active scanning. It does not consume another hosted Free-plan project and fails closed if its runner sees a non-local Supabase URL. See [local-free-qa.md](local-free-qa.md).
