// One email-safe layout for application mail and Supabase Auth templates.
// The logo is the original PNG, emitted at this stable URL by Vite (no signed URL).
export const EMAIL_LOGO_PATH = '/email-assets/quantumn-art-resources-blue.png'
export const EMAIL_LOGO_URL = `https://quantumnhr.com${EMAIL_LOGO_PATH}`
export const BRAND_NAME = 'Quantumn Art Resources'

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

const safeUrl = (value) => {
  const url = new globalThis.URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password) {
    throw new Error('Email links must use HTTPS or a local test origin.')
  }
  return escapeHtml(url.href)
}

const paragraph = (text) => `<p style="margin:0 0 18px;color:#41536b;font-size:15px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word">${text}</p>`
const detail = (label, value) => `<tr><td style="padding:12px 16px;border-bottom:1px solid #e1e8f2;word-break:break-word"><div style="font-size:12px;line-height:1.5;color:#52647b;font-weight:bold">${escapeHtml(label)}</div><div style="margin-top:4px;font-size:15px;line-height:1.6;color:#142d4e;overflow-wrap:anywhere;word-break:break-word">${value}</div></td></tr>`
const details = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f7fc" style="width:100%;table-layout:fixed;margin:0 0 24px;border:1px solid #e1e8f2;border-radius:12px;background:#f4f7fc">${rows.map(([label, value]) => detail(label, value)).join('')}</table>`

// bodyHtml is assembled only by the template functions below, never from request HTML.
const layout = ({ title, category, preheader, bodyHtml, notice, action, goTemplate = false }) => {
  const actionUrl = action ? (goTemplate ? action.url : safeUrl(action.url)) : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)} | ${BRAND_NAME}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a:focus{outline:2px solid #155bc5;outline-offset:3px}@media only screen and (max-width:480px){.email-outer{padding:16px 8px!important}.email-content{padding:24px 20px!important}.email-title{font-size:25px!important}.email-logo{width:200px!important;height:100px!important}}</style></head>
<body style="margin:0;padding:0;background:#edf2f8;color:#142d4e;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;color:#edf2f8;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#edf2f8"><tr><td class="email-outer" align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;table-layout:fixed;border:1px solid #dce5ef;border-radius:16px;background:#ffffff">
<tr><td align="center" bgcolor="#ffffff" style="padding:18px 24px;border-bottom:1px solid #e1e8f2;background:#ffffff;border-radius:16px 16px 0 0"><img class="email-logo" src="${EMAIL_LOGO_URL}" alt="Quantumn Art Resources — original blue logo" width="220" height="110" style="display:block;width:220px;height:110px;max-width:100%;background:#ffffff;color:#0057ff;font-size:14px"></td></tr>
<tr><td class="email-content" style="padding:32px">
<p style="margin:0 0 10px;font-size:12px;line-height:1.5;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#155bc5">${escapeHtml(category)}</p>
<h1 class="email-title" style="margin:0 0 20px;color:#142d4e;font-size:28px;line-height:1.25;font-weight:bold">${escapeHtml(title)}</h1>
${bodyHtml}
${action ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td bgcolor="#155bc5" align="center" style="border-radius:8px;background:#155bc5"><a href="${actionUrl}" style="display:block;padding:15px 20px;border:1px solid #155bc5;border-radius:8px;color:#ffffff;font-size:15px;line-height:1.5;font-weight:bold;text-decoration:none;mso-padding-alt:0"><!--[if mso]><i style="mso-font-width:100%;mso-text-raise:24pt">&#8202;</i><![endif]-->${escapeHtml(action.label)}<!--[if mso]><i style="mso-font-width:100%">&#8202;</i><![endif]--></a></td></tr></table>
<p style="margin:0 0 24px;color:#52647b;font-size:12px;line-height:1.7;word-break:break-all">If the button does not work, copy this link into your browser:<br><a href="${actionUrl}" style="color:#155bc5;text-decoration:underline;word-break:break-all">${actionUrl}</a></p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f7fc" style="background:#f4f7fc;border-left:3px solid #155bc5"><tr><td style="padding:14px 16px;color:#41536b;font-size:13px;line-height:1.7">${escapeHtml(notice)}</td></tr></table>
</td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e1e8f2;color:#52647b;font-size:12px;line-height:1.7;text-align:center"><strong style="color:#142d4e">${BRAND_NAME}</strong><br>Human Resource Management System<br>Questions? Contact your organization’s HR team or System Administrator.<br><a href="https://quantumnhr.com" style="color:#155bc5;text-decoration:underline">quantumnhr.com</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}

export const credentialsEmail = ({ employee, employeeCode, loginUrl }) => {
  const name = employee.preferredName || employee.firstName
  const notice = 'Keep these credentials private. Quantumn Art Resources will never ask you to send your password by email or chat. Replace this temporary password at your first sign-in.'
  return {
    subject: 'Your Quantum HRMS employee account is ready',
    text: [`${BRAND_NAME} | Employee account`, '', `Hello ${name},`, '', 'Your Quantum HRMS employee account has been created.', `Employee ID: ${employeeCode}`, `Work email: ${employee.email}`, `Temporary password: ${employee.password}`, `Employee portal: ${loginUrl}`, '', 'You must replace this temporary password when you sign in for the first time.', 'Choose a unique passphrase of at least 15 characters. Do not reuse this temporary password or a password from another account.', '', notice].join('\n'),
    html: layout({
      title: 'Your employee account is ready', category: 'Employee access', preheader: 'Your employee workspace is ready. Set a private password at your first sign-in.',
      bodyHtml: paragraph(`Hello <strong>${escapeHtml(name)}</strong>,`) + paragraph('Welcome to your employee portal. Use the temporary credentials below for your first sign-in. You will be asked to create your own private password before entering the workspace.') + details([
        ['Employee ID', escapeHtml(employeeCode)], ['Work email', escapeHtml(employee.email)],
        ['Temporary password', `<span style="font-family:Consolas,monospace;font-size:15px;white-space:pre-wrap">${escapeHtml(employee.password)}</span>`],
      ]) + paragraph('Choose a unique passphrase of at least <strong>15 characters</strong>. Do not reuse this temporary password or a password from another account.'),
      action: { label: 'Open employee portal', url: loginUrl }, notice,
    }),
  }
}

export const invitationEmail = ({ firstName, roleLabel, setupLink, appUrl }) => {
  const notice = 'Keep this personal, time-limited invitation private. If you were not expecting this role, do not open the link. Contact your organization’s System Administrator.'
  return {
    subject: 'You have been invited to administer Quantum HRMS',
    text: `${BRAND_NAME} | Administrator invitation\n\nHello ${firstName},\n\nYou were invited to Quantum HRMS as ${roleLabel}. Use this personal, time-limited link to verify the invitation and create your password:\n\n${setupLink}\n\nAdministrator portal: ${appUrl}/admin/login\n\n${notice}`,
    html: layout({
      title: 'Your administrator invitation', category: 'Administrator access', preheader: 'Accept your role-scoped invitation and create your private password.',
      bodyHtml: paragraph(`Hello <strong>${escapeHtml(firstName)}</strong>,`) + paragraph('A System Administrator has invited you to the HR management workspace. Accept the invitation to verify your account and choose your private password.') + details([['Assigned access role', escapeHtml(roleLabel)]]) + paragraph('Your access is limited to the permissions assigned to this role. No password is included in this invitation.'),
      action: { label: 'Accept invitation & set password', url: setupLink }, notice,
    }),
  }
}

// Provider tokens remain untouched; Supabase escapes values and supplies its own
// verified action URL. Never substitute SiteURL/RedirectTo for ConfirmationURL.
const authDefinitions = [
  { id: 'confirmation', title: 'Confirm your email address', intro: 'Confirm this email address to continue setting up your Quantumn Art Resources account.', action: 'Confirm email address', notice: 'If you did not request an account, ignore this email and contact your organization if you have concerns.' },
  { id: 'invite', title: 'You’re invited to your HR workspace', intro: 'Your organization has invited you to its HR workspace. Accept this personal invitation to continue setting up your account.', action: 'Accept invitation', notice: 'Only accept an invitation you were expecting. Do not forward this personal, time-limited link.' },
  { id: 'recovery', title: 'Reset your password', intro: 'We received a request to reset your password. Use the secure link below to choose a new private password.', action: 'Reset password', notice: 'If you did not request a password reset, you can ignore this email. Your password will not change unless you complete the reset. Never share this link.' },
  { id: 'magic_link', title: 'Your secure sign-in link', intro: 'Use this personal, one-time link to sign in to your Quantumn Art Resources account.', action: 'Sign in securely', notice: 'If you did not request this sign-in, do not open the link or share the code. You can ignore this email.' },
  { id: 'email_change', title: 'Confirm your email change', intro: 'A request was made to change the email address on your account. Confirm only if you requested this change.', action: 'Confirm email change', notice: 'If you did not request this change, do not confirm it. Contact your System Administrator. You may need to confirm from both your current and new inbox.' },
  { id: 'reauthentication', title: 'Verify your identity', intro: 'Enter this verification code in the workspace to continue the sensitive action you requested.', notice: 'Never share this verification code. If you did not request it, do not use it and contact your System Administrator.' },
  { id: 'password_changed_notification', title: 'Your password was changed', intro: 'The password for your Quantumn Art Resources account was changed. No password is included in this email.' },
  { id: 'email_changed_notification', title: 'Your email address was changed', intro: 'The sign-in email address for your account was changed.' },
  { id: 'phone_changed_notification', title: 'Your sign-in phone number was changed', intro: 'The phone number connected to your authentication account was changed. This is separate from your HR contact record.' },
  { id: 'identity_linked_notification', title: 'A sign-in method was linked', intro: 'An additional sign-in method was linked to your account.' },
  { id: 'identity_unlinked_notification', title: 'A sign-in method was removed', intro: 'A sign-in method was removed from your account.' },
  { id: 'mfa_factor_enrolled_notification', title: 'A verification method was added', intro: 'A multi-factor verification method was added to your account.' },
  { id: 'mfa_factor_unenrolled_notification', title: 'A verification method was removed', intro: 'A multi-factor verification method was removed from your account.' },
]

export const authEmailTemplates = authDefinitions.map(definition => {
  const notification = definition.id.endsWith('_notification')
  const rows = [['Account email', '{{ .Email }}']]
  if (definition.id === 'email_change') rows.push(['Requested email', '{{ .NewEmail }}'])
  if (definition.id === 'email_changed_notification') rows.push(['Previous email', '{{ .OldEmail }}'])
  if (definition.id === 'phone_changed_notification') rows.push(['Previous phone', '{{ .OldPhone }}'], ['New phone', '{{ .Phone }}'])
  if (definition.id.startsWith('identity_')) rows.push(['Sign-in method', '{{ .Provider }}'])
  if (definition.id.startsWith('mfa_factor_')) rows.push(['Verification method', '{{ .FactorType }}'])
  if (['reauthentication', 'magic_link'].includes(definition.id)) rows.push(['Verification code', '<strong style="font-family:Consolas,monospace;font-size:24px;letter-spacing:3px">{{ .Token }}</strong>'])
  return {
    id: definition.id,
    subject: `${definition.title} | ${BRAND_NAME}`,
    notification,
    html: layout({
      title: definition.title, category: notification ? 'Account security' : 'Secure account access',
      preheader: definition.intro,
      bodyHtml: paragraph(definition.intro) + details(rows),
      action: definition.action ? { label: definition.action, url: '{{ .ConfirmationURL }}' } : undefined,
      notice: definition.notice || 'If you made this change, no further action is needed. If you do not recognize it, open the website directly and contact your System Administrator immediately to secure your account.',
      goTemplate: true,
    }),
  }
})

export const supabaseTemplatePatch = () => Object.fromEntries(authEmailTemplates.flatMap(template => [
  [`mailer_subjects_${template.id}`, template.subject],
  [`mailer_templates_${template.id}_content`, template.html],
]))
