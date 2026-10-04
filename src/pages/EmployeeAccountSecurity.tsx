import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock3, Eye, EyeOff, KeyRound, Laptop, LockKeyhole, LogOut, RefreshCw, ShieldCheck, ShieldQuestion, Smartphone, UserCheck } from 'lucide-react'
import { Badge, Modal, SectionHeading, StatCard } from '../components/ui.js'
import { Banner } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  validatePermanentPassword,
} from '../utils/passwordPolicy.js'
import { statusTone } from '../utils/format.js'
import type { MfaEnrollment, MfaStatus, SecurityAlertSummary, SessionRecord } from '../types/hrms.js'

const severityTone: Record<string, string> = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral' }
const tabs = ['Overview', 'My alerts', 'My sessions', 'Security history']
const when = (value?: string) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Not recorded'
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback
type EnrollmentState = ({ manage: true } | (MfaEnrollment & { manage?: false })) | null

export default function EmployeeAccountSecurity() {
  const {
    data: snapshot, user: identity, refreshData, respondToAlert, endSession, changePassword,
    getMfaStatus, beginMfaEnrollment, verifyMfaEnrollment, disableMfa,
  } = useHrms()
  const data = snapshot!
  const user = identity!
  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlertSummary | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null)
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({ enabled: false, currentLevel: 'aal1', factorId: null })
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrollment, setMfaEnrollment] = useState<EnrollmentState>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaSaving, setMfaSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordValues, setShowPasswordValues] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    let current = true
    getMfaStatus().then((result) => current && setMfaStatus(result))
      .catch(() => current && setMfaError('MFA coverage could not be verified. Refresh before changing security settings.'))
      .finally(() => current && setMfaLoading(false))
    return () => { current = false }
  }, [getMfaStatus])

  const alerts = useMemo(() => data.securityAlerts.filter((alert) => alert.employeeId === user.id), [data.securityAlerts, user.id])
  const sessions = useMemo(() => data.sessions.filter((session) => session.employeeId === user.id), [data.sessions, user.id])
  const responses = useMemo(() => data.alertResponses.filter((response) => response.actorId === user.id), [data.alertResponses, user.id])
  const openAlerts = alerts.filter((alert) => !['Resolved', 'False Positive'].includes(alert.status))
  const unfamiliar = sessions.filter((session) => !session.current && Boolean(session.authSessionId) && session.trustStatus !== 'Revoked')
  const protectionStatus = mfaError ? 'Coverage unverified' : openAlerts.some((alert) => ['Critical', 'High'].includes(alert.severity))
    ? 'At risk'
    : !mfaStatus.enabled || openAlerts.length || unfamiliar.length
      ? 'Review needed'
      : 'Protected'
  const protectionTone = protectionStatus === 'Protected' ? 'success' : protectionStatus === 'At risk' ? 'danger' : 'warning'
  const passwordContext = useMemo(() => ({
    currentPassword: passwordForm.currentPassword,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  }), [passwordForm.currentPassword, user.email, user.firstName, user.lastName])
  const passwordRules = passwordChecks(passwordForm.newPassword, passwordContext)
  const passwordRating = passwordStrength(passwordForm.newPassword, passwordContext)
  const passwordsMatch = Boolean(passwordForm.confirmPassword) && passwordForm.newPassword === passwordForm.confirmPassword
  const hasNewPassword = passwordForm.newPassword.length > 0
  const passwordReady = Boolean(passwordForm.currentPassword)
    && Object.values(passwordRules).every(Boolean)
    && passwordsMatch

  const closePasswordDialog = () => {
    if (passwordSaving) return
    setShowPassword(false)
    setShowPasswordValues(false)
    setPasswordError('')
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }

  const beginMfa = async () => {
    setMfaSaving(true); setMfaError('')
    try { setMfaEnrollment(await beginMfaEnrollment()) } catch (error) { setMfaError(errorMessage(error, 'Authenticator setup could not be started.')) } finally { setMfaSaving(false) }
  }
  const confirmMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMfaSaving(true); setMfaError('')
    if (!mfaEnrollment || 'manage' in mfaEnrollment) return setMfaSaving(false)
    try {
      setMfaStatus(await verifyMfaEnrollment({ factorId: mfaEnrollment.factorId, code: mfaCode }))
      setMfaEnrollment(null); setMfaCode(''); await refreshData()
    } catch (error) { setMfaError(errorMessage(error, 'The authenticator code could not be verified.')) } finally { setMfaSaving(false) }
  }
  const removeMfa = async () => {
    setMfaSaving(true); setMfaError('')
    try { setMfaStatus(await disableMfa(mfaStatus.factorId)); setMfaEnrollment(null); await refreshData() }
    catch (error) { setMfaError(errorMessage(error, 'MFA could not be disabled.')) } finally { setMfaSaving(false) }
  }
  const answerAlert = async (action: string) => {
    if (!selectedAlert) return
    await respondToAlert(selectedAlert.id, action)
    setSelectedAlert(null)
  }
  const revokeOthers = async () => {
    if (!selectedSession) return
    await endSession('all-other-sessions')
    setSelectedSession(null)
  }
  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPasswordError('')
    const problem = validatePermanentPassword(passwordForm.newPassword, passwordContext)
    if (problem) return setPasswordError(problem)
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setPasswordError('The new passwords do not match.')
    setPasswordSaving(true)
    try {
      await changePassword(passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setShowPassword(false); setShowPasswordValues(false)
    } catch (error) { setPasswordError(errorMessage(error, 'The password could not be changed.')) }
    finally { setPasswordSaving(false) }
  }

  const timeline = useMemo(() => [
    ...alerts.map((item) => ({ id: `a-${item.id}`, at: item.createdAt, icon: AlertTriangle, title: item.title, detail: `${item.severity} alert · ${item.status}` })),
    ...responses.map((item) => ({ id: `r-${item.id}`, at: item.createdAt, icon: UserCheck, title: item.action, detail: `Response to ${item.alertId}` })),
    ...sessions.map((item) => ({ id: `s-${item.id}`, at: item.createdAt ?? item.lastSeenAt ?? '', icon: Laptop, title: item.current ? 'Current browser session' : 'Browser session recorded', detail: `${item.device} · ${item.location}` })),
  ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()), [alerts, responses, sessions])

  return <div className="page-stack account-security-page">
    <SectionHeading eyebrow="Your private account protection" title="Account Security" description="Protect your own sign-in, review personal security activity, and remove devices you do not recognize." actions={<button className="button button-secondary" onClick={refreshData}><RefreshCw size={17} />Refresh my activity</button>} />

    <Banner icon={ShieldCheck} tone={protectionTone} label="Your account status" title={protectionStatus} badge={<Badge tone={protectionTone}>{mfaStatus.currentLevel.toUpperCase()} session</Badge>}>{protectionStatus === 'Protected' ? 'Your account has MFA turned on and nothing needs your review.' : `${openAlerts.length} alert${openAlerts.length === 1 ? '' : 's'} and ${unfamiliar.length} other session${unfamiliar.length === 1 ? '' : 's'} may need your attention.`}</Banner>

    <nav className="security-tabs" aria-label="Account security sections">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>

    {activeTab === 'Overview' && <>
      <div className="stats-grid stats-grid-4">
        <StatCard icon={ShieldCheck} label="Authenticator MFA" value={mfaLoading ? 'Checking' : mfaError ? 'Unverified' : mfaStatus.enabled ? 'Enabled' : 'Not enabled'} detail="Personal second-factor protection" tone={mfaStatus.enabled ? 'green' : 'amber'} />
        <StatCard icon={AlertTriangle} label="Alerts to review" value={openAlerts.length} detail="Only activity connected to you" tone={openAlerts.length ? 'amber' : 'green'} />
        <StatCard icon={Laptop} label="Recorded sessions" value={sessions.length} detail={`${unfamiliar.length} other browser${unfamiliar.length === 1 ? '' : 's'}`} tone="blue" />
        <StatCard icon={UserCheck} label="Responses recorded" value={responses.length} detail="Your security decisions" tone="purple" />
      </div>
      <div className="content-grid content-grid-2">
        <section className="panel personal-security-controls"><div className="panel-header"><div><h2>Your security controls</h2><p>Only you can configure these controls for your account.</p></div></div>
          <article><span className={mfaStatus.enabled ? 'secure' : 'attention'}><ShieldCheck /></span><div><strong>Authenticator MFA</strong><p>{mfaStatus.enabled ? `Enabled · current assurance ${mfaStatus.currentLevel.toUpperCase()}` : 'Add a six-digit authenticator code after your password.'}</p></div><button className="button button-secondary" disabled={mfaLoading || mfaSaving} onClick={mfaStatus.enabled ? () => setMfaEnrollment({ manage: true }) : beginMfa}>{mfaLoading ? 'Checking…' : mfaStatus.enabled ? 'Manage MFA' : 'Set up MFA'}</button></article>
          <article><span><KeyRound /></span><div><strong>Private password</strong><p>Use a long, unique passphrase that you do not use elsewhere.</p></div><button className="button button-secondary" onClick={() => setShowPassword(true)}>Change password</button></article>
          <article><span className="secure"><LockKeyhole /></span><div><strong>Automatic timeout</strong><p>Inactive {user.portal === 'admin' ? 'administrator' : 'employee'} sessions close after {user.portal === 'admin' ? 15 : 30} minutes.</p></div><Badge tone="success">Active</Badge></article>
        </section>
        <section className="panel"><div className="panel-header"><div><h2>What needs attention</h2><p>Complete the safest next action first.</p></div></div><div className="security-next-actions">
          {!mfaStatus.enabled && !mfaError && <button onClick={beginMfa}><ShieldQuestion /><div><strong>Enable authenticator MFA</strong><span>Recommended protection against stolen passwords</span></div></button>}
          {openAlerts.slice(0, 3).map((alert) => <button key={alert.id} onClick={() => setSelectedAlert(alert)}><AlertTriangle /><div><strong>{alert.title}</strong><span>{alert.recommendedAction}</span></div></button>)}
          {unfamiliar.length > 0 && <button onClick={() => setSelectedSession(unfamiliar[0])}><LogOut /><div><strong>Review other browser sessions</strong><span>End access on devices you no longer recognize</span></div></button>}
          {!mfaError && mfaStatus.enabled && !openAlerts.length && !unfamiliar.length && <div className="security-all-clear"><CheckCircle2 /><strong>No action needed</strong><p>New security activity will appear here.</p></div>}
        </div></section>
      </div>
    </>}

    {activeTab === 'My alerts' && <section className="panel"><div className="panel-header"><div><h2>Security activity involving your account</h2><p>Every alert explains what happened, why it matters, and what you can do.</p></div></div><div className="alert-list">{alerts.map((alert) => <article className={`security-alert severity-${alert.severity.toLowerCase()}`} key={alert.id}><div className="alert-severity-icon"><AlertTriangle /></div><div className="alert-main"><div className="alert-labels"><Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge><Badge tone={statusTone(alert.status)}>{alert.status}</Badge><span>{alert.id}</span></div><h3>{alert.title}</h3><p>{alert.description}</p><div className="alert-meta"><span><Clock3 />{alert.time}</span></div></div><button className="button button-secondary" onClick={() => setSelectedAlert(alert)}><Eye size={16} />Review</button></article>)}{!alerts.length && <div className="security-all-clear roomy"><CheckCircle2 /><strong>No security alerts</strong><p>Only activity connected to your own account will appear here.</p></div>}</div></section>}

    {activeTab === 'My sessions' && <section className="panel"><div className="panel-header"><div><h2>Your recorded browsers</h2><p>Device and region labels are browser-reported, not verified locations.</p></div>{unfamiliar.length > 0 && <button className="button button-secondary danger-text" onClick={() => setSelectedSession(unfamiliar[0])}><LogOut size={16} />End other sessions</button>}</div><div className="session-list">{sessions.map((session) => <article className={session.current ? 'current-session' : ''} key={session.id}><div className="session-icon">{session.device.includes('iPhone') ? <Smartphone /> : <Laptop />}</div><div><strong>{session.device}</strong><span>{session.location}</span><span>First recorded {when(session.createdAt)} · {session.assuranceLevel.toUpperCase()}</span></div><div className="session-actions"><Badge tone={session.current ? 'success' : 'neutral'}>{session.current ? 'This browser' : session.authSessionId ? session.trustStatus : 'Historical observation'}</Badge></div></article>)}</div></section>}

    {activeTab === 'Security history' && <section className="panel"><div className="panel-header"><div><h2>Your security history</h2><p>A personal timeline assembled from your alerts, responses, and sessions.</p></div></div><div className="personal-security-timeline">{timeline.map(({ id, at, icon: Icon, title, detail }) => <article key={id}><span><Icon /></span><div><strong>{title}</strong><p>{detail}</p></div><time>{when(at)}</time></article>)}</div></section>}

    {selectedAlert && <Modal title={`Review ${selectedAlert.id}`} onClose={() => setSelectedAlert(null)}><div className="alert-detail"><div className="alert-detail-banner"><AlertTriangle /><div><Badge tone={severityTone[selectedAlert.severity]}>{selectedAlert.severity}</Badge><h3>{selectedAlert.title}</h3></div></div><dl><div><dt>What happened</dt><dd>{selectedAlert.description}</dd></div><div><dt>When</dt><dd>{selectedAlert.time}</dd></div><div><dt>Why this matters</dt><dd>{selectedAlert.whyItMatters}</dd></div><div className="recommended"><dt>Recommended action</dt><dd>{selectedAlert.recommendedAction}</dd></div></dl><div className="modal-actions"><button className="button button-secondary" onClick={() => answerAlert('This was me')}>This was me</button><button className="button button-primary danger-button" onClick={() => answerAlert('This was not me')}>This was not me</button></div></div></Modal>}

    {selectedSession && <Modal title="End other sessions" onClose={() => setSelectedSession(null)}><div className="session-review"><span><LogOut /></span><div><h3>Sign out every other browser?</h3><p>This browser remains signed in. Supabase will revoke your other refresh sessions and the HRMS will record your security action.</p></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setSelectedSession(null)}>Cancel</button><button className="button button-primary danger-button" onClick={revokeOthers}>End other sessions</button></div></div></Modal>}

    {mfaEnrollment && <Modal title={mfaEnrollment.manage ? 'Manage your MFA' : 'Set up authenticator MFA'} onClose={() => { setMfaEnrollment(null); setMfaCode(''); setMfaError('') }}>{mfaEnrollment.manage ? <div className="mfa-manage"><span><ShieldCheck /></span><div><Badge tone="success">Enabled</Badge><h3>Your authenticator is protecting this account</h3><p>Future sign-ins require your password and a current six-digit code. Administrators cannot see your secret or codes.</p></div>{mfaError && <p className="form-error" role="alert">{mfaError}</p>}<div className="modal-actions"><button className="button button-secondary" onClick={() => setMfaEnrollment(null)}>Done</button><button className="button button-secondary danger-text" disabled={mfaSaving} onClick={removeMfa}>{mfaSaving ? 'Disabling…' : 'Disable MFA'}</button></div></div> : <form className="mfa-enrollment" onSubmit={confirmMfa}><div className="mfa-steps"><span>1</span><div><h3>Scan with your authenticator app</h3><p>Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.</p></div></div><div className="mfa-qr"><img src={mfaEnrollment.qrCode} alt="Private authenticator enrollment QR code" /><div><small>Manual setup key</small><code>{mfaEnrollment.secret}</code><p>Keep this secret private. Never send it to an administrator or include it in screenshots.</p></div></div><div className="mfa-steps"><span>2</span><div><h3>Verify your six-digit code</h3><p>Enter the current code from your authenticator app.</p></div></div><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required /></label>{mfaError && <p className="form-error">{mfaError}</p>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setMfaEnrollment(null)}>Cancel</button><button className="button button-primary" disabled={mfaSaving || mfaCode.length !== 6}>{mfaSaving ? 'Verifying…' : 'Enable my MFA'}</button></div></form>}</Modal>}

    {showPassword && <Modal title="Change your password" size="large" onClose={closePasswordDialog}>
      <form className="rf-form rf-form--md" onSubmit={submitPassword} aria-busy={passwordSaving}>
        <div className="rf-intro">
          <p>Enter your current password, then choose a new one. We check your current password before saving the change, and your password is never stored in your employee record.</p>
        </div>

        <div className="rf-layout">
          <div className="rf-fields">
            <div className="rf-grid rf-grid--single">
              <label className="rf-field">
                <span className="rf-label">Current password</span>
                <input aria-label="Current password" type={showPasswordValues ? 'text' : 'password'} autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} placeholder="Enter your current password" required />
              </label>
              <label className="rf-field">
                <span className="rf-label">New password</span>
                <input aria-label="New password" type={showPasswordValues ? 'text' : 'password'} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} placeholder="Use a long, unique passphrase" required />
              </label>
              <label className="rf-field">
                <span className="rf-label">Confirm new password</span>
                <input aria-label="Confirm new password" className={passwordForm.confirmPassword ? passwordsMatch ? 'is-valid' : 'is-invalid' : ''} type={showPasswordValues ? 'text' : 'password'} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} placeholder="Enter the new password again" required />
                {passwordForm.confirmPassword && <span className={`rf-match ${passwordsMatch ? 'is-match' : 'is-mismatch'}`}>{passwordsMatch ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}{passwordsMatch ? 'Passwords match.' : 'The passwords do not match yet.'}</span>}
              </label>
            </div>
            <button className="rf-toggle" type="button" aria-pressed={showPasswordValues} onClick={() => setShowPasswordValues((visible) => !visible)}>{showPasswordValues ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{showPasswordValues ? 'Hide passwords' : 'Show passwords'}</button>
            {passwordError && <p className="rf-error" role="alert">{passwordError}</p>}
          </div>

          <aside className="rf-summary" aria-label="New password security guidance">
            <h3>Password requirements</h3>
            <div className="rf-strength">
              <div className="rf-strength-head"><span>Strength</span><strong>{passwordRating.label}</strong></div>
              <div className={`rf-meter strength-${passwordRating.score}`} role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={passwordRating.score} aria-valuetext={passwordRating.label}><i /><i /><i /><i /></div>
            </div>
            <ul className="rf-checklist">
              {[
                [hasNewPassword && passwordRules.length && passwordRules.maximum, `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters (longer is better)`],
                [hasNewPassword && passwordRules.notCurrent, 'Different from your current password'],
                [hasNewPassword && passwordRules.notCommon, 'Not a common or easy-to-guess password'],
                [hasNewPassword && passwordRules.notPersonal, 'Does not include your name, email username, or “Quantum HRMS”'],
                [passwordsMatch, 'Both new password entries match'],
              ].map(([met, text]) => <li className={met ? 'is-met' : ''} key={String(text)}>{met ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><span className="sr-only">{met ? 'Met: ' : 'Not met yet: '}</span>{text}</span></li>)}
            </ul>
            <p className="rf-note"><LockKeyhole aria-hidden="true" /><span>Tip: a password manager or a multi-word passphrase works well. Never reuse this password or share it by email or chat.</span></p>
          </aside>
        </div>

        <footer className="rf-footer">
          <p><ShieldCheck aria-hidden="true" /><span>This change is recorded in your security history.</span></p>
          <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closePasswordDialog} disabled={passwordSaving}>Cancel</button><button className="button button-primary" disabled={!passwordReady || passwordSaving}>{passwordSaving ? 'Updating…' : 'Update my password'}</button></div>
        </footer>
      </form>
    </Modal>}
  </div>
}
