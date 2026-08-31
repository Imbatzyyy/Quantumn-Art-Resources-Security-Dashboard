# Branded transactional emails

## Coverage

Every currently implemented email delivery path has a dedicated template using the original `assets/images/mainlogo_blue.png`. The image is not recolored, regenerated, cropped, or replaced.

| Email | Sender / integration | Template |
| --- | --- | --- |
| New employee account / temporary credentials | Protected Netlify function → Resend | `credentialsEmail` |
| Administrator invitation / password setup | Protected Netlify function → Resend | `invitationEmail` |
| Password reset | Supabase Auth; Employee Forgot password | `supabase/templates/recovery.html` |
| Signup confirmation | Supabase Auth, when used | `supabase/templates/confirmation.html` |
| Supabase invitation | Supabase Auth, when used directly | `supabase/templates/invite.html` |
| Magic link / email OTP | Supabase Auth, when used | `supabase/templates/magic_link.html` |
| Confirm email change | Supabase Auth, when used | `supabase/templates/email_change.html` |
| Reauthentication code | Supabase Auth, when requested | `supabase/templates/reauthentication.html` |
| Password changed | Supabase Auth security notification, if enabled | `supabase/templates/password_changed_notification.html` |
| Email address changed | Supabase Auth security notification, if enabled | `supabase/templates/email_changed_notification.html` |
| Sign-in phone changed | Supabase Auth security notification, if enabled | `supabase/templates/phone_changed_notification.html` |
| Sign-in method linked / removed | Supabase Auth security notification, if enabled | `supabase/templates/identity_linked_notification.html`, `identity_unlinked_notification.html` |
| MFA method added / removed | Supabase Auth security notification, if enabled | `supabase/templates/mfa_factor_enrolled_notification.html`, `mfa_factor_unenrolled_notification.html` |

In-app announcements, request decisions, payroll, leave, and document notifications currently write database notifications; they do **not** send email. This update does not add new email triggers, alter employee permissions, enable signup, enable magic-link UI, or turn on optional security notifications. HR phone-record edits are not Supabase Auth phone changes.

## Source of truth

- `netlify/functions/_shared/email-templates.mjs`: shared HTML layout, application email renderers, Supabase template definitions, and a template-only Management API payload.
- `npm run emails:generate`: rebuild the 13 checked-in Supabase HTML files after editing the shared module.
- `npm run emails:check`: detect stale generated templates.
- `supabase/config.toml`: wires all templates into local Supabase; local notification switches remain disabled as before.
- `vite.config.ts`: emits the original PNG bytes at `/email-assets/quantumn-art-resources-blue.png` for stable, public HTTPS email image loading. It also serves that same path during local development. Do not delete this path in future releases: old emails still reference it.

The email layout uses inline styling and presentation tables, a white logo plate, accessible alt text, conservative fonts, mobile spacing, and a clear action button with a copyable URL fallback. App emails also have plain-text alternatives. Dynamic application values are HTML escaped. Passwords are not truncated or trimmed. Supabase placeholders stay provider-owned, and action emails preserve `{{ .ConfirmationURL }}` rather than substituting a login URL. Reauthentication uses `{{ .Token }}`.

Some email clients block remote images until the recipient permits them. Alt text and visible company identification remain available; no template can override a recipient's image-blocking policy. Browser-based rendering checks are not a claim of identical rendering in every Gmail, Outlook, or Apple Mail version.

## Release procedure — two separate systems

1. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run emails:check`, and `npx playwright test visual-tests/email-templates.spec.ts`.
2. Build/deploy Netlify using its **production environment context** (never a build with missing Supabase variables). Verify the stable logo URL returns `image/png` and exactly matches the original PNG before changing hosted Auth templates.
3. In the linked Supabase project's **Authentication → Emails**, apply each generated HTML file and its subject from `authEmailTemplates` in the shared module. Alternatively use `supabaseTemplatePatch()` with the Supabase Management API. It contains only the 26 template/subject keys, not SMTP secrets, redirect URLs, signup settings, or notification enablement flags.
4. Preserve existing notification switches and SMTP settings. Changing local `config.toml` or deploying Netlify does **not** update hosted Supabase email templates. **Do not run `supabase config push` using the local-QA configuration**: it contains localhost URLs and local-only authentication settings.
5. Reopen the hosted templates and verify the saved subject, original-logo URL, action URL placeholder, and applicable code/notification fields. Keep SMTP link tracking disabled for one-time authentication URLs, following Supabase's guidance.
6. With an explicitly designated test inbox/account, verify employee welcome mail, admin invitation acceptance, and Forgot password → reset → sign-in. Never provision accounts or send tests to real employees merely to validate a template. Check provider acceptance separately from actual inbox receipt; a successful API response alone is not proof of delivery.

## Verification status (2026-08-31)

- 183 unit tests passed, including template escaping, all 13 provider-token contracts, intended-recipient delivery payloads, unauthenticated-send rejection, and cleanup on provider rejection/network failure for both application email senders.
- 31 email visual/accessibility checks passed: all 15 templates at 320px and 800px, plus a byte-for-byte check of the public logo endpoint. Six reviewed baseline screenshots cover the employee welcome, administrator invitation, and password reset layouts.
- **Released to production:** Netlify deployment `6a95691759eebd02b3393e74` published the application senders and public logo using the production build context. Immutable release: https://6a95691759eebd02b3393e74--quantumnartresources.netlify.app. Live site: https://quantumnhr.com.
- The live `/email-assets/quantumn-art-resources-blue.png` endpoint returned HTTP 200 with `image/png`; its SHA-256 matched the original PNG. The image also displayed correctly when opened in the browser.
- **All 13 hosted Supabase Auth templates were applied through the authenticated dashboard.** Each was saved, reopened, and compared with its local HTML source (excluding the dashboard's injected preview style). Subjects were verified from the rendered editor or screenshot. This includes Reset password; updating Netlify alone would not have changed it.
- Supabase's dashboard preview blocks the external logo: its `img-src` Content Security Policy does not allow `quantumnhr.com`. The public asset itself is working. No application security policy was weakened to accommodate the dashboard preview.
- All seven optional security-notification switches remain off, verified again after saving templates. Custom SMTP remains enabled with `smtp.resend.com` on port 465; credentials and delivery settings were not changed. Templates are installed for optional email types but do not enable their triggers.
- **Inbox delivery still requires a designated test account:** no real emails were sent and no accounts were created for this release. The user was asked to designate an existing test inbox for a password-reset email; no address was inferred from screenshots or employee records. Local Docker was unavailable, so full isolated SMTP/Auth journeys were not rerun. Saved production configuration, automated provider-payload tests, and browser rendering do not by themselves prove inbox receipt or completion of a real reset.

## References

- [Supabase email templates and supported placeholders](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Local Supabase email template configuration](https://supabase.com/docs/guides/local-development/customizing-email-templates)
