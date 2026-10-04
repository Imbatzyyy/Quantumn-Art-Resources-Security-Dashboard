import { useEffect, useState } from 'react'
import { ArrowUpRight, RefreshCw, ShieldAlert, ShieldCheck, Users, Monitor } from 'lucide-react'
import { Badge, StatCard } from '../components/ui.js'
import { securityOperation } from '../services/supabaseSecurityApi.js'
import { useHrms } from '../state/useHrms.js'
import { securitySeverityOrder } from '../utils/securityMetrics.js'
import './security-overview.css'

export interface SecurityOverviewData {
  asOf: string
  windowDays: number
  accounts: { total: number; mfaEnabled: number; privileged: number; privilegedMfaEnabled: number }
  alerts: { open: number; critical: number; resolvedInWindow: number; falsePositivesInWindow: number }
  sessions: { observedRecently: number; legacyObservations: number }
  trend: Array<{ date: string; total: number; high: number }>
  bySeverity: Array<{ severity: string; total: number }>
  byStatus: Array<{ status: string; total: number }>
  latestScan: null | { scan_code: string; scan_type: string; completed_at: string; status: string; high_count: number; medium_count: number; low_count: number; informational_count: number; target_url: string }
  recentAlerts: Array<{ alert_code: string; title: string; severity: string; status: string; created_at: string }>
}

export default function AdminSecurityOverview({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { getSecurityOverview } = useHrms()
  const [days, setDays] = useState(30)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<SecurityOverviewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const request = getSecurityOverview ? getSecurityOverview(days) : securityOperation<SecurityOverviewData>({ action: 'security-overview', windowDays: days })
    request
      .then((result) => { if (active) { setData(result); setError('') } })
      .catch(() => { if (active) setError('Security statistics could not be refreshed. The last successful snapshot, if available, remains below.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, revision, getSecurityOverview])
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') { setLoading(true); setRevision((n) => n + 1) } }, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const maxEvents = Math.max(1, ...(data?.trend.map((day) => day.total) || []))
  const totalEvents = data?.trend.reduce((total, day) => total + day.total, 0) || 0
  const coverage = data?.accounts.total ? Math.round(data.accounts.mfaEnabled / data.accounts.total * 100) : null
  const scan = data?.latestScan
  const scanAge = scan && data ? Math.max(0, Math.floor((Date.parse(data.asOf) - Date.parse(scan.completed_at)) / 86_400_000)) : null

  return <section className="security-overview" aria-labelledby="security-overview-title" aria-busy={loading}>
    <header className="security-overview-heading"><div><h2 id="security-overview-title">Security overview</h2><p>Open alerts, two-step sign-in coverage, and the latest vulnerability scan.</p></div><div className="security-overview-tools"><label>Trend period<select value={days} onChange={(event) => { setLoading(true); setDays(Number(event.target.value)) }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button className="button button-secondary" disabled={loading} onClick={() => { setLoading(true); setRevision((n) => n + 1) }} aria-label="Refresh security statistics"><RefreshCw size={17} /></button></div></header>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!data && <p role="status">{loading ? 'Loading security overview…' : 'Statistics are unavailable. Use Refresh to retry.'}</p>}
    {data && <>
      <div className="security-freshness"><Badge tone={error ? 'warning' : 'neutral'}>{error ? 'Not up to date' : 'Updated'}</Badge><span>Updated {new Date(data.asOf).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })} PHT</span></div>
      <div className="stats-grid stats-grid-4"><StatCard icon={ShieldAlert} label="Open security alerts" value={data.alerts.open} detail={`${data.alerts.critical} critical · all-time backlog`} tone="red" /><StatCard icon={ShieldCheck} label="Two-step sign-in coverage" value={coverage === null ? 'No accounts' : `${coverage}%`} detail={`${data.accounts.mfaEnabled} of ${data.accounts.total} active linked accounts`} tone="blue" /><StatCard icon={Users} label="Administrators with two-step sign-in" value={`${data.accounts.privilegedMfaEnabled} / ${data.accounts.privileged}`} detail="Administrator and auditor accounts" tone="purple" /><StatCard icon={Monitor} label="Recent sessions" value={data.sessions.observedRecently} detail="Active in the last 15 minutes" tone="green" /></div>
      <div className="security-chart-grid">
        <article className="panel security-chart"><header><div><h3>Recorded alert activity</h3><p>{totalEvents} alerts created in this {data.windowDays}-day window</p></div><Badge tone="neutral">PHT dates</Badge></header><div className="security-trend" role="img" aria-label={`${totalEvents} alerts in ${data.windowDays} days. Exact daily counts are in the expandable table below.`}>{data.trend.map((day) => <div key={day.date} title={`${day.date}: ${day.total} alerts, ${day.high} high or critical`}><span style={{ height: `${day.total / maxEvents * 100}%` }} className={day.high ? 'has-high-risk' : ''} /></div>)}</div><div className="security-chart-axis"><span>{data.trend[0]?.date}</span><span>{data.trend.at(-1)?.date}</span></div><p className="security-chart-note">Blue: recorded alerts. Amber: a day containing high or critical alerts. These are not confirmed attack counts.</p><details><summary>View exact daily counts</summary><div className="security-data-scroll"><table><thead><tr><th>Date (PHT)</th><th>All alerts</th><th>High / critical</th></tr></thead><tbody>{data.trend.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.total}</td><td>{day.high}</td></tr>)}</tbody></table></div></details></article>
        <article className="panel security-chart"><header><div><h3>Open alerts by severity</h3><p>Resolved and false-positive alerts are excluded.</p></div></header><div className="security-breakdown">{['Critical', 'High', 'Medium', 'Low'].map((severity) => { const count = data.bySeverity.find((row) => row.severity === severity)?.total || 0; return <button key={severity} aria-label={`View ${severity} alerts`} onClick={() => onNavigate(`security?tab=alerts&severity=${severity}`)}><span>{severity}</span><progress aria-label={`${severity} open alerts`} value={count} max={Math.max(data.alerts.open, 1)} /><strong>{count}</strong><ArrowUpRight size={16} /></button> })}</div><div className="security-resolution"><div><strong>{data.alerts.resolvedInWindow}</strong><span>Resolved in window</span></div><div><strong>{data.alerts.falsePositivesInWindow}</strong><span>False positives closed</span></div></div><button className="text-button" onClick={() => onNavigate('security?tab=alerts')}>Review all alerts <ArrowUpRight size={15} /></button></article>
      </div>
      <div className="security-chart-grid security-evidence-grid"><article className="panel security-chart"><header><div><h3>Access priorities</h3><p>What to improve next</p></div></header><ul className="security-priorities"><li><ShieldCheck /><span><strong>{data.accounts.privileged - data.accounts.privilegedMfaEnabled} administrator accounts without two-step sign-in</strong>Each administrator turns it on from My Account Security.</span><button className="text-button" onClick={() => onNavigate('account-security')}>My account security</button></li><li><Monitor /><span><strong>{data.sessions.legacyObservations} older sign-in records</strong>Only current sign-ins can be ended remotely.</span><button className="text-button" onClick={() => onNavigate('security?tab=sessions')}>Sessions</button></li></ul></article><article className="panel security-chart"><header><div><h3>Latest vulnerability scan</h3><p>A scan checks the site at one point in time.</p></div></header>{scan ? <><Badge tone={scan.high_count || scan.medium_count || (scanAge ?? 0) > 7 ? 'warning' : 'info'}>{scan.scan_type} · {scanAge} days ago</Badge><p className="security-scan-date">{new Date(scan.completed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })} PHT</p><div className="security-scan-counts"><span><strong>{scan.high_count}</strong>High</span><span><strong>{scan.medium_count}</strong>Medium</span><span><strong>{scan.low_count}</strong>Low</span><span><strong>{scan.informational_count}</strong>Info</span></div><p className="security-chart-note">Only the supplied report scope is represented. Public baseline scans do not verify authenticated workflows or database permissions.</p></> : <p>No scan has been imported yet.</p>}<button className="text-button" onClick={() => onNavigate('security?tab=scans')}>View scan results <ArrowUpRight size={15} /></button></article></div>
      <article className="panel security-chart"><header><div><h3>Alerts needing attention</h3><p>Highest severity first, then newest within that severity</p></div></header><div className="security-alert-list">{[...data.recentAlerts].sort((a,b) => securitySeverityOrder(a.severity) - securitySeverityOrder(b.severity)).map((alert) => <button key={alert.alert_code} onClick={() => onNavigate(`security?tab=alerts&severity=${alert.severity}`)}><Badge tone={alert.severity === 'Critical' ? 'danger' : 'warning'}>{alert.severity}</Badge><span><strong>{alert.title}</strong><small>{alert.status} · {alert.alert_code}</small></span><ArrowUpRight size={18} /></button>)}{!data.recentAlerts.length && <p>No open alerts.</p>}</div></article>
    </>}
  </section>
}
