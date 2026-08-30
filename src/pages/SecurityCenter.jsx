import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge, Modal, SectionHeading, StatCard } from '../components/ui.jsx'
import { useHrms } from '../state/useHrms.js'
import { statusTone } from '../utils/format.js'
import { downloadCsv } from '../utils/downloads.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePermanentPassword } from '../utils/passwordPolicy.js'

const severityTone = {
  Critical: 'danger',
  High: 'warning',
  Medium: 'info',
  Low: 'neutral',
}

export default function SecurityCenter({ employeeMode = false, readOnly = false }) {
  const {
    data, user, updateAlert, addSecurityAlert, respondToAlert, endSession, changePassword,
    refreshData, getMfaStatus, beginMfaEnrollment, verifyMfaEnrollment, disableMfa,
    recordActivity,
  } = useHrms()
  const [severity, setSeverity] = useState('All')
  const [status, setStatus] = useState('All')
  const [query, setQuery] = useState('')
  const [auditQuery, setAuditQuery] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [showCreateAlert, setShowCreateAlert] = useState(false)
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertForm, setAlertForm] = useState({
    employeeCode: '', severity: 'Medium', eventType: 'Unusual access', title: '',
    description: '', recommendedAction: '',
  })
  const [selectedSession, setSelectedSession] = useState(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [mfaStatus, setMfaStatus] = useState({ enabled: false, factorId: null, currentLevel: 'aal1' })
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrollment, setMfaEnrollment] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaSaving, setMfaSaving] = useState(false)
  const canManageAlerts = !employeeMode && !readOnly && ['admin', 'security_admin'].includes(user.role)

  useEffect(() => {
    let active = true
    getMfaStatus()
      .then((result) => { if (active) setMfaStatus(result) })
      .catch(() => { if (active) setMfaStatus({ enabled: false, factorId: null, currentLevel: 'aal1' }) })
      .finally(() => { if (active) setMfaLoading(false) })
    return () => { active = false }
  }, [getMfaStatus])

  const sourceAlerts = useMemo(() => (
    employeeMode
      ? data.securityAlerts.filter((alert) => alert.employeeId === user.id)
      : data.securityAlerts
  ), [data.securityAlerts, employeeMode, user.id])

  const alerts = useMemo(() => sourceAlerts.filter((alert) => {
      const matchesSeverity = severity === 'All' || alert.severity === severity
      const matchesStatus = status === 'All' || alert.status === status
      const haystack = `${alert.title} ${alert.description} ${alert.affected}`.toLowerCase()
      return matchesSeverity && matchesStatus && haystack.includes(query.toLowerCase())
    }), [query, severity, sourceAlerts, status])

  const sessions = employeeMode
    ? data.sessions.filter((session) => session.employeeId === user.id)
    : data.sessions

  const critical = sourceAlerts.filter((alert) => alert.severity === 'Critical' && alert.status !== 'Resolved').length
  const open = sourceAlerts.filter((alert) => ['New', 'Investigating'].includes(alert.status)).length
  const resolved = sourceAlerts.filter((alert) => alert.status === 'Resolved').length
  const otherSessions = sessions.filter((session) => !session.current).length
  const mfaAttention = mfaStatus.enabled ? 0 : 1
  const attentionItems = critical + open + otherSessions + mfaAttention
  const postureScore = Math.max(30, 100 - critical * 18 - open * 7 - otherSessions * 3 - mfaAttention * 10)
  const postureLabel = postureScore >= 85 ? 'Good' : postureScore >= 70 ? 'Review needed' : 'At risk'
  const auditEntries = data.auditLog.filter((entry) => `${entry.actor} ${entry.action} ${entry.target}`.toLowerCase().includes(auditQuery.toLowerCase()))

  const changeStatus = async (status) => {
    if (employeeMode) await respondToAlert(selectedAlert.id, status)
    else await updateAlert(selectedAlert.id, status)
    setSelectedAlert(null)
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    const policyError = validatePermanentPassword(passwordForm.newPassword, {
      currentPassword: passwordForm.currentPassword,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    })
    if (policyError) {
      setPasswordError(policyError)
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }

    try {
      await changePassword({
        userId: user.id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPasswordModal(false)
    } catch (reason) {
      setPasswordError(reason.message || 'The password could not be changed.')
    }
  }

  const submitAlert = async (event) => {
    event.preventDefault()
    setAlertSaving(true)
    try {
      await addSecurityAlert(alertForm)
      setShowCreateAlert(false)
      setAlertForm({ employeeCode: '', severity: 'Medium', eventType: 'Unusual access', title: '', description: '', recommendedAction: '' })
    } catch {
      // The shared toast keeps the modal open and presents the server message.
    } finally {
      setAlertSaving(false)
    }
  }

  const revokeSelectedSession = async () => {
    if (!selectedSession) return
    try {
      await endSession(selectedSession.id)
      setSelectedSession(null)
    } catch {
      // The shared toast presents the protected server response.
    }
  }

  const startMfaEnrollment = async () => {
    setMfaSaving(true)
    setMfaError('')
    try {
      setMfaEnrollment(await beginMfaEnrollment())
    } catch (reason) {
      setMfaError(reason.message || 'Authenticator setup could not be started.')
    } finally {
      setMfaSaving(false)
    }
  }

  const confirmMfaEnrollment = async (event) => {
    event.preventDefault()
    setMfaSaving(true)
    setMfaError('')
    try {
      const result = await verifyMfaEnrollment({ factorId: mfaEnrollment.factorId, code: mfaCode })
      setMfaStatus(result)
      setMfaEnrollment(null)
      setMfaCode('')
      await refreshData()
    } catch (reason) {
      setMfaError(reason.message || 'The authenticator code could not be verified.')
    } finally {
      setMfaSaving(false)
    }
  }

  const removeMfa = async () => {
    setMfaSaving(true)
    setMfaError('')
    try {
      const result = await disableMfa(mfaStatus.factorId)
      setMfaStatus(result)
      setMfaEnrollment(null)
      await refreshData()
    } catch (reason) {
      setMfaError(reason.message || 'MFA could not be disabled.')
    } finally {
      setMfaSaving(false)
    }
  }

  const exportAuditEvidence = async () => {
    downloadCsv('security-audit-evidence', [
      { label: 'Actor', key: 'actor' },
      { label: 'Action', key: 'action' },
      { label: 'Target', key: 'target' },
      { label: 'Displayed time', key: 'time' },
    ], auditEntries)
    try { await recordActivity({ action: 'Exported security audit evidence', target: `${auditEntries.length} authorized events` }) } catch { /* The download remains available. */ }
  }

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow={employeeMode ? 'Account protection' : 'Usable security operations'}
        title={employeeMode ? 'Account Security' : 'Security Center'}
        description={employeeMode
          ? 'Review activity connected to your account and remove sessions you do not recognize.'
          : 'Understand what happened, why it matters, and the safest next action.'}
        actions={<div className="section-action-row">{canManageAlerts && <button className="button button-primary" onClick={() => setShowCreateAlert(true)}><Plus size={17} />New security alert</button>}<button className="button button-secondary" onClick={refreshData}><RefreshCw size={17} />Refresh activity</button></div>}
      />

      <section className="security-posture">
        <div className="posture-score"><ShieldCheck size={34} /><div><span>Security posture</span><strong>{postureLabel}</strong><small>{postureScore} of 100 · {attentionItems} item{attentionItems === 1 ? '' : 's'} need attention</small></div></div>
        <progress className="posture-meter" value={postureScore} max="100">{postureScore}%</progress>
        <div className="posture-checks">
          <span><CheckCircle2 /> Role-scoped database access</span>
          <span className={!mfaStatus.enabled ? 'needs-attention' : ''}>{mfaStatus.enabled ? <CheckCircle2 /> : <AlertTriangle />} {mfaLoading ? 'Checking multi-factor authentication' : mfaStatus.enabled ? 'Authenticator MFA enabled' : 'Authenticator MFA needs setup'}</span>
          <span className={otherSessions ? 'needs-attention' : ''}>{otherSessions ? <AlertTriangle /> : <CheckCircle2 />} {otherSessions ? `Review ${otherSessions} other device${otherSessions === 1 ? '' : 's'}` : 'No other sessions detected'}</span>
        </div>
      </section>

      <div className="stats-grid stats-grid-4">
        <StatCard icon={AlertTriangle} label="Critical alerts" value={critical} detail="Needs immediate review" tone="red" />
        <StatCard icon={ShieldEllipsis} label="Open investigations" value={open} detail="Across all severities" tone="amber" />
        <StatCard icon={Users} label="Session activity" value={sessions.length} detail="Recognized device records" tone="blue" />
        <StatCard icon={CheckCircle2} label="Resolved alerts" value={resolved} detail="Recorded in the shared alert history" tone="green" />
      </div>

      <section className="panel">
        <div className="panel-header panel-header-wrap">
          <div><h2>{employeeMode ? 'Your recent security activity' : 'Prioritized alert inbox'}</h2><p>Color is supported by labels and icons for accessibility.</p></div>
          <div className="filter-row">
            <label className="compact-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search alerts" /></label>
            <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity">
              {['All', 'Critical', 'High', 'Medium', 'Low'].map((option) => <option key={option}>{option}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by alert status">
              {['All', 'New', 'Investigating', 'Acknowledged', 'Resolved'].map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
        <div className="alert-list">
          {alerts.map((alert) => (
            <article className={`security-alert severity-${alert.severity.toLowerCase()}`} key={alert.id}>
              <div className="alert-severity-icon">{alert.severity === 'Critical' ? <XCircle /> : alert.severity === 'High' ? <AlertTriangle /> : <ShieldEllipsis />}</div>
              <div className="alert-main">
                <div className="alert-labels"><Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge><Badge tone={statusTone(alert.status)}>{alert.status}</Badge><span>{alert.id}</span></div>
                <h3>{alert.title}</h3>
                <p>{alert.description}</p>
                <div className="alert-meta"><span><Users />{alert.affected}</span><span><Clock3 />{alert.time}</span></div>
              </div>
              <button className="button button-secondary" onClick={() => setSelectedAlert(alert)}><Eye size={17} />Review</button>
            </article>
          ))}
          {alerts.length === 0 && <div className="empty-state"><ShieldCheck /><strong>{sourceAlerts.length ? 'No matching alerts' : 'No security alerts recorded'}</strong><p>{sourceAlerts.length ? 'Try changing the search term, severity, or status filter.' : employeeMode ? 'New activity connected to your account will appear here.' : canManageAlerts ? 'Create a controlled alert to demonstrate the complete investigation workflow.' : 'New authorized security evidence will appear here.'}</p>{canManageAlerts && !sourceAlerts.length && <button className="button button-primary" onClick={() => setShowCreateAlert(true)}><Plus size={17} />Create first alert</button>}</div>}
        </div>
      </section>

      <div className="content-grid content-grid-2">
        <section className="panel">
          <div className="panel-header"><div><h2>{employeeMode ? 'Your session activity' : 'Recorded session activity'}</h2><p>{employeeMode ? 'Sign out every other Supabase session if a device is unfamiliar.' : 'Review the employee, device, location, and last activity before removing trust.'}</p></div>{employeeMode && otherSessions > 0 && <button className="button button-secondary danger-text" onClick={() => setSelectedSession(sessions.find((session) => !session.current))}><LogOut size={16} />Sign out other sessions</button>}</div>
          <div className="session-list">
            {sessions.map((session) => { const employee = data.employees.find((item) => item.id === session.employeeId); return (
              <article key={session.id} className={session.current ? 'current-session' : ''}>
                <div className="session-icon">{session.device.includes('iPhone') ? <Smartphone /> : <Laptop />}</div>
                <div><strong>{session.device}</strong><span>{employee ? `${employee.firstName} ${employee.lastName} · ${session.employeeId}` : session.employeeId}</span><span>{session.location} · {session.lastActive}</span></div>
                <div className="session-actions">{session.current ? <Badge tone="success">This device</Badge> : <Badge tone="neutral">Tracked device</Badge>}{!session.current && canManageAlerts && <button className="text-button danger-text" onClick={() => setSelectedSession(session)}>Remove trust</button>}</div>
              </article>
            )})}
            {!sessions.length && <div className="empty-state compact"><Laptop /><strong>No sessions recorded yet</strong><p>The current browser will appear after the next authenticated refresh or sign-in.</p></div>}
          </div>
        </section>

        <section className="panel security-settings">
          <div className="panel-header"><div><h2>Security controls</h2><p>Clear status and next steps.</p></div></div>
          <article><span className={`setting-icon ${mfaStatus.enabled ? 'success' : ''}`}><ShieldCheck /></span><div><strong>Multi-factor authentication</strong><p>{mfaStatus.enabled ? `Authenticator protection is enabled · session assurance ${mfaStatus.currentLevel.toUpperCase()}.` : 'Require a time-based code after the account password.'}</p></div><button className="button button-secondary" disabled={mfaLoading || mfaSaving} onClick={mfaStatus.enabled ? () => setMfaEnrollment({ manage: true }) : startMfaEnrollment}>{mfaLoading ? 'Checking…' : mfaStatus.enabled ? 'Manage MFA' : 'Set up MFA'}</button></article>
          <article><span className="setting-icon"><KeyRound /></span><div><strong>Account password</strong><p>Use a unique password and replace temporary credentials after first sign-in.</p></div><button className="button button-secondary" onClick={() => setShowPasswordModal(true)}>Change password</button></article>
          <article><span className="setting-icon success"><LockKeyhole /></span><div><strong>Session timeout</strong><p>Inactive {employeeMode ? 'employee' : 'administrator'} sessions end after {employeeMode ? '30' : '15'} minutes.</p></div><Badge tone="success">Active</Badge></article>
          <article><span className="setting-icon"><ShieldCheck /></span><div><strong>Database record separation</strong><p>Supabase RLS limits employee, payroll, request, document, and security rows by identity and role.</p></div><Badge tone="success">Active</Badge></article>
        </section>
      </div>

      {!employeeMode && (
        <section className="panel">
          <div className="panel-header panel-header-wrap"><div><h2>Recent sensitive activity</h2><p>Supabase-backed evidence for alert, account, session, and administrative actions.</p></div><div className="filter-row"><label className="compact-search"><Search size={16} /><input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Search audit evidence" /></label><button className="button button-secondary" onClick={exportAuditEvidence}><Download size={16} />Export CSV</button></div></div>
          <div className="audit-list">
            {auditEntries.map((entry) => <article key={entry.id}><span>{entry.actor.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span><div><strong>{entry.actor}</strong><p>{entry.action} · {entry.target}</p></div><time>{entry.time}</time></article>)}
            {!auditEntries.length && <div className="empty-state compact"><Search /><strong>No matching audit evidence</strong><p>Try a different actor, action, or target.</p></div>}
          </div>
        </section>
      )}

      {showCreateAlert && canManageAlerts && (
        <Modal title="Create security alert" onClose={() => !alertSaving && setShowCreateAlert(false)} size="wide">
          <form className="security-alert-form" onSubmit={submitAlert} aria-busy={alertSaving}>
            <div className="security-form-intro"><ShieldEllipsis /><div><strong>Document a reviewable security event</strong><p>The alert is stored in Supabase, appears in the employee’s Account Security page, and creates administrator audit evidence.</p></div></div>
            <div className="form-grid">
              <label>Affected employee<select value={alertForm.employeeCode} onChange={(event) => setAlertForm({ ...alertForm, employeeCode: event.target.value })} required><option value="">Select employee account</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.id}</option>)}</select></label>
              <label>Severity<select value={alertForm.severity} onChange={(event) => setAlertForm({ ...alertForm, severity: event.target.value })}>{['Critical', 'High', 'Medium', 'Low'].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label>Event type<select value={alertForm.eventType} onChange={(event) => setAlertForm({ ...alertForm, eventType: event.target.value })}>{['Unusual access', 'Repeated sign-in failure', 'New device', 'Sensitive record access', 'Privilege change', 'Policy violation'].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label>Alert title<input minLength="4" maxLength="140" value={alertForm.title} onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })} placeholder="Example: New browser sign-in requires review" required /></label>
              <label className="span-2">What happened<textarea rows="4" minLength="10" maxLength="1200" value={alertForm.description} onChange={(event) => setAlertForm({ ...alertForm, description: event.target.value })} placeholder="Explain the observed activity in plain language without exposing passwords or tokens." required /></label>
              <label className="span-2">Recommended safe action<textarea rows="3" minLength="10" maxLength="800" value={alertForm.recommendedAction} onChange={(event) => setAlertForm({ ...alertForm, recommendedAction: event.target.value })} placeholder="Example: Confirm the device with the employee, review session activity, and change the password if it is unfamiliar." required /></label>
            </div>
            <div className="security-form-assurance"><ShieldCheck /><span>Administrator-only · server validated · RLS visible · realtime synchronized · audit recorded</span></div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreateAlert(false)} disabled={alertSaving}>Cancel</button><button className="button button-primary" disabled={alertSaving}>{alertSaving ? 'Creating secure alert…' : 'Create alert'}</button></div>
          </form>
        </Modal>
      )}

      {selectedSession && (
        <Modal title={employeeMode ? 'Sign out other sessions' : 'Remove trusted session'} onClose={() => setSelectedSession(null)}>
          <div className="session-review">
            <span><LogOut /></span>
            <div><h3>{employeeMode ? 'End every other signed-in session?' : 'Remove this device from trusted activity?'}</h3><p>{employeeMode ? 'Supabase will revoke your other refresh sessions and remove their tracked device records. This browser remains signed in.' : 'This removes the session record and writes an audit event. If compromise is suspected, also investigate the alert and deactivate the employee account through secure offboarding.'}</p></div>
            {!employeeMode && <dl><div><dt>Employee</dt><dd>{data.employees.find((item) => item.id === selectedSession.employeeId)?.firstName} {data.employees.find((item) => item.id === selectedSession.employeeId)?.lastName} · {selectedSession.employeeId}</dd></div><div><dt>Device</dt><dd>{selectedSession.device}</dd></div><div><dt>Location</dt><dd>{selectedSession.location}</dd></div></dl>}
            <div className="modal-actions"><button className="button button-secondary" onClick={() => setSelectedSession(null)}>Cancel</button><button className="button button-primary danger-button" onClick={revokeSelectedSession}>{employeeMode ? 'Sign out other sessions' : 'Remove trust & audit'}</button></div>
          </div>
        </Modal>
      )}

      {mfaEnrollment && (
        <Modal title={mfaEnrollment.manage ? 'Manage multi-factor authentication' : 'Set up authenticator MFA'} onClose={() => { setMfaEnrollment(null); setMfaCode(''); setMfaError('') }}>
          {mfaEnrollment.manage ? (
            <div className="mfa-manage">
              <span><ShieldCheck /></span><div><Badge tone="success">Enabled</Badge><h3>Authenticator protection is active</h3><p>Future sign-ins require the account password and a current 6-digit code. The active session assurance level is <strong>{mfaStatus.currentLevel.toUpperCase()}</strong>.</p></div>
              {mfaError && <p className="form-error" role="alert">{mfaError}</p>}
              <div className="modal-actions"><button className="button button-secondary" onClick={() => setMfaEnrollment(null)}>Done</button><button className="button button-secondary danger-text" disabled={mfaSaving} onClick={removeMfa}>{mfaSaving ? 'Disabling…' : 'Disable MFA'}</button></div>
            </div>
          ) : (
            <form className="mfa-enrollment" onSubmit={confirmMfaEnrollment} aria-busy={mfaSaving}>
              <div className="mfa-steps"><span>1</span><div><h3>Scan with an authenticator app</h3><p>Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.</p></div></div>
              <div className="mfa-qr"><img src={mfaEnrollment.qrCode} alt="Authenticator enrollment QR code" /><div><small>Manual setup key</small><code>{mfaEnrollment.secret}</code><p>Keep this setup key private. Never include it in screenshots or messages.</p></div></div>
              <div className="mfa-steps"><span>2</span><div><h3>Verify the current code</h3><p>Enter the 6-digit number shown by the authenticator app.</p></div></div>
              <label>Authenticator code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required /></label>
              {mfaError && <p className="form-error" role="alert">{mfaError}</p>}
              <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setMfaEnrollment(null)} disabled={mfaSaving}>Cancel</button><button className="button button-primary" disabled={mfaSaving || mfaCode.length !== 6}>{mfaSaving ? 'Verifying…' : 'Enable MFA'}</button></div>
            </form>
          )}
        </Modal>
      )}

      {selectedAlert && (
        <Modal title={`Review ${selectedAlert.id}`} onClose={() => setSelectedAlert(null)}>
          <div className="alert-detail">
            <div className="alert-detail-banner"><AlertTriangle /><div><Badge tone={severityTone[selectedAlert.severity]}>{selectedAlert.severity}</Badge><h3>{selectedAlert.title}</h3></div></div>
            <dl>
              <div><dt>What happened</dt><dd>{selectedAlert.description}</dd></div>
              <div><dt>Account or record</dt><dd>{selectedAlert.affected}</dd></div>
              <div><dt>When</dt><dd>{selectedAlert.time}</dd></div>
              <div><dt>Why this matters</dt><dd>Unexpected activity may indicate that an account or sensitive record was accessed without authorization.</dd></div>
              <div className="recommended"><dt>Recommended action</dt><dd>{selectedAlert.recommendedAction}</dd></div>
            </dl>
            <div className="modal-actions">
              {(employeeMode || canManageAlerts) && <button className="button button-secondary" onClick={() => changeStatus('Acknowledged')}>{employeeMode ? 'I recognize this' : 'Mark authorized'}</button>}
              {(employeeMode || canManageAlerts) && <button className="button button-secondary" onClick={() => changeStatus('Investigating')}>{employeeMode ? 'Report as unfamiliar' : 'Investigate'}</button>}
              {canManageAlerts && <button className="button button-primary" onClick={() => changeStatus('Resolved')}>Resolve alert</button>}
              {readOnly && <button className="button button-primary" onClick={() => setSelectedAlert(null)}>Close review</button>}
            </div>
          </div>
        </Modal>
      )}

      {showPasswordModal && (
        <Modal title="Change password" onClose={() => { setShowPasswordModal(false); setPasswordError('') }}>
          <form className="form-grid" onSubmit={submitPassword}>
            <label className="span-2">Current password<input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></label>
            <label className="span-2">New password<input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /><small className="form-note">Use a unique passphrase of at least {PASSWORD_MIN_LENGTH} characters. Spaces and symbols are allowed.</small></label>
            <label className="span-2">Confirm new password<input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></label>
            {passwordError && <p className="form-error span-2" role="alert">{passwordError}</p>}
            <div className="modal-actions span-2"><button className="button button-secondary" type="button" onClick={() => setShowPasswordModal(false)}>Cancel</button><button className="button button-primary" type="submit">Update password</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
}
