import { useState, type FormEvent } from 'react'
import { BadgeCheck, Building2, Check, Crown, Info, KeyRound, LockKeyhole, Mail, MailCheck, Plus, ShieldCheck, UserCheck, UserCog, UserX, Users } from 'lucide-react'
import { Badge, ConfirmDialog, EmptyState, Modal, SectionHeading, StatCard } from '../components/ui.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { Banner, Field, FormFooter, FormIntro, SectionTitle, PersonCard } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import { formatDateTime, statusTone } from '../utils/format.js'
import type { AdminInviteInput } from '../types/hrms.js'
import type { EmployeeRecord } from '../types/hrms.js'
import { adminPasswordReset } from '../services/adminPasswordReset.js'

type AdminRoleKey = AdminInviteInput['role']

interface AdminRoleDefinition {
  label: string
  short: string
  description: string
  permissions: string[]
  icon: typeof Crown
  tone: string
}

const adminRoles: Record<AdminRoleKey, AdminRoleDefinition> = {
  admin: {
    label: 'System Administrator',
    short: 'Full system control',
    description: 'Manages administrator accounts, people, payroll, governance, and security configuration.',
    permissions: ['Administrator invitations', 'All HR operations', 'Security and audit controls'],
    icon: Crown,
    tone: 'danger',
  },
  hr_admin: {
    label: 'HR Administrator',
    short: 'People operations',
    description: 'Manages employee records, attendance, requests, lifecycle, policies, and performance.',
    permissions: ['Employee administration', 'Approvals and lifecycle', 'HR documents and reports'],
    icon: Users,
    tone: 'info',
  },
  payroll_admin: {
    label: 'Payroll Administrator',
    short: 'Pay operations',
    description: 'Processes payroll runs and accesses only the financial records required for payroll work.',
    permissions: ['Payroll processing', 'Authorized pay records', 'Payroll reporting'],
    icon: KeyRound,
    tone: 'warning',
  },
  security_admin: {
    label: 'Security Administrator',
    short: 'Security operations',
    description: 'Investigates alerts, reviews sessions, and operates the Security Center.',
    permissions: ['Alert investigations', 'Session review', 'Security audit evidence'],
    icon: ShieldCheck,
    tone: 'success',
  },
  auditor: {
    label: 'Compliance Auditor',
    short: 'Read-only evidence',
    description: 'Reviews authorized HR, governance, payroll, and security evidence without operational control.',
    permissions: ['Read-only reports', 'Audit trail access', 'Governance evidence'],
    icon: BadgeCheck,
    tone: 'neutral',
  },
}

const emptyForm: AdminInviteInput = { firstName: '', lastName: '', email: '', phone: '', role: 'hr_admin', confirmed: false }

export default function AdminAccounts() {
  const { data, user, inviteAdminAccount, manageAdminAccount } = useHrms()
  const [managing, setManaging] = useState<EmployeeRecord | null>(null)
  const [nextRole, setNextRole] = useState<AdminRoleKey>('hr_admin')
  const [roleSaving, setRoleSaving] = useState(false)
  const [accessChange, setAccessChange] = useState<{ account: EmployeeRecord; operation: 'deactivate' | 'reactivate' } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [resetAccount, setResetAccount] = useState<EmployeeRecord | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetConfirmed, setResetConfirmed] = useState(false)
  if (!data || !user) return null

  const accounts = data.employees.filter((employee) => employee.role !== 'employee')
  const activeAccounts = accounts.filter((account) => account.status === 'Active').length
  const representedRoles = new Set(accounts.map((account) => account.role)).size
  const lastActive = (accountId: string) => data.sessions.filter((session) => session.employeeId === accountId).map((session) => session.lastSeenAt ?? session.createdAt ?? '').sort().at(-1)
  const accountColumns: DataColumn<EmployeeRecord>[] = [
    { id: 'name', header: 'Administrator', primary: true, cell: (account) => <span className="table-person"><span className="table-initials" aria-hidden="true">{account.firstName[0]}{account.lastName[0]}</span><span className="cell-stack"><strong>{account.firstName} {account.lastName}</strong><small>{account.email}</small></span></span>, sortValue: (account) => `${account.lastName} ${account.firstName}`, csv: (account) => `${account.firstName} ${account.lastName}` },
    { id: 'email', header: 'Email', exportOnly: true, cell: (account) => account.email, csv: (account) => account.email },
    { id: 'role', header: 'Role', cell: (account) => { const role = adminRoles[account.role as AdminRoleKey] || adminRoles.auditor; return <span className="cell-stack"><Badge tone={role.tone}>{role.label}</Badge><small>{role.short}</small></span> }, sortValue: (account) => (adminRoles[account.role as AdminRoleKey] || adminRoles.auditor).label },
    { id: 'department', header: 'Department', hideOnMobile: true, cell: (account) => account.department, sortValue: (account) => account.department },
    { id: 'active', header: 'Last active', hideOnMobile: true, cell: (account) => { const at = lastActive(account.id); return at ? formatDateTime(at) : <span className="text-muted">No recent sign-in</span> }, sortValue: (account) => lastActive(account.id) ?? '' },
    { id: 'status', header: 'Status', cell: (account) => <Badge tone={statusTone(account.status)}>{account.status}</Badge>, sortValue: (account) => account.status },
    { id: 'actions', header: '', align: 'end', cell: (account) => <div className="table-actions">
      {manageAdminAccount && account.id !== user?.id && <button type="button" className="button button-secondary button-small" aria-label={`Manage access for ${account.firstName} ${account.lastName}`} onClick={() => { setManaging(account); setNextRole((adminRoles[account.role as AdminRoleKey] ? account.role : 'auditor') as AdminRoleKey) }}><UserCog size={16} aria-hidden="true" />Manage</button>}
      <button className="button button-secondary button-small admin-reset-trigger" disabled={account.status !== 'Active'} aria-label={`Reset password for ${account.firstName} ${account.lastName}`} onClick={() => { setResetAccount(account); setResetError(''); setResetSent(false); setResetConfirmed(false) }}><KeyRound size={16} aria-hidden="true" />Reset password</button>
    </div> },
  ]
  const saveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!managing || !manageAdminAccount || nextRole === managing.role) return
    setRoleSaving(true)
    try {
      await manageAdminAccount({ operation: 'change-role', employeeId: managing.id, role: nextRole })
      setManaging(null)
    } catch { /* The shared toast explains the error. */ }
    finally { setRoleSaving(false) }
  }
  const sendReset = async () => {
    if (!resetAccount || !resetConfirmed || resetBusy) return
    setResetBusy(true); setResetError('')
    try {
      await adminPasswordReset({ action: 'send', employeeCode: resetAccount.id, confirmed: true }, true)
      setResetSent(true)
    } catch (reason) { setResetError(reason instanceof Error ? reason.message : 'The reset email could not be sent.') }
    finally { setResetBusy(false) }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.confirmed) return
    setSubmitting(true)
    try {
      await inviteAdminAccount(form)
      setForm(emptyForm)
      setShowInvite(false)
    } catch {
      // The protected server response is displayed by the shared toast.
    } finally {
      setSubmitting(false)
    }
  }

  if (user.role !== 'admin') {
    return <EmptyState icon={LockKeyhole} title="System Administrator access required" text="Only a full System Administrator can create or assign privileged accounts." />
  }

  return (
    <div className="page-stack admin-accounts-page">
      <SectionHeading title="Admin Accounts" description="Invite administrators and give each one only the access they need. Invitations include a personal link to set a password." actions={<button className="button button-primary" onClick={() => setShowInvite(true)}><Plus size={17} aria-hidden="true" />Invite administrator</button>} />

      <div className="stats-grid stats-grid-3">
        <StatCard icon={UserCog} label="Administrator accounts" value={accounts.length} detail={`${activeAccounts} active`} tone="blue" />
        <StatCard icon={BadgeCheck} label="System Administrators" value={accounts.filter((account) => account.role === 'admin').length} detail="Full access, keep this small" tone="amber" />
        <StatCard icon={Building2} label="Roles in use" value={representedRoles} detail={`Of ${Object.keys(adminRoles).length} available roles`} tone="purple" />
      </div>

      <section className="panel">
        <div className="panel-header"><div><h2>Administrators</h2><p>Everyone with access to the admin console</p></div></div>
        <DataTable
          rows={accounts}
          columns={accountColumns}
          getRowId={(account) => account.id}
          caption="Administrator accounts"
          count={{ singular: 'administrator', plural: 'administrators' }}
          search={{ placeholder: 'Search administrators', text: (account) => `${account.firstName} ${account.lastName} ${account.email} ${account.id}` }}
          filters={[{ id: 'role', label: 'Roles', value: (account) => (adminRoles[account.role as AdminRoleKey] || adminRoles.auditor).label }, { id: 'status', label: 'Statuses', value: (account) => account.status }]}
          initialSort={{ column: 'name', direction: 'asc' }}
          exportName="administrator-accounts"
          empty={{ icon: UserCog, title: 'No administrators yet', text: 'Invite the first administrator.' }}
        />
      </section>

      <section className="panel">
        <details className="role-guide">
          <summary><span><strong>What can each role do?</strong><small>Choose the smallest role that covers someone’s job.</small></span></summary>
          <div className="admin-role-catalog">{Object.entries(adminRoles).map(([key, role]) => { const Icon = role.icon; return <article key={key}><span aria-hidden="true"><Icon /></span><div><strong>{role.label}</strong><small>{role.short}</small><p>{role.description}</p><ul>{role.permissions.map((permission) => <li key={permission}><Check aria-hidden="true" />{permission}</li>)}</ul></div></article> })}</div>
        </details>
      </section>

      {managing && <Modal title={`Manage ${managing.firstName} ${managing.lastName}`} onClose={() => !roleSaving && setManaging(null)} dismissible={!roleSaving}>
        <form className="rf-form rf-form-compact" onSubmit={saveRole} aria-busy={roleSaving}>
          <PersonCard name={`${managing.firstName} ${managing.lastName}`} meta={`${managing.email} · ${managing.status}`} />
          <fieldset className="rf-field rf-choices rf-choices--list">
            <legend className="rf-label">Role</legend>
            <div>{Object.entries(adminRoles).map(([key, role]) => <label key={key} className={`rf-choice${nextRole === key ? ' is-selected' : ''}`}>
              <input type="radio" name="manage-admin-role" value={key} checked={nextRole === key} onChange={(event) => setNextRole(event.target.value as AdminRoleKey)} />
              <span><strong>{role.label}{key === managing.role ? ' (current)' : ''}</strong><small>{role.short}</small></span>
            </label>)}</div>
          </fieldset>
          <p className="rf-help rf-tip"><Info aria-hidden="true" />Changing the role signs {managing.firstName} out of every browser. The new access applies when they sign in again.</p>
          <div className="modal-actions modal-actions-split">
            {managing.status === 'Inactive'
              ? <button type="button" className="button button-secondary" disabled={roleSaving} onClick={() => { setAccessChange({ account: managing, operation: 'reactivate' }); setManaging(null) }}><UserCheck size={17} aria-hidden="true" />Reactivate account</button>
              : <button type="button" className="button button-secondary danger-text" disabled={roleSaving} onClick={() => { setAccessChange({ account: managing, operation: 'deactivate' }); setManaging(null) }}><UserX size={17} aria-hidden="true" />Deactivate account</button>}
            <span className="modal-actions-group">
              <button type="button" className="button button-secondary" onClick={() => setManaging(null)} disabled={roleSaving}>Cancel</button>
              <button className="button button-primary" disabled={roleSaving || nextRole === managing.role}>{roleSaving ? 'Saving…' : 'Save role'}</button>
            </span>
          </div>
        </form>
      </Modal>}

      {accessChange && <ConfirmDialog
        title={accessChange.operation === 'deactivate' ? 'Deactivate administrator' : 'Reactivate administrator'}
        icon={accessChange.operation === 'deactivate' ? UserX : UserCheck}
        tone={accessChange.operation === 'deactivate' ? 'danger' : 'primary'}
        heading={`${accessChange.operation === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${accessChange.account.firstName} ${accessChange.account.lastName}?`}
        message={<p>{accessChange.operation === 'deactivate'
          ? 'They are signed out of every browser and can’t sign in until a System Administrator reactivates the account. Their records and audit history are kept.'
          : 'They can sign in again with their existing password and authenticator, with the same role as before.'}</p>}
        confirmLabel={accessChange.operation === 'deactivate' ? 'Deactivate account' : 'Reactivate account'}
        busyLabel="Saving…"
        onCancel={() => setAccessChange(null)}
        onConfirm={async () => { await manageAdminAccount?.({ operation: accessChange.operation, employeeId: accessChange.account.id }); setAccessChange(null) }}
      />}

      {resetAccount && <Modal title={resetSent ? 'Reset email requested' : 'Reset administrator password'} onClose={() => !resetBusy && setResetAccount(null)} size="wide">
        <div className="rf-form rf-form--sm" aria-busy={resetBusy}>
          <div className="admin-reset-content">
            <Banner icon={resetSent ? MailCheck : KeyRound} title={resetSent ? 'Check the administrator’s inbox' : 'Send a private recovery link'} tone={resetSent ? 'success' : 'info'}>{resetSent ? 'The email provider accepted the message. Delivery to the inbox may take a moment; the recipient can also check Spam or Junk.' : 'Only the selected administrator receives the link. Their password and role stay unchanged until they complete the reset.'}</Banner>
            <PersonCard name={`${resetAccount.firstName} ${resetAccount.lastName}`} meta={resetAccount.email} />
            <ul className="admin-reset-details"><li>The link expires 30 minutes after the request and works once.</li><li>A new reset replaces any previous reset link.</li><li>An enrolled authenticator is still required.</li><li>Saving a new password revokes existing HRMS sessions.</li></ul>
            {!resetSent && <label className="account-policy-confirm"><input type="checkbox" checked={resetConfirmed} onChange={event => setResetConfirmed(event.target.checked)} disabled={resetBusy} /><span>I verified this administrator’s identity and their request for a password reset.</span></label>}
            {resetError && <p className="rf-error" role="alert">{resetError}</p>}
          </div>
          <FormFooter icon={ShieldCheck} note="This security action is recorded in the audit log.">
            <button type="button" className="button button-secondary" disabled={resetBusy} onClick={() => setResetAccount(null)}>{resetSent ? 'Done' : 'Cancel'}</button>
            {!resetSent && <button type="button" className="button button-primary" disabled={!resetConfirmed || resetBusy} onClick={() => void sendReset()}><Mail size={17} />{resetBusy ? 'Sending reset email…' : 'Send reset email'}</button>}
          </FormFooter>
        </div>
      </Modal>}

      {showInvite && (
        <Modal title="Invite administrator account" onClose={() => !submitting && setShowInvite(false)} size="large">
          <form className="rf-form rf-form--md" onSubmit={submit} aria-busy={submitting}>
            <FormIntro aside={<Badge tone="success">No emailed password</Badge>}>Create an administrator account with only the access they need. They receive a personal, time-limited email link to set their own password.</FormIntro>
            <div className="rf-single">
              <section className="rf-section">
                <SectionTitle step={1} description="Use their verified work details.">Administrator details</SectionTitle>
                <div className="rf-grid">
                  <Field label="First name">{(control) => <input {...control} maxLength={80} autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="Enter first name" required />}</Field>
                  <Field label="Last name">{(control) => <input {...control} maxLength={80} autoComplete="family-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Enter last name" required />}</Field>
                  <Field label="Work email" help="The invitation is sent here, and it becomes their sign-in.">{(control) => <input {...control} type="email" maxLength={254} autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" required />}</Field>
                  <Field label="Mobile number" optional help="Used for account recovery.">{(control) => <input {...control} type="tel" minLength={7} maxLength={30} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+63 912 345 6789" />}</Field>
                </div>
              </section>
              <section className="rf-section">
                <SectionTitle step={2} description="Choose the smallest role that covers their responsibilities.">Access role</SectionTitle>
                <fieldset className="rf-field rf-choices rf-choices--2">
                  <legend className="sr-only">Access role</legend>
                  <div>{Object.entries(adminRoles).map(([key, role]) => <label className={`rf-choice${form.role === key ? ' is-selected' : ''}`} key={key}>
                    <input type="radio" name="admin-role" value={key} checked={form.role === key} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRoleKey })} />
                    <span><strong>{role.label}</strong><small>{role.description}</small><span className="rf-perms">{role.permissions.map((permission) => <span key={permission}><Check aria-hidden="true" />{permission}</span>)}</span></span>
                  </label>)}</div>
                </fieldset>
              </section>
              <label className="rf-choice rf-choice--plain"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} required /><span><strong>I verified this recipient and role assignment.</strong><small>The invitation gives administrator access once they create a password.</small></span></label>
              <p className="rf-callout"><MailCheck aria-hidden="true" /><span><strong>What they receive:</strong> an email from the verified Quantum HRMS sender with one personal, time-limited button to accept the invitation and create a private password.</span></p>
            </div>
            <FormFooter icon={LockKeyhole} note="Only System Administrators can invite administrators.">
              <button type="button" className="button button-secondary" onClick={() => setShowInvite(false)} disabled={submitting}>Cancel</button>
              <button className="button button-primary" disabled={submitting || !form.confirmed}>{submitting ? 'Creating account & sending email…' : 'Create account & send invitation'}</button>
            </FormFooter>
          </form>
        </Modal>
      )}
    </div>
  )
}
