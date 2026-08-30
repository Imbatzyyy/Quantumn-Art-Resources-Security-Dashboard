import { useState } from 'react'
import {
  BadgeCheck,
  Building2,
  Check,
  Crown,
  KeyRound,
  LockKeyhole,
  Mail,
  MailCheck,
  Phone,
  Plus,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.tsx'
import { useHrms } from '../state/useHrms.js'
import { statusTone } from '../utils/format.js'

const adminRoles = {
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

const emptyForm = { firstName: '', lastName: '', email: '', phone: '', role: 'hr_admin', confirmed: false }

export default function AdminAccounts() {
  const { data, user, inviteAdminAccount } = useHrms()
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const accounts = data.employees.filter((employee) => employee.role !== 'employee')
  const activeAccounts = accounts.filter((account) => account.status === 'Active').length
  const representedRoles = new Set(accounts.map((account) => account.role)).size

  const submit = async (event) => {
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

      <section className="admin-access-banner">
        <span><ShieldCheck /></span><div><strong>Privileged access is invitation-only</strong><p>Quantum HRMS creates the Supabase identity and role profile together, then Resend delivers a time-limited password-setup link. Passwords are never generated or emailed by the administrator.</p></div><Badge tone="success">Server protected</Badge>
      </section>

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
        {accounts.length ? <TableShell><thead><tr><th>Administrator</th><th>Access role</th><th>Department</th><th>Status</th><th>Account ID</th></tr></thead><tbody>{accounts.map((account) => { const role = adminRoles[account.role] || adminRoles.auditor; return <tr key={account.id}><td><div className="table-person"><span>{account.firstName[0]}{account.lastName[0]}</span><div><strong>{account.firstName} {account.lastName}</strong><small>{account.email}</small></div></div></td><td><Badge tone={role.tone}>{role.label}</Badge><small className="table-subtitle">{role.short}</small></td><td>{account.department}</td><td><Badge tone={statusTone(account.status)}>{account.status}</Badge></td><td><code>{account.id}</code></td></tr> })}</tbody></TableShell> : <EmptyState icon={UserCog} title="No administrator profiles" text="Invite the first role-scoped administrator." />}
      </section>

      {showInvite && (
        <Modal title="Invite administrator account" onClose={() => !submitting && setShowInvite(false)} size="large">
          <div className="admin-invite-modal-shell">
            <div className="admin-invite-modal-intro"><span><MailCheck /></span><div><strong>Secure administrator invitation</strong><p>Create a role-scoped Supabase account and deliver a personal password-setup link through the verified Quantum HRMS email domain.</p></div><Badge tone="success">No emailed password</Badge></div>
            <form className="admin-account-form" onSubmit={submit} aria-busy={submitting}>
              <section className="admin-identity-section">
                <div className="employee-form-heading"><UserCog /><div><h3>Administrator identity</h3><p>Use the recipient’s verified organizational identity and work contact details.</p></div></div>
                <div className="admin-identity-grid">
                  <label className="admin-field-card">
                    <span className="admin-field-icon"><UserRound /></span>
                    <span className="admin-field-copy"><strong>First name</strong><small>Legal or preferred given name</small></span>
                    <span className="admin-field-state">Required</span>
                    <span className="admin-field-control"><input maxLength="80" autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="Enter first name" required /></span>
                  </label>
                  <label className="admin-field-card">
                    <span className="admin-field-icon"><UserRound /></span>
                    <span className="admin-field-copy"><strong>Last name</strong><small>Official family or surname</small></span>
                    <span className="admin-field-state">Required</span>
                    <span className="admin-field-control"><input maxLength="80" autoComplete="family-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Enter last name" required /></span>
                  </label>
                  <label className="admin-field-card">
                    <span className="admin-field-icon email"><Mail /></span>
                    <span className="admin-field-copy"><strong>Work email</strong><small>Invitation and sign-in address</small></span>
                    <span className="admin-field-state">Required</span>
                    <span className="admin-field-control"><input type="email" maxLength="254" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@company.com" required /></span>
                  </label>
                  <label className="admin-field-card">
                    <span className="admin-field-icon phone"><Phone /></span>
                    <span className="admin-field-copy"><strong>Mobile number</strong><small>Account recovery contact</small></span>
                    <span className="admin-field-state optional">Optional</span>
                    <span className="admin-field-control"><input type="tel" minLength="7" maxLength="30" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+63 912 345 6789" /></span>
                  </label>
                </div>
              </section>
              <section><div className="employee-form-heading"><ShieldCheck /><div><h3>Access role</h3><p>Select the smallest role that supports the administrator’s actual responsibilities.</p></div></div><div className="admin-role-selector">{Object.entries(adminRoles).map(([key, role]) => { const Icon = role.icon; return <label className={form.role === key ? 'selected' : ''} key={key}><input type="radio" name="admin-role" value={key} checked={form.role === key} onChange={(event) => setForm({ ...form, role: event.target.value })} /><span><Icon /></span><div><strong>{role.label}</strong><small>{role.description}</small><ul>{role.permissions.map((permission) => <li key={permission}><Check />{permission}</li>)}</ul></div></label> })}</div></section>
              <label className="privileged-confirmation"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} required /><span><strong>I verified this recipient and role assignment.</strong><small>The invitation grants privileged HRMS access after the recipient creates a password.</small></span></label>
              <div className="admin-invite-delivery"><MailCheck /><div><strong>What the recipient receives</strong><p>A branded email from the verified Quantum HRMS sender with one personal, time-limited button to accept the invitation and create a private password.</p></div></div>
              <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowInvite(false)} disabled={submitting}>Cancel</button><button className="button button-primary" disabled={submitting || !form.confirmed}>{submitting ? 'Creating account & sending email…' : 'Create account & send invitation'}</button></div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
