import { useState, type FormEvent } from 'react'
import { BadgeCheck, Building2, Check, Crown, KeyRound, LockKeyhole, MailCheck, Plus, ShieldCheck, UserCog, Users } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { Banner, Field, FormFooter, FormIntro, SectionTitle } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import { statusTone } from '../utils/format.js'
import type { AdminInviteInput } from '../types/hrms.js'

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
  const { data, user, inviteAdminAccount } = useHrms()
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  if (!data || !user) return null

  const accounts = data.employees.filter((employee) => employee.role !== 'employee')
  const activeAccounts = accounts.filter((account) => account.status === 'Active').length
  const representedRoles = new Set(accounts.map((account) => account.role)).size

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
      <SectionHeading eyebrow="Privileged identity management" title="Admin Accounts & Roles" description="Invite accountable administrators with least-privilege access and a personal password-setup link." actions={<button className="button button-primary" onClick={() => setShowInvite(true)}><Plus size={17} />Invite administrator</button>} />

      <Banner icon={ShieldCheck} tone="success" title="Administrator access is by invitation only" badge={<Badge tone="success">Server protected</Badge>}>Quantum HRMS creates the sign-in and the role together, then emails a personal, time-limited link to set a password. Administrators never create or send passwords.</Banner>

      <div className="stats-grid stats-grid-3">
        <StatCard icon={UserCog} label="Administrator accounts" value={accounts.length} detail="Supabase-linked identities" tone="blue" />
        <StatCard icon={BadgeCheck} label="Active privileged access" value={activeAccounts} detail="Active role profiles" tone="green" />
        <StatCard icon={Building2} label="Roles represented" value={representedRoles} detail={`Of ${Object.keys(adminRoles).length} available roles`} tone="purple" />
      </div>

      <section className="panel">
        <div className="panel-header"><div><h2>Role catalog</h2><p>Clear responsibilities help prevent unnecessary access.</p></div><Badge tone="info">Least privilege</Badge></div>
        <div className="admin-role-catalog">{Object.entries(adminRoles).map(([key, role]) => { const Icon = role.icon; return <article key={key}><span><Icon /></span><div><strong>{role.label}</strong><small>{role.short}</small><p>{role.description}</p></div></article> })}</div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><h2>Privileged account directory</h2><p>Profile and access-role changes synchronize from Supabase in real time.</p></div><Badge tone="success">Live</Badge></div>
        {accounts.length ? <TableShell><thead><tr><th>Administrator</th><th>Access role</th><th>Department</th><th>Status</th><th>Account ID</th></tr></thead><tbody>{accounts.map((account) => { const role = adminRoles[account.role as AdminRoleKey] || adminRoles.auditor; return <tr key={account.id}><td><div className="table-person"><span>{account.firstName[0]}{account.lastName[0]}</span><div><strong>{account.firstName} {account.lastName}</strong><small>{account.email}</small></div></div></td><td><Badge tone={role.tone}>{role.label}</Badge><small className="table-subtitle">{role.short}</small></td><td>{account.department}</td><td><Badge tone={statusTone(account.status)}>{account.status}</Badge></td><td><code>{account.id}</code></td></tr> })}</tbody></TableShell> : <EmptyState icon={UserCog} title="No administrator profiles" text="Invite the first role-scoped administrator." />}
      </section>

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
