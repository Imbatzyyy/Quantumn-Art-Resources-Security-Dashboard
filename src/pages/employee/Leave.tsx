import { useState, type FormEvent } from 'react'
import { CalendarDays, CalendarRange, CalendarX2, Clock3, HeartPulse, Info, Plus, ShieldCheck, Sun } from 'lucide-react'
import { Badge, ConfirmDialog, Modal, SectionHeading, StatCard, Tabs } from '../../components/ui.js'
import { tabPanelProps } from '../../components/tabPanel.js'
import { DataTable, type DataColumn } from '../../components/DataTable.js'
import { MonthCalendar, type CalendarEvent } from '../../components/MonthCalendar.js'
import { datesBetween, monthOf } from '../../utils/calendar.js'
import { useHrms } from '../../state/useHrms.js'
import { inclusiveDays } from '../../utils/downloads.js'
import { formatDate, statusTone } from '../../utils/format.js'
import { nonWorkingDaysIn, philippineHolidays, upcomingHolidays } from '../../utils/holidays.js'
import { businessDate } from '../../utils/securityMetrics.js'
import type { LeaveRequestRecord } from '../../types/hrms.js'
import { balanceFor, canCancelLeave, formatLeaveDays, leaveBalances, leavePoliciesOf, LEAVE_TYPES } from '../../utils/leave.js'

const leaveGuidance: Record<string, string> = {
  Vacation: 'Plan ahead when possible so your team can arrange coverage.',
  Sick: 'Use this when illness or recovery prevents you from working.',
  Emergency: 'For urgent, unexpected circumstances that require time away.',
  Other: 'Explain the leave purpose clearly so HR can route it correctly.',
}
const emptyForm = { type: 'Vacation', startDate: '', endDate: '', reason: '' }

export function EmployeeLeave({ startOpen = false, onCloseRequest }: { startOpen?: boolean; onCloseRequest?: () => void }) {
  const { data, user, submitLeave, cancelLeave } = useHrms()
  const [showRequest, setShowRequest] = useState(startOpen)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [cancelling, setCancelling] = useState<LeaveRequestRecord | null>(null)
  const [view, setView] = useState<'requests' | 'balances' | 'calendar'>('requests')
  const today = businessDate()
  const [month, setMonth] = useState(monthOf(today))
  const [form, setForm] = useState(emptyForm)
  if (!data || !user) return null
  const requests = data.leaveRequests.filter((item) => item.employeeId === user.id)
  const days = inclusiveDays(form.startDate, form.endDate)
  const thisYear = today.slice(0, 4)
  const balances = leaveBalances(leavePoliciesOf(data), data.leaveRequests, user.id, thisYear)
  const vacation = balanceFor(balances, 'Vacation')
  const sick = balanceFor(balances, 'Sick')
  const pendingDays = requests.filter((item) => item.status === 'Pending').reduce((sum, item) => sum + item.days, 0)
  const requestReady = days > 0 && days <= 30 && form.reason.trim().length >= 3
  // Balance of the selected type, counting leave already waiting for approval.
  const selected = balanceFor(balances, form.type)
  const selectedLeft = selected?.remaining == null ? null : Math.max(0, selected.remaining - selected.pending)
  const overBalance = selectedLeft != null && days > selectedLeft
  const describeBalance = (balance?: { remaining: number | null; allowance: number | null }) => balance?.remaining == null ? 'No fixed allowance' : `${formatLeaveDays(balance.remaining)} of ${balance.allowance}`
  const nonWorking = nonWorkingDaysIn(form.startDate, form.endDate)
  const overlapping = requests.find((item) => ['Pending', 'Approved'].includes(item.status) && form.startDate && form.endDate && item.startDate <= form.endDate && item.endDate >= form.startDate)

  const closeLeaveRequest = () => {
    if (leaveSaving) return
    setShowRequest(false)
    setForm(emptyForm)
    onCloseRequest?.()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestReady) return
    setLeaveSaving(true)
    try {
      await submitLeave({ ...form, employeeId: user.id })
      setShowRequest(false)
      setForm(emptyForm)
      onCloseRequest?.()
    } catch { /* Keep the form open for correction. */ }
    finally { setLeaveSaving(false) }
  }

  const columns: DataColumn<LeaveRequestRecord>[] = [
    { id: 'type', header: 'Type', primary: true, cell: (item) => <strong>{item.type}</strong>, sortValue: (item) => item.type },
    { id: 'dates', header: 'Dates', cell: (item) => item.startDate === item.endDate ? formatDate(item.startDate) : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`, sortValue: (item) => item.startDate, csv: (item) => `${item.startDate} to ${item.endDate}` },
    { id: 'days', header: 'Days', align: 'end', cell: (item) => item.days, sortValue: (item) => item.days },
    { id: 'reason', header: 'Reason', hideOnMobile: true, cell: (item) => <span className="cell-clamp">{item.reason}</span>, csv: (item) => item.reason },
    { id: 'status', header: 'Status', cell: (item) => <span className="cell-stack"><Badge tone={statusTone(item.status)}>{item.status}</Badge>{item.decisionNote && <small className="cell-note">HR: {item.decisionNote}</small>}</span>, sortValue: (item) => item.status, csv: (item) => item.status },
    { id: 'note', header: 'HR note', exportOnly: true, cell: (item) => item.decisionNote ?? '', csv: (item) => item.decisionNote ?? '' },
    { id: 'actions', header: '', align: 'end', cell: (item) => canCancelLeave(item, today) && cancelLeave ? <button type="button" className="button button-secondary button-small" onClick={() => setCancelling(item)} aria-label={`Cancel ${item.type.toLowerCase()} leave from ${formatDate(item.startDate)}`}>Cancel</button> : null },
  ]
  const balanceColumns: DataColumn<(typeof balances)[number]>[] = [
    { id: 'type', header: 'Leave type', primary: true, cell: (item) => <strong>{item.type}</strong> },
    { id: 'allowance', header: `Allowance for ${thisYear}`, align: 'end', cell: (item) => item.allowance == null ? 'Case by case' : formatLeaveDays(item.allowance) },
    { id: 'used', header: 'Used', align: 'end', cell: (item) => formatLeaveDays(item.used) },
    { id: 'pending', header: 'Pending', align: 'end', cell: (item) => item.pending ? formatLeaveDays(item.pending) : '—' },
    { id: 'remaining', header: 'Remaining', align: 'end', cell: (item) => item.remaining == null ? '—' : <strong>{formatLeaveDays(item.remaining)}</strong> },
  ]
  const year = Number(month.slice(0, 4))
  const events: CalendarEvent[] = [
    ...requests.filter((item) => ['Approved', 'Pending'].includes(item.status)).flatMap((item) => datesBetween(item.startDate, item.endDate).map((date) => ({ date, label: `${item.type} leave`, detail: item.status, tone: item.status === 'Approved' ? 'green' as const : 'amber' as const }))),
    ...[...philippineHolidays(year - 1), ...philippineHolidays(year), ...philippineHolidays(year + 1)].map((holiday) => ({ date: holiday.date, label: holiday.name, detail: holiday.kind, tone: 'purple' as const })),
  ]

  return <div className="page-stack">
    <SectionHeading
      title="Leave"
      description="Request time off and follow each approval."
      actions={<button className="button button-primary" onClick={() => setShowRequest(true)}><Plus aria-hidden="true" />New leave request</button>}
    />
    <div className="stats-grid stats-grid-4">
      <StatCard icon={CalendarDays} label="Vacation leave left" value={vacation?.remaining == null ? '—' : formatLeaveDays(vacation.remaining)} detail={vacation?.allowance == null ? 'No fixed allowance' : `Of ${vacation.allowance} days in ${thisYear}`} tone="green" onClick={() => setView('balances')} />
      <StatCard icon={HeartPulse} label="Sick leave left" value={sick?.remaining == null ? '—' : formatLeaveDays(sick.remaining)} detail={sick?.allowance == null ? 'No fixed allowance' : `Of ${sick.allowance} days in ${thisYear}`} tone="blue" onClick={() => setView('balances')} />
      <StatCard icon={Clock3} label="Pending approval" value={formatLeaveDays(pendingDays)} detail={pendingDays ? 'Waiting for HR' : 'No pending requests'} tone="amber" />
      <StatCard icon={Sun} label="Next holiday" value={upcomingHolidays(today, 1)[0] ? formatDate(upcomingHolidays(today, 1)[0].date) : '—'} detail={upcomingHolidays(today, 1)[0]?.name} tone="purple" />
    </div>

    <section className="panel">
      <div className="panel-header panel-header-tabs">
        <Tabs idPrefix="leave-view" label="Leave views" tabs={[{ id: 'requests', label: 'My requests', count: requests.length }, { id: 'balances', label: 'Balances' }, { id: 'calendar', label: 'Calendar' }]} active={view} onChange={setView} />
      </div>
      <div {...tabPanelProps('leave-view', view)} className="tab-panel">
        {view === 'requests' && <DataTable
          rows={requests}
          columns={columns}
          getRowId={(item) => item.id}
          caption="Leave requests"
          count={{ singular: 'request', plural: 'requests' }}
          initialSort={{ column: 'dates', direction: 'desc' }}
          filters={[{ id: 'status', label: 'Statuses', value: (item) => item.status }, { id: 'type', label: 'Types', value: (item) => item.type }]}
          exportName="my-leave-requests"
          empty={{ icon: CalendarRange, title: 'No leave requests yet', text: 'When you request time off, you can follow its approval here.', action: <button type="button" className="button button-primary button-small" onClick={() => setShowRequest(true)}><Plus aria-hidden="true" />New leave request</button> }}
        />}
        {view === 'balances' && <>
          <DataTable rows={balances} columns={balanceColumns} getRowId={(item) => item.type} caption={`Leave balances for ${thisYear}`} empty={{ icon: CalendarDays, title: 'No leave types', text: 'HR has not set up leave allowances yet.' }} />
          <p className="table-footnote">Balances reset each calendar year. Approved leave counts in the year it starts. Ask HR if a balance looks wrong.</p>
        </>}
        {view === 'calendar' && <MonthCalendar month={month} today={today} events={events} onMonthChange={setMonth} caption="Your leave and holidays" legend={[{ tone: 'green', label: 'Approved leave' }, { tone: 'amber', label: 'Pending leave' }, { tone: 'purple', label: 'Holiday' }]} />}
      </div>
    </section>

    {showRequest && <Modal title="Request leave" onClose={closeLeaveRequest} size="large">
      <form className="rf-form" onSubmit={submit} aria-busy={leaveSaving}>
        <div className="rf-intro">
          <p>Choose a leave type and your dates, then tell your approver why you need the time off. HR reviews every request before it is approved.</p>
          <div className="rf-balance"><span>{form.type} balance</span><strong>{describeBalance(selected)}</strong></div>
        </div>

        <div className="rf-layout">
          <div className="rf-fields">
            <section className="rf-section">
              <h3><span className="rf-step" aria-hidden="true">1</span>Choose a leave type</h3>
              <label className="rf-field">
                <span className="rf-label">Leave type</span>
                <select aria-label="Leave type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                <span className="rf-help">{leaveGuidance[form.type]}</span>
              </label>
            </section>

            <section className="rf-section">
              <h3><span className="rf-step" aria-hidden="true">2</span>Pick your dates</h3>
              <div className="rf-grid">
                <label className="rf-field"><span className="rf-label">Start date</span><input aria-label="Start date" type="date" min={today} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: event.target.value > form.endDate ? '' : form.endDate })} required /></label>
                <label className="rf-field"><span className="rf-label">End date</span><input aria-label="End date" type="date" min={form.startDate || today} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label>
              </div>
              <div className="rf-duration">
                <label><span>Duration</span><input aria-label="Calculated duration" value={days ? `${days} day${days === 1 ? '' : 's'}` : 'Select valid dates'} readOnly /></label>
                <Badge tone={days > 30 ? 'danger' : days ? 'success' : 'neutral'}>{days > 30 ? 'Over limit' : days ? 'Ready' : 'Waiting for dates'}</Badge>
              </div>
              {days > 0 && (nonWorking.weekends.length > 0 || nonWorking.holidays.length > 0) && <p className="rf-help rf-tip"><Info aria-hidden="true" />Your dates include {[nonWorking.weekends.length ? `${nonWorking.weekends.length} weekend day${nonWorking.weekends.length === 1 ? '' : 's'}` : '', nonWorking.holidays.length ? `${nonWorking.holidays.length} holiday${nonWorking.holidays.length === 1 ? '' : 's'} (${nonWorking.holidays.map((holiday) => holiday.name).join(', ')})` : ''].filter(Boolean).join(' and ')}. HR confirms how these are counted.</p>}
              {overlapping && <p className="rf-help rf-help--error" role="alert">These dates overlap your {overlapping.status.toLowerCase()} {overlapping.type.toLowerCase()} leave ({formatDate(overlapping.startDate)} – {formatDate(overlapping.endDate)}).</p>}
              {overBalance && days <= 30 && <p className="rf-help rf-tip" role="status"><Info aria-hidden="true" />This is more than your remaining {form.type.toLowerCase()} balance ({formatLeaveDays(selectedLeft ?? 0)}{selected?.pending ? ' after pending requests' : ''}). HR may approve the extra days as unpaid leave.</p>}
              {days > 30 && <p className="rf-error" role="alert">A single request may cover at most 30 calendar days. Please shorten the date range.</p>}
            </section>

            <section className="rf-section">
              <h3><span className="rf-step" aria-hidden="true">3</span>Add a reason</h3>
              <label className="rf-field">
                <span className="rf-label-row"><span className="rf-label">Reason</span><span className="rf-count">{form.reason.length}/500</span></span>
                <textarea aria-label="Reason" minLength={3} maxLength={500} rows={4} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="For example: Family event out of town" required />
              </label>
            </section>
          </div>

          <aside className="rf-summary" aria-label="Leave request preview">
            <h3>Request summary</h3>
            <dl>
              <div><dt>Leave type</dt><dd>{form.type}</dd></div>
              <div><dt>Dates</dt><dd>{form.startDate && form.endDate ? `${formatDate(form.startDate)} – ${formatDate(form.endDate)}` : form.startDate ? `From ${formatDate(form.startDate)}` : 'Not selected yet'}</dd></div>
              <div><dt>Duration</dt><dd>{days ? `${days} day${days === 1 ? '' : 's'}` : '—'}</dd></div>
              <div><dt>{form.type} balance</dt><dd>{describeBalance(selected)}</dd></div>
              {selected?.pending ? <div><dt>Already pending</dt><dd>{formatLeaveDays(selected.pending)}</dd></div> : null}
              <div><dt>Balance if approved</dt><dd>{selectedLeft == null ? 'Not tracked' : days ? formatLeaveDays(Math.max(0, selectedLeft - days)) : '—'}</dd></div>
              <div><dt>Status after sending</dt><dd><Badge tone="warning">Pending review</Badge></dd></div>
            </dl>
            <p className="rf-note"><ShieldCheck aria-hidden="true" /><span>Only you and authorized HR approvers can see this request. The decision appears in your leave history.</span></p>
          </aside>
        </div>

        <footer className="rf-footer">
          <p><Info aria-hidden="true" /><span>Approved leave is deducted from your {form.type.toLowerCase()} balance.</span></p>
          <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closeLeaveRequest} disabled={leaveSaving}>Cancel</button><button className="button button-primary" disabled={!requestReady || leaveSaving}>{leaveSaving ? 'Submitting…' : 'Submit leave request'}</button></div>
        </footer>
      </form>
    </Modal>}

    {cancelling && <ConfirmDialog
      title="Cancel leave request"
      heading={`Cancel your ${cancelling.type.toLowerCase()} leave?`}
      message={<p>{cancelling.startDate === cancelling.endDate ? formatDate(cancelling.startDate) : `${formatDate(cancelling.startDate)} – ${formatDate(cancelling.endDate)}`} · {formatLeaveDays(cancelling.days)}. {cancelling.status === 'Approved' ? 'This leave is already approved. Cancelling returns the days to your balance, and HR will see the change.' : 'HR will no longer review this request.'}</p>}
      confirmLabel="Cancel leave"
      cancelLabel="Keep leave"
      busyLabel="Cancelling…"
      tone="danger"
      icon={CalendarX2}
      onCancel={() => setCancelling(null)}
      onConfirm={async () => {
        await cancelLeave?.(cancelling.id)
        setCancelling(null)
      }}
    />}
  </div>
}
