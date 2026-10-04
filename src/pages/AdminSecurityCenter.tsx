import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, Eye, FileJson, FileSearch, Filter, Fingerprint, Gauge, Globe2, Laptop, LockKeyhole, RefreshCw, Search, ShieldAlert, ShieldCheck, ShieldEllipsis, Upload, Users, XCircle } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard } from '../components/ui.js'
import { Banner, Field, FormFooter, FormIntro, SectionTitle } from '../components/readable.js'
import { useHrms } from '../state/useHrms.js'
import { downloadCsv } from '../utils/downloads.js'
import { statusTone } from '../utils/format.js'
import type {
  OrganizationSecuritySummary,
  SecurityAlertInput,
  SecurityAlertSummary,
  SecurityInvestigationInput,
  SessionRecord,
  ZapFinding,
  ZapImportInput,
} from '../types/hrms.js'

const tabs = ['Overview', 'Alerts', 'Sessions', 'Audit trail', 'Vulnerability testing', 'Security controls']
const severityTone: Record<string, string> = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'neutral' }
const riskTone: Record<string, string> = { High: 'danger', Medium: 'warning', Low: 'info', Informational: 'neutral' }
const openStatuses = ['New', 'Acknowledged', 'Investigating', 'Confirmed', 'Contained']
const alertPageSize = 5
const auditPageSize = 6
const when = (value?: string) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Not recorded'
const pageWindow = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  const start = Math.max(1, Math.min(current - 2, total - 4))
  return Array.from({ length: 5 }, (_, index) => start + index)
}

export default function AdminSecurityCenter({ readOnly = false, initialFilter = 'Overview' }: { readOnly?: boolean; initialFilter?: string }) {
  const {
    data: snapshot, user: identity, refreshData, addSecurityAlert, updateSecurityInvestigation,
    endSession, importZapReport, recordActivity, getOrganizationSecuritySummary, getSecurityAccountOptions,
  } = useHrms()
  const data = snapshot!
  const user = identity!
  const [activeTab, setActiveTab] = useState(tabs.includes(initialFilter) ? initialFilter : 'Alerts')
  const [summary, setSummary] = useState<OrganizationSecuritySummary>({ totalAccounts: 0, mfaEnabled: 0, mfaPending: 0, privilegedAccounts: 0, privilegedMfaEnabled: 0 })
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlertSummary | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<ZapFinding | null>(null)
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [accountOptions, setAccountOptions] = useState(data.employees.map((employee) => ({ employee_code: employee.id, first_name: employee.firstName, last_name: employee.lastName })))
  const [accountOptionsError, setAccountOptionsError] = useState('')
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState(['Critical', 'High', 'Medium', 'Low'].includes(initialFilter) ? initialFilter : 'All')
  const [alertPage, setAlertPage] = useState(1)
  const [auditQuery, setAuditQuery] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [investigation, setInvestigation] = useState<Omit<SecurityInvestigationInput, 'alertCode'>>({ status: 'Investigating', note: '', resolutionReason: '' })
  const [saving, setSaving] = useState(false)
  const [alertForm, setAlertForm] = useState<SecurityAlertInput>({ employeeCode: '', severity: 'Medium', confidence: 'Medium', eventType: 'Unusual access', title: '', description: '', whyItMatters: '', recommendedAction: '' })
  const [zapForm, setZapForm] = useState<ZapImportInput>({ report: '', reportName: '', targetUrl: 'https://quantumnhr.com', environment: 'Production', scanType: 'Baseline', reportTimeZone: 'UTC', authorizedScope: 'Authorized passive baseline assessment of the Quantum HRMS production web interface.', notes: '' })
  const [zapImporting, setZapImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const canManage = !readOnly && ['admin', 'security_admin'].includes(user.role ?? '')
  const closingInvestigation = ['Resolved', 'False Positive'].includes(investigation.status)

  useEffect(() => {
    let current = true
    getOrganizationSecuritySummary().then((result) => current && setSummary(result)).catch(() => current && setSummaryError(true))
      .finally(() => current && setSummaryLoading(false))
    return () => { current = false }
  }, [getOrganizationSecuritySummary])

  useEffect(() => {
    if (!showCreate || !getSecurityAccountOptions) return
    let active = true
    getSecurityAccountOptions().then((rows) => { if (active) { setAccountOptions(rows); setAccountOptionsError('') } })
      .catch(() => { if (active) setAccountOptionsError('The account list could not be refreshed. Close and reopen this form to retry.') })
    return () => { active = false }
  }, [showCreate, getSecurityAccountOptions])

  const alerts = useMemo(() => data.securityAlerts.filter((alert) => {
    const text = `${alert.id} ${alert.title} ${alert.description} ${alert.affected}`.toLowerCase()
    return (severity === 'All' || alert.severity === severity) && text.includes(query.toLowerCase())
  }), [data.securityAlerts, query, severity])
  const alertPageCount = Math.max(1, Math.ceil(alerts.length / alertPageSize))
  const visibleAlertPage = Math.min(alertPage, alertPageCount)
  const alertStart = (visibleAlertPage - 1) * alertPageSize
  const paginatedAlerts = alerts.slice(alertStart, alertStart + alertPageSize)
  const alertPages = pageWindow(visibleAlertPage, alertPageCount)
  const openAlerts = data.securityAlerts.filter((alert) => openStatuses.includes(alert.status))
  const critical = openAlerts.filter((alert) => alert.severity === 'Critical').length
  const investigations = openAlerts.filter((alert) => ['Investigating', 'Confirmed', 'Contained'].includes(alert.status)).length
  const latestScan = data.zapScanRuns[0]
  const latestFindings = latestScan ? data.zapFindings.filter((finding) => finding.scanId === latestScan.id) : []
  const openFindings = data.zapFindings.filter((finding) => ['Open', 'In Progress'].includes(finding.status))
  const posture = summaryError || summaryLoading ? 'Coverage unverified' : critical || openFindings.some((item) => item.risk === 'High') ? 'Immediate review' : openAlerts.length || summary.mfaPending || openFindings.length ? 'Review needed' : 'No known open issues'
  const postureTone = posture === 'No known open issues' ? 'info' : posture === 'Immediate review' ? 'danger' : 'warning'
  const filteredAudit = data.auditLog.filter((entry) => `${entry.actor} ${entry.action} ${entry.target}`.toLowerCase().includes(auditQuery.toLowerCase()))
  const auditPageCount = Math.max(1, Math.ceil(filteredAudit.length / auditPageSize))
  const visibleAuditPage = Math.min(auditPage, auditPageCount)
  const auditStart = (visibleAuditPage - 1) * auditPageSize
  const paginatedAudit = filteredAudit.slice(auditStart, auditStart + auditPageSize)
  const auditPages = pageWindow(visibleAuditPage, auditPageCount)

  const submitAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true)
    try { await addSecurityAlert(alertForm); setShowCreate(false); setAlertPage(1); setAlertForm({ employeeCode: '', severity: 'Medium', confidence: 'Medium', eventType: 'Unusual access', title: '', description: '', whyItMatters: '', recommendedAction: '' }) }
    finally { setSaving(false) }
  }
  const saveInvestigation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true)
    try { await updateSecurityInvestigation({ alertCode: selectedAlert!.id, ...investigation }); setSelectedAlert(null); setInvestigation({ status: 'Investigating', note: '', resolutionReason: '' }) }
    finally { setSaving(false) }
  }
  const revokeSession = async () => {
    await endSession(selectedSession!.id); setSelectedSession(null)
  }
  const chooseZapReport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5_000_000) return
    const report = await file.text()
    setZapForm((current) => ({ ...current, report, reportName: file.name }))
  }
  const submitZap = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setZapImporting(true)
    try { await importZapReport(zapForm); setZapForm((current) => ({ ...current, report: '', reportName: '', notes: '' })); if (fileRef.current) fileRef.current.value = ''; setActiveTab('Vulnerability testing') }
    finally { setZapImporting(false) }
  }
  const exportAudit = async () => {
    downloadCsv('quantum-security-audit', [{ label: 'Actor', key: 'actor' }, { label: 'Action', key: 'action' }, { label: 'Target', key: 'target' }, { label: 'Time', key: 'time' }], filteredAudit)
    await recordActivity({ action: 'Exported security audit evidence', target: `${filteredAudit.length} authorized events` })
  }

  return <div className="page-stack security-operations-page">
    <SectionHeading eyebrow="Security operations and assurance" title="Unified Security Center" description="Investigate organization-wide events, review authenticated sessions, preserve audit evidence, and track authorized OWASP ZAP assessments." actions={<div className="section-action-row">{canManage && <button className="button button-primary" onClick={() => setShowCreate(true)}><ShieldAlert size={17} />Create alert</button>}<button className="button button-secondary" onClick={refreshData}><RefreshCw size={17} />Refresh evidence</button></div>} />

    <Banner icon={Gauge} tone={postureTone} label="Organization security status" title={posture} badge={<Badge tone={postureTone}>Live data</Badge>}>{openAlerts.length} open {openAlerts.length === 1 ? 'alert' : 'alerts'} · {openFindings.length} open ZAP {openFindings.length === 1 ? 'finding' : 'findings'} · {summaryLoading ? 'checking MFA coverage' : `${summary.mfaEnabled} of ${summary.totalAccounts} accounts use MFA`}</Banner>
    <nav className="security-tabs security-operations-tabs" aria-label="Security operations sections">{tabs.map((tab) => <button className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>

    {activeTab === 'Overview' && <>
      <div className="stats-grid stats-grid-4"><StatCard icon={XCircle} label="Critical alerts" value={critical} detail="Immediate review required" tone="red" /><StatCard icon={ShieldEllipsis} label="Investigations" value={investigations} detail="Confirmed or being reviewed" tone="amber" /><StatCard icon={Fingerprint} label="MFA coverage" value={summaryLoading ? '—' : `${summary.mfaEnabled}/${summary.totalAccounts}`} detail={`${summary.mfaPending} account${summary.mfaPending === 1 ? '' : 's'} without MFA`} tone={summary.mfaPending ? 'amber' : 'green'} /><StatCard icon={FileSearch} label="Open ZAP findings" value={openFindings.length} detail={latestScan ? `Last scan ${when(latestScan.completedAt)}` : 'No report imported yet'} tone="purple" /></div>
      <div className="security-overview-grid"><section className="panel"><div className="panel-header"><div><h2>Priority incident queue</h2><p>Highest-risk unresolved activity first</p></div><button className="text-button" onClick={() => setActiveTab('Alerts')}>Open alert inbox</button></div><div className="security-priority-list">{openAlerts.sort((a, b) => ['Critical','High','Medium','Low'].indexOf(a.severity) - ['Critical','High','Medium','Low'].indexOf(b.severity)).slice(0, 5).map((alert) => <button key={alert.id} onClick={() => setSelectedAlert(alert)}><span className={`risk-dot risk-${alert.severity.toLowerCase()}`} /><div><strong>{alert.title}</strong><small>{alert.affected} · {alert.status}</small></div><Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge></button>)}{!openAlerts.length && <div className="security-all-clear roomy"><CheckCircle2 /><strong>No open security alerts</strong><p>New real events will be prioritized here.</p></div>}</div></section>
      <section className="panel"><div className="panel-header"><div><h2>Control coverage</h2><p>Measured account and testing controls</p></div></div><div className="coverage-list"><article><span><Fingerprint /></span><div><strong>Privileged MFA</strong><p>{summary.privilegedMfaEnabled} of {summary.privilegedAccounts} privileged accounts protected</p></div><Badge tone={summary.privilegedAccounts && summary.privilegedMfaEnabled === summary.privilegedAccounts ? 'success' : 'warning'}>{summary.privilegedAccounts && summary.privilegedMfaEnabled === summary.privilegedAccounts ? 'Covered' : 'Review'}</Badge></article><article><span><LockKeyhole /></span><div><strong>Row-Level Security</strong><p>Employee, session, alert, payroll, and audit access is role scoped</p></div><Badge tone="success">Active</Badge></article><article><span><Globe2 /></span><div><strong>OWASP ZAP evidence</strong><p>{latestScan ? `${latestScan.type} · ${latestScan.environment} · ${latestScan.status}` : 'Import an authorized ZAP JSON report'}</p></div><Badge tone={latestScan ? statusTone(latestScan.status) : 'warning'}>{latestScan ? latestScan.status : 'Pending'}</Badge></article></div></section></div>
    </>}

    {activeTab === 'Alerts' && <section className="panel security-alert-inbox"><div className="panel-header panel-header-wrap"><div><h2>Prioritized security alert inbox</h2><p>Every decision is preserved in the investigation history.</p></div><div className="filter-row"><label className="compact-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setAlertPage(1) }} placeholder="Search alert evidence" /></label><label className="compact-select"><Filter size={15} /><select value={severity} onChange={(event) => { setSeverity(event.target.value); setAlertPage(1) }}>{['All','Critical','High','Medium','Low'].map((item) => <option key={item}>{item}</option>)}</select></label></div></div>{paginatedAlerts.length ? <div className="alert-list">{paginatedAlerts.map((alert) => <article className={`security-alert severity-${alert.severity.toLowerCase()}`} key={alert.id}><div className="alert-severity-icon">{alert.severity === 'Critical' ? <XCircle /> : <AlertTriangle />}</div><div className="alert-main"><div className="alert-labels"><Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge><Badge tone={statusTone(alert.status)}>{alert.status}</Badge><span>{alert.id} · {alert.confidence} confidence</span></div><h3>{alert.title}</h3><p>{alert.description}</p><div className="alert-meta"><span><Users />{alert.affected}</span><span><Clock3 />{alert.time}</span></div></div><button className="button button-secondary" onClick={() => setSelectedAlert(alert)}><Eye size={16} />Investigate</button></article>)}</div> : <EmptyState icon={ShieldCheck} title="No matching security alerts" text="Adjust the search or severity filter to review other evidence." />}<footer className="audit-pagination alert-pagination"><p>Showing <strong>{alerts.length ? alertStart + 1 : 0}–{Math.min(alertStart + alertPageSize, alerts.length)}</strong> of <strong>{alerts.length}</strong> alerts</p><nav aria-label="Security alert pages"><button type="button" aria-label="Previous alert page" onClick={() => setAlertPage((page) => Math.max(1, page - 1))} disabled={visibleAlertPage === 1}><ChevronLeft /></button>{alertPages.map((page) => <button type="button" key={page} className={page === visibleAlertPage ? 'active' : ''} aria-label={`Alert page ${page}`} aria-current={page === visibleAlertPage ? 'page' : undefined} onClick={() => setAlertPage(page)}>{page}</button>)}<button type="button" aria-label="Next alert page" onClick={() => setAlertPage((page) => Math.min(alertPageCount, page + 1))} disabled={visibleAlertPage === alertPageCount}><ChevronRight /></button></nav></footer></section>}

    {activeTab === 'Sessions' && <section className="panel"><div className="panel-header"><div><h2>Organization session evidence</h2><p>Review account and verified session link before revocation. Device and region labels are browser-reported.</p></div></div><div className="session-list">{data.sessions.map((session) => { const employee = data.employees.find((item) => item.id === session.employeeId); return <article key={session.id} className={session.current ? 'current-session' : ''}><div className="session-icon"><Laptop /></div><div><strong>{session.device}</strong><span>{employee ? `${employee.firstName} ${employee.lastName}` : session.employeeId} · {session.employeeId}</span><span>{session.location} · {session.assuranceLevel.toUpperCase()} · Seen {when(session.lastSeenAt || session.createdAt)}</span></div><div className="session-actions"><Badge tone={session.assuranceLevel === 'aal2' ? 'success' : 'warning'}>{session.assuranceLevel.toUpperCase()}</Badge>{!session.authSessionId && <Badge tone="neutral">Historical observation</Badge>}{canManage && !session.current && session.authSessionId && <button className="text-button danger-text" onClick={() => setSelectedSession(session)}>Review & revoke</button>}</div></article> })}</div></section>}

    {activeTab === 'Audit trail' && <section className="panel audit-evidence-panel"><div className="panel-header panel-header-wrap"><div><h2>Protected sensitive-activity evidence</h2><p>Append-only activity exposed according to the signed-in administrator role.</p></div><div className="filter-row"><label className="compact-search"><Search size={16} /><input value={auditQuery} onChange={(event) => { setAuditQuery(event.target.value); setAuditPage(1) }} placeholder="Search actor, action, or target" /></label><button className="button button-secondary" onClick={exportAudit}><Download size={16} />Export CSV</button></div></div>{paginatedAudit.length ? <div className="audit-list">{paginatedAudit.map((entry) => <article key={entry.id}><span>{entry.actor.split(' ').map((word) => word[0]).join('').slice(0,2)}</span><div><strong>{entry.actor}</strong><p>{entry.action} · {entry.target}</p></div><time>{entry.time}</time></article>)}</div> : <EmptyState icon={Clock3} title="No matching audit evidence" text="Try another actor, action, or target keyword." />}<footer className="audit-pagination"><p>Showing <strong>{filteredAudit.length ? auditStart + 1 : 0}–{Math.min(auditStart + auditPageSize, filteredAudit.length)}</strong> of <strong>{filteredAudit.length}</strong> records</p><nav aria-label="Audit trail pages"><button type="button" aria-label="Previous audit page" onClick={() => setAuditPage((page) => Math.max(1, page - 1))} disabled={visibleAuditPage === 1}><ChevronLeft /></button>{auditPages.map((page) => <button type="button" key={page} className={page === visibleAuditPage ? 'active' : ''} aria-label={`Audit page ${page}`} aria-current={page === visibleAuditPage ? 'page' : undefined} onClick={() => setAuditPage(page)}>{page}</button>)}<button type="button" aria-label="Next audit page" onClick={() => setAuditPage((page) => Math.min(auditPageCount, page + 1))} disabled={visibleAuditPage === auditPageCount}><ChevronRight /></button></nav></footer></section>}

    {activeTab === 'Vulnerability testing' && <div className="page-stack"><Banner icon={ShieldCheck} tone="success" title="Authorized OWASP ZAP testing" badge={<Badge tone="success">Ethical scope enforced</Badge>}>On the live site, only passive baseline scans are allowed. Active attack scans must run on a separate preview or staging site with fictional data.</Banner><div className="stats-grid stats-grid-4"><StatCard icon={XCircle} label="High findings" value={latestScan?.high ?? 0} detail="Latest imported scan" tone="red" /><StatCard icon={AlertTriangle} label="Medium findings" value={latestScan?.medium ?? 0} detail="Requires review" tone="amber" /><StatCard icon={ShieldEllipsis} label="Low findings" value={latestScan?.low ?? 0} detail="Hardening opportunities" tone="blue" /><StatCard icon={FileSearch} label="Scan history" value={data.zapScanRuns.length} detail="SHA-256 verified imports" tone="purple" /></div>
      {canManage && <section className="panel rf-zap">
        <div className="panel-header"><div><h2>Import an OWASP ZAP report</h2><p>Upload the JSON report from an authorized scan. It is checked against the approved scope and fingerprinted before the findings are saved.</p></div><Badge tone="success">Scope checked</Badge></div>
        <form className="rf-single" onSubmit={submitZap}>
          <label className={`zap-drop-zone ${zapForm.report ? 'ready' : ''}`}><input ref={fileRef} type="file" accept="application/json,.json" onChange={chooseZapReport} required={!zapForm.report} /><span className="zap-upload-icon">{zapForm.report ? <CheckCircle2 /> : <Upload />}</span><strong>{zapForm.reportName || 'Drop or choose the ZAP JSON report'}</strong><span>{zapForm.report ? 'Report selected and ready to check' : 'Official ZAP JSON file, up to 5 MB. The report stays access-controlled.'}</span></label>
          <section className="rf-section">
            <SectionTitle description="These details are saved with the scan in the audit record.">Scan details</SectionTitle>
            <div className="rf-grid">
              <Field label="Scan type" help="Passive baseline only. Signed-in coverage is not assumed.">{(control) => <select {...control} value={zapForm.scanType} onChange={(event) => setZapForm({ ...zapForm, scanType: event.target.value })}>{['Baseline'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
              <Field label="Environment" help="The live site accepts passive baseline evidence only.">{(control) => <select {...control} value={zapForm.environment} onChange={(event) => setZapForm({ ...zapForm, environment: event.target.value })}>{['Production', 'Deploy Preview', 'Staging', 'Local Test'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
              <Field label="Report time zone" help="Used only when the report’s timestamp has no time zone. Match the machine that ran ZAP.">{(control) => <select {...control} value={zapForm.reportTimeZone || 'UTC'} onChange={(event) => setZapForm({ ...zapForm, reportTimeZone: event.target.value as 'UTC' | 'Asia/Manila' })}><option value="UTC">UTC (Docker / CI default)</option><option value="Asia/Manila">Philippines (UTC+08:00)</option></select>}</Field>
              <Field label="Authorized target" className="rf-span-2" help="Only approved Quantum HRMS addresses pass the server check.">{(control) => <input {...control} type="url" value={zapForm.targetUrl} onChange={(event) => setZapForm({ ...zapForm, targetUrl: event.target.value })} required />}</Field>
              <Field label="Authorized scope" className="rf-span-2" help="What was tested, and any safety limits.">{(control) => <textarea {...control} rows={3} value={zapForm.authorizedScope} onChange={(event) => setZapForm({ ...zapForm, authorizedScope: event.target.value })} required />}</Field>
            </div>
          </section>
          <FormFooter icon={LockKeyhole} note="The server checks the scope and fingerprints the report (SHA-256) before saving it.">
            <button className="button button-primary" disabled={zapImporting || !zapForm.report}><FileJson aria-hidden="true" />{zapImporting ? 'Checking report…' : 'Verify & import report'}</button>
          </FormFooter>
        </form>
      </section>}
      <section className="panel"><div className="panel-header"><div><h2>Scan history</h2><p>Reviewed dynamic-security evidence—not a claim that automated scanning finds every vulnerability.</p></div></div>{data.zapScanRuns.length ? <div className="zap-scan-list">{data.zapScanRuns.map((scan) => <article key={scan.id}><span><Globe2 /></span><div><div><strong>{scan.type} · {scan.environment}</strong><Badge tone={statusTone(scan.status)}>{scan.status}</Badge></div><p>{scan.targetUrl}</p><small>{when(scan.completedAt)} · {scan.high} high · {scan.medium} medium · {scan.low} low · {scan.informational} informational</small></div><code>{scan.id}</code></article>)}</div> : <EmptyState icon={FileSearch} title="No ZAP evidence imported" text="Run the authorized baseline workflow and import its JSON report here." />}</section>
      {latestScan && <section className="panel"><div className="panel-header"><div><h2>Latest reviewed findings</h2><p>{latestScan.id} · report integrity {latestScan.reportSha256.slice(0,12)}…</p></div></div><div className="zap-findings-table">{latestFindings.map((finding) => <button key={finding.id} onClick={() => setSelectedFinding(finding)}><Badge tone={riskTone[finding.risk]}>{finding.risk}</Badge><div><strong>{finding.name}</strong><span>{finding.pluginId ? `Rule ${finding.pluginId} · ` : ''}{finding.affectedUrl}</span></div><Badge tone={statusTone(finding.status)}>{finding.status}</Badge></button>)}</div></section>}
    </div>}

    {activeTab === 'Security controls' && <section className="panel"><div className="panel-header"><div><h2>Security control register</h2><p>Operational evidence separated from personal employee account controls.</p></div></div><div className="security-control-register"><article><span><Fingerprint /></span><div><strong>Employee-owned MFA</strong><p>Employees enroll, verify, and remove their own TOTP factors. Secrets and codes are never visible to administrators.</p></div><Badge tone="success">Implemented</Badge></article><article><span><LockKeyhole /></span><div><strong>Supabase Row-Level Security</strong><p>Employees see their own alerts and sessions; security roles see organization evidence; auditors remain read-only.</p></div><Badge tone="success">Active</Badge></article><article><span><Clock3 /></span><div><strong>Session lifecycle</strong><p>Sessions use authenticated identifiers and server-derived MFA assurance. Device and region labels are not independently verified.</p></div><Badge tone="success">Active</Badge></article><article><span><FileSearch /></span><div><strong>OWASP ZAP testing</strong><p>Authorized reports are scope checked, hashed, stored, reviewed, and separated from live employee controls.</p></div><Badge tone={latestScan ? 'success' : 'warning'}>{latestScan ? 'Evidence available' : 'Awaiting scan'}</Badge></article><article><span><ShieldAlert /></span><div><strong>Incident response history</strong><p>Employee decisions and administrator investigation transitions are recorded in Supabase.</p></div><Badge tone="success">Realtime</Badge></article></div></section>}

    {showCreate && canManage && <Modal title="Create a reviewable security alert" onClose={() => setShowCreate(false)} size="wide">
      <form className="rf-form rf-form--sm" onSubmit={submitAlert}>
        <FormIntro aside={<Badge tone={severityTone[alertForm.severity]}>{alertForm.severity} priority</Badge>}>Write a calm, clear notice that tells the affected person what happened and what to do next.</FormIntro>
        <div className="rf-single">
          <section className="rf-section">
            <SectionTitle step={1} description="Who is affected, and how serious it is.">Account and classification</SectionTitle>
            <div className="rf-grid">
              <Field label="Affected account" help="Only this person and security staff can see the alert.">{(control) => <>
                <select {...control} value={alertForm.employeeCode} onChange={(event) => setAlertForm({ ...alertForm, employeeCode: event.target.value })} required><option value="">Select the affected account</option>{accountOptions.map((employee) => <option key={employee.employee_code} value={employee.employee_code}>{employee.first_name} {employee.last_name} · {employee.employee_code}</option>)}</select>
                {accountOptionsError && <p className="rf-help rf-help--error" role="alert">{accountOptionsError}</p>}
              </>}</Field>
              <Field label="Event type" help="The category that best matches what happened.">{(control) => <select {...control} value={alertForm.eventType} onChange={(event) => setAlertForm({ ...alertForm, eventType: event.target.value })}>{['Unusual access', 'Repeated sign-in failure', 'New device', 'Sensitive record access', 'Privilege change', 'MFA change', 'OWASP ZAP finding'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
              <Field label="Severity" help="The likely impact, not how urgent it feels.">{(control) => <select {...control} value={alertForm.severity} onChange={(event) => setAlertForm({ ...alertForm, severity: event.target.value })}>{['Critical', 'High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
              <Field label="Confidence" help="How strongly the evidence supports this alert.">{(control) => <select {...control} value={alertForm.confidence} onChange={(event) => setAlertForm({ ...alertForm, confidence: event.target.value })}>{['High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
            </div>
          </section>
          <section className="rf-section">
            <SectionTitle step={2} description="Use plain language. The affected person reads this.">What the employee will see</SectionTitle>
            <Field label="Alert title" count={`${alertForm.title.length}/140`} help="Short and specific, without alarming language.">{(control) => <input {...control} value={alertForm.title} onChange={(event) => setAlertForm({ ...alertForm, title: event.target.value })} minLength={4} maxLength={140} placeholder="Example: New sign-in from an unfamiliar browser" required />}</Field>
            <Field label="What happened" help="Describe what was seen, without calling it malicious before that is confirmed.">{(control) => <textarea {...control} rows={4} value={alertForm.description} onChange={(event) => setAlertForm({ ...alertForm, description: event.target.value })} minLength={10} placeholder="What was observed, when, and which service or session" required />}</Field>
            <Field label="Why this matters" help="Explain the possible risk in everyday terms.">{(control) => <textarea {...control} rows={3} value={alertForm.whyItMatters} onChange={(event) => setAlertForm({ ...alertForm, whyItMatters: event.target.value })} minLength={10} placeholder="The possible impact, in words the employee understands" required />}</Field>
            <Field label="Recommended safe action" help="Never ask for a password, recovery code, or MFA code.">{(control) => <textarea {...control} rows={3} value={alertForm.recommendedAction} onChange={(event) => setAlertForm({ ...alertForm, recommendedAction: event.target.value })} minLength={10} placeholder="A direct next step, such as reviewing the session or reporting that it was not them" required />}</Field>
          </section>
        </div>
        <FormFooter icon={LockKeyhole} note="The alert is private to this person and security staff, and is added to the audit trail.">
          <button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="button button-primary" disabled={saving}><ShieldCheck aria-hidden="true" />{saving ? 'Creating…' : 'Create secure alert'}</button>
        </FormFooter>
      </form>
    </Modal>}

    {selectedAlert && <Modal title={`Investigation ${selectedAlert.id}`} onClose={() => setSelectedAlert(null)} size="wide">
      <form className="rf-form rf-form--sm" onSubmit={saveInvestigation}>
        <div className="rf-record-head">
          <div className="inline-badges"><Badge tone={severityTone[selectedAlert.severity]}>{selectedAlert.severity}</Badge><Badge tone={statusTone(selectedAlert.status)}>{selectedAlert.status}</Badge><span className="rf-tag">{selectedAlert.confidence} confidence</span></div>
          <h3>{selectedAlert.title}</h3>
          <p>{selectedAlert.description}</p>
        </div>
        <div className="rf-single">
          <dl className="rf-facts rf-facts--2">
            <div><dt>Affected account</dt><dd>{selectedAlert.affected}</dd></div>
            <div><dt>Confidence</dt><dd>{selectedAlert.confidence}</dd></div>
            <div><dt>Why this matters</dt><dd>{selectedAlert.whyItMatters}</dd></div>
            <div><dt>Recommended action</dt><dd>{selectedAlert.recommendedAction}</dd></div>
          </dl>
          {canManage && <section className="rf-section">
            <SectionTitle description="Choose the next status and note the evidence behind your decision.">Investigation decision</SectionTitle>
            <div className="rf-grid">
              <Field label="Next status" help="The alert updates as soon as you save.">{(control) => <select {...control} value={investigation.status} onChange={(event) => setInvestigation({ ...investigation, status: event.target.value, resolutionReason: ['Resolved', 'False Positive'].includes(event.target.value) ? investigation.resolutionReason : '' })}>{['Investigating', 'Acknowledged', 'Confirmed', 'Contained', 'Resolved', 'False Positive'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
              <Field label="Resolution reason" status={closingInvestigation && <span className="rf-status rf-status--editing">Required</span>} help={closingInvestigation ? 'Saved in the audit record.' : 'Available when you choose Resolved or False Positive.'}>{(control) => <input {...control} value={investigation.resolutionReason} onChange={(event) => setInvestigation({ ...investigation, resolutionReason: event.target.value })} placeholder={closingInvestigation ? 'Why this alert can be closed' : 'Not needed for this status'} disabled={!closingInvestigation} required={closingInvestigation} />}</Field>
            </div>
            <Field label="Investigation note" optional help="Don’t include passwords, codes, or unnecessary personal details.">{(control) => <textarea {...control} rows={4} value={investigation.note} onChange={(event) => setInvestigation({ ...investigation, note: event.target.value })} placeholder="What you checked, what you did, and why" />}</Field>
          </section>}
        </div>
        {canManage
          ? <FormFooter icon={LockKeyhole} note="Your name, the status change, and your note are recorded.">
            <button type="button" className="button button-secondary" onClick={() => setSelectedAlert(null)}>Cancel</button>
            <button className="button button-primary" disabled={saving}><ShieldCheck aria-hidden="true" />{saving ? 'Saving…' : 'Save investigation decision'}</button>
          </FormFooter>
          : <FormFooter note="You have read-only access to this alert.">
            <button type="button" className="button button-primary" onClick={() => setSelectedAlert(null)}>Close evidence</button>
          </FormFooter>}
      </form>
    </Modal>}

    {selectedSession && <Modal title="Review organization session" onClose={() => setSelectedSession(null)}><div className="session-review"><span><Laptop /></span><div><h3>{selectedSession.device}</h3><p>Confirm the employee, location, and related alerts before removing this tracked session.</p></div><dl><div><dt>Account</dt><dd>{selectedSession.employeeId}</dd></div><div><dt>Location</dt><dd>{selectedSession.location}</dd></div><div><dt>Assurance</dt><dd>{selectedSession.assuranceLevel.toUpperCase()}</dd></div></dl><div className="modal-actions"><button className="button button-secondary" onClick={() => setSelectedSession(null)}>Cancel</button><button className="button button-primary danger-button" onClick={revokeSession}>Revoke & audit</button></div></div></Modal>}

    {selectedFinding && <Modal title={`ZAP finding ${selectedFinding.pluginId || selectedFinding.id}`} onClose={() => setSelectedFinding(null)}><div className="zap-finding-detail"><div><Badge tone={riskTone[selectedFinding.risk]}>{selectedFinding.risk}</Badge><Badge tone={statusTone(selectedFinding.status)}>{selectedFinding.status}</Badge></div><h3>{selectedFinding.name}</h3><dl><div><dt>Affected location</dt><dd>{selectedFinding.affectedUrl}</dd></div><div><dt>Description</dt><dd>{selectedFinding.description}</dd></div><div><dt>Recommended remediation</dt><dd>{selectedFinding.solution || 'Review the official ZAP rule guidance and validate the finding manually.'}</dd></div><div><dt>Evidence</dt><dd>{selectedFinding.evidence || 'No response excerpt was included in the imported report.'}</dd></div></dl><div className="modal-actions"><button className="button button-primary" onClick={() => setSelectedFinding(null)}>Close finding</button></div></div></Modal>}
  </div>
}
