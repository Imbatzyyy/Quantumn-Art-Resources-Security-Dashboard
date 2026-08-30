# Supabase and Netlify migration guide

The React application uses Supabase as its only runtime system of record. The implementation and migrations are present; deployment variables and Auth users are configured per environment.

## Implemented Supabase tables

The current migration maps the HRMS model to PostgreSQL tables with explicit employee-code relationships:

- `profiles` - employee identity, department, position, status, and permitted profile fields
- `attendance` - employee, date, clock-in, clock-out, status, and calculated hours
- `leave_requests` - employee, leave type, dates, reason, status, and approver
- `payroll` - employee, pay period, gross, deductions, net, status, and payment date
- `performance_reviews` - employee, reviewer, period, scores, comments, and goal progress
- `announcements` - title, content, priority, author, and publication date
- `security_alerts` - employee, severity, explanation, recommended action, and response status
- `audit_logs` - actor, plain-language action, target, and time
- `account_sessions` - employee, device label, coarse location, last activity, and current-session state
- `employee_requests` and `request_comments` - cross-functional HR cases, decisions, and conversations
- `notifications` - employee action-inbox items and read status
- `employee_documents` and `document_acknowledgements` - policies and private records
- `work_schedules` - employee shifts, location, and work mode
- `employee_benefits` and `employee_goals` - total rewards and growth records
- `lifecycle_cases` and `lifecycle_tasks` - accountable onboarding/offboarding
- `payroll_runs` - staged payroll control totals and approvals
- `performance_cycles` - review-cycle governance

## Access model

- Employees may read only their own rows plus organization-wide policies and announcements.
- Employees mutate sensitive workflows only through ownership-validating database RPCs.
- HR administrators manage people, requests, schedules, lifecycle, growth, policy, and communications.
- Payroll administrators manage pay and benefits without receiving security-administration privileges.
- Security administrators review organization security events without receiving people or payroll write access.
- Auditors receive read-only evidence access to their assigned modules.
- Sensitive fields should be masked by default and exposed only through narrowly authorized operations.
- Every exposed table requires Row-Level Security with specific ownership or role policies.

Authorization roles should come from server-controlled claims or a protected role table, not user-editable profile metadata.

## Provider conversion

`src/services/supabaseProvider.js` is the only data provider. It includes:

- `getSnapshot`
- `authenticate`
- `addEmployee`
- `updateEmployee`
- `submitLeave`
- `reviewLeave`
- `clock`
- `updateAlert`
- `respondToAlert`
- `endSession`
- `changePassword`
- `addAnnouncement`
- `generatePayroll`
- `transitionPayrollRun`
- `savePerformance`
- `publishPerformance`
- unified request, notification, document, schedule, benefit, goal, lifecycle, and cycle workflows
- `recordActivity`
- `refresh`

`src/services/dataProvider.js` always selects this implementation. No bundled seed module or local HR data provider remains in the React runtime.

## Secret handling

- A publishable Supabase key may be used by browser code together with Row-Level Security.
- Never place a service-role key, database password, or other privileged secret in a `VITE_` variable.
- Privileged operations should run in a protected server-side function and verify the signed-in user and role before accessing data.
- Use fictional records for the public classroom deployment.

## Netlify deployment sequence

1. Push the repository to GitHub.
2. Import the repository into Netlify.
3. Confirm build command `npm run build` and publish directory `dist`.
4. Add only required environment variables in Netlify project settings.
5. Deploy a preview first and test every route, role, and responsive layout.
6. Connect the custom domain after the preview passes.
7. Configure Cloudflare DNS for the Netlify-provided domain target.
8. Run authorized OWASP ZAP, Lighthouse, axe, and usability tests against the final HTTPS URL.

## Migration order

1. Create and review PostgreSQL migrations.
2. Insert only fictional seed data.
3. Configure Supabase Auth and administrator MFA.
4. Add and test Row-Level Security policies.
5. Implement the Supabase provider.
6. Add protected serverless functions for privileged actions.
7. Run authorization tests for employee/admin separation.
8. Deploy a Netlify preview and complete end-to-end testing.
