import { useState, type FormEvent } from 'react'
import { CalendarCheck, Check, CheckCircle2, Eye, EyeOff, FileCheck2, History, LockKeyhole, MessageSquareText, Send, ShieldCheck, SlidersHorizontal, Users, X } from 'lucide-react'
import { Badge, ConfirmDialog, Modal, SectionHeading, StatCard, Tabs } from '../components/ui.js'
import { tabPanelProps } from '../components/tabPanel.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime, statusTone } from '../utils/format.js'
import type { EmployeeRequestRecord, HrmsSnapshot, LeaveRequestRecord } from '../types/hrms.js'
import { balanceFor as leaveBalanceFor, formatLeaveDays, leaveBalances, leavePoliciesOf } from '../utils/leave.js'
import { LeaveAllowancesDialog } from './LeaveAllowancesDialog.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const decisionOptions = [
  { value: 'Under Review', detail: 'Keep it open while HR checks the details' },
  { value: 'More Information', detail: 'Ask the employee for something specific' },
  { value: 'Approved', detail: 'The request can go ahead' },
  { value: 'Rejected', detail: 'Close the request and explain why' },
  { value: 'Completed', detail: 'The requested work is done' },
]
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}
const priorityTone = (priority: string) => priority === 'Urgent' ? 'danger' : priority === 'High' ? 'warning' : 'neutral'
type View = 'leave' | 'requests' | 'history'
type LeaveDecision = { requests: LeaveRequestRecord[]; status: 'Approved' | 'Rejected' }
type HistoryRow = { id: string; employeeId: string; kind: string; item: string; status: string; when: string; sort: string; note?: string }

interface AdminApprovalsProps {
  view?: string | null
  requestId?: string | null
  onViewChange?: (view: string | null) => void
  onRequestChange?: (id: string | null) => void
}

export default function AdminApprovals({ view: routeView, requestId, onViewChange, onRequestChange }: AdminApprovalsProps = {}) {
  const { data, user, reviewLeave, reviewRequest, addRequestComment, saveLeavePolicy } = useHrms()
  const [localView, setLocalView] = useState<View | null>(null)
  const [localRequest, setLocalRequest] = useState<string | null>(null)
  const [decision, setDecision] = useState('Under Review')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)
  const [leaveDecision, setLeaveDecision] = useState<LeaveDecision | null>(null)
  const [leaveNote, setLeaveNote] = useState('')
  const [editingAllowances, setEditingAllowances] = useState(false)
  if (!data) return null
  const canEditAllowances = Boolean(saveLeavePolicy) && ['admin', 'hr_admin'].includes(user?.role ?? '')
  const policies = leavePoliciesOf(data)

  const pendingLeaves = data.leaveRequests.filter((item) => item.status === 'Pending')
  const requests = data.employeeRequests.filter((item) => openRequestStatuses.includes(item.status))
  const defaultView: View = pendingLeaves.length || !requests.length ? 'leave' : 'requests'
  const view: View = (['leave', 'requests', 'history'] as const).find((item) => item === (onViewChange ? routeView : localView)) ?? defaultView
  const setView = (next: View) => onViewChange ? onViewChange(next) : setLocalView(next)
  const selectedId = onRequestChange ? requestId ?? null : localRequest
  const selected = data.employeeRequests.find((item) => item.id === selectedId)
  const comments = data.requestComments.filter((item) => item.requestId === selectedId)
  const selectedEmployee = data.employees.find((item) => item.id === selected?.employeeId)
  const decisionRequiresReason = ['More Information', 'Rejected'].includes(decision)

  const openRequest = (item: EmployeeRequestRecord) => {
    setDecision(item.status === 'Submitted' ? 'Under Review' : item.status)
    setReason(item.decisionNote || '')
    setComment('')
    setInternal(false)
    if (onRequestChange) onRequestChange(item.id)
    else setLocalRequest(item.id)
  }
  const closeReview = () => {
    setComment('')
    setInternal(false)
    setReason('')
    if (onRequestChange) onRequestChange(null)
    else setLocalRequest(null)
  }

  const decide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    try {
      await reviewRequest(selectedId, decision, reason)
      setReason('')
      if (['Approved', 'Rejected', 'Completed'].includes(decision)) closeReview()
    } catch { /* Keep the decision form open. */ }
  }
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    try { await addRequestComment(selectedId, comment, internal); setComment(''); setInternal(false) } catch { /* Keep the note for correction. */ }
  }
  const openLeaveDecision = (next: LeaveDecision) => {
    setLeaveNote('')
    setLeaveDecision(next)
  }
  const applyLeaveDecision = async () => {
    if (!leaveDecision) return
    for (const request of leaveDecision.requests) await reviewLeave(request.id, leaveDecision.status, leaveNote.trim() || undefined)
    setLeaveDecision(null)
    setLeaveNote('')
  }
  const rejectNeedsNote = leaveDecision?.status === 'Rejected' && leaveNote.trim().length < 3

  /** Days left of the request's leave type in the year the leave starts; null when not tracked. */
  const balanceFor = (request: LeaveRequestRecord) => leaveBalanceFor(leaveBalances(policies, data.leaveRequests, request.employeeId, request.startDate.slice(0, 4)), request.type)?.remaining ?? null
  const overlapsFor = (request: LeaveRequestRecord) => {
    const department = data.employees.find((item) => item.id === request.employeeId)?.department
    return data.leaveRequests.filter((item) => item.id !== request.id && item.employeeId !== request.employeeId && ['Approved', 'Pending'].includes(item.status) && item.startDate <= request.endDate && item.endDate >= request.startDate && data.employees.find((employee) => employee.id === item.employeeId)?.department === department)
  }

  const leaveColumns: DataColumn<LeaveRequestRecord>[] = [
    { id: 'employee', header: 'Employee', primary: true, cell: (item) => <span className="cell-stack"><strong>{personName(data, item.employeeId)}</strong><small>{data.employees.find((employee) => employee.id === item.employeeId)?.department ?? item.employeeId}</small></span>, sortValue: (item) => personName(data, item.employeeId) },
    { id: 'leave', header: 'Leave', cell: (item) => <span className="cell-stack"><span>{item.type}</span><small>{item.days} day{item.days === 1 ? '' : 's'}</small></span>, sortValue: (item) => item.type, csv: (item) => `${item.type} (${item.days} days)` },
    { id: 'dates', header: 'Dates', cell: (item) => item.startDate === item.endDate ? formatDate(item.startDate) : `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`, sortValue: (item) => item.startDate },
    { id: 'balance', header: 'Balance', hideOnMobile: true, cell: (item) => { const balance = balanceFor(item); return balance == null ? <span className="text-muted">Case by case</span> : <span className={balance < item.days ? 'text-danger' : undefined}>{formatLeaveDays(balance)} left{balance < item.days ? ' · not enough' : ''}</span> }, sortValue: (item) => balanceFor(item) ?? Number.MAX_SAFE_INTEGER, csv: (item) => balanceFor(item) ?? 'Case by case' },
    { id: 'overlap', header: 'Team overlap', hideOnMobile: true, cell: (item) => { const overlaps = overlapsFor(item); return overlaps.length ? <span className="cell-stack"><Badge tone="warning">{overlaps.length} also off</Badge><small>{overlaps.slice(0, 2).map((other) => personName(data, other.employeeId).split(' ')[0]).join(', ')}</small></span> : <span className="text-muted">None</span> }, sortValue: (item) => overlapsFor(item).length },
    { id: 'reason', header: 'Reason', hideOnMobile: true, cell: (item) => <span className="cell-clamp">{item.reason}</span>, csv: (item) => item.reason },
    { id: 'actions', header: '', align: 'end', cell: (item) => <div className="table-actions"><button className="mini-button approve" onClick={() => openLeaveDecision({ requests: [item], status: 'Approved' })}><Check aria-hidden="true" />Approve</button><button className="mini-button reject" onClick={() => openLeaveDecision({ requests: [item], status: 'Rejected' })}><X aria-hidden="true" />Reject</button></div> },
  ]
  const requestColumns: DataColumn<EmployeeRequestRecord>[] = [
    { id: 'subject', header: 'Request', primary: true, cell: (item) => <span className="cell-stack"><strong>{item.subject}</strong><small>#{item.id} · {item.type}</small></span>, sortValue: (item) => item.subject },
    { id: 'employee', header: 'Employee', cell: (item) => personName(data, item.employeeId), sortValue: (item) => personName(data, item.employeeId) },
    { id: 'priority', header: 'Priority', cell: (item) => <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>, sortValue: (item) => ({ Urgent: 0, High: 1, Normal: 2 }[item.priority] ?? 3), csv: (item) => item.priority },
    { id: 'submitted', header: 'Submitted', hideOnMobile: true, cell: (item) => formatDateTime(item.createdAt), sortValue: (item) => item.createdAt },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status}</Badge>, sortValue: (item) => item.status },
  ]
  const history: HistoryRow[] = [
    ...data.leaveRequests.filter((item) => item.status !== 'Pending').map((item) => ({ id: `leave-${item.id}`, employeeId: item.employeeId, kind: 'Leave', item: `${item.type} leave · ${formatDate(item.startDate)} – ${formatDate(item.endDate)}`, status: item.status, when: formatDate(item.startDate), sort: item.startDate, note: item.status === 'Cancelled' ? 'Cancelled by the employee' : item.decisionNote })),
    ...data.employeeRequests.filter((item) => !openRequestStatuses.includes(item.status)).map((item) => ({ id: `request-${item.id}`, employeeId: item.employeeId, kind: item.type, item: item.subject, status: item.status, when: formatDateTime(item.updatedAt), sort: item.updatedAt, note: item.decisionNote })),
  ]
  const historyColumns: DataColumn<HistoryRow>[] = [
    { id: 'employee', header: 'Employee', primary: true, cell: (item) => <strong>{personName(data, item.employeeId)}</strong>, sortValue: (item) => personName(data, item.employeeId) },
    { id: 'item', header: 'Item', cell: (item) => <span className="cell-stack"><span>{item.item}</span><small>{item.kind}</small></span>, sortValue: (item) => item.item },
    { id: 'when', header: 'Date', cell: (item) => item.when, sortValue: (item) => item.sort, csv: (item) => item.when },
    { id: 'status', header: 'Decision', cell: (item) => <span className="cell-stack"><Badge tone={statusTone(item.status)}>{item.status}</Badge>{item.note && <small className="cell-note">{item.note}</small>}</span>, sortValue: (item) => item.status, csv: (item) => item.status },
    { id: 'note', header: 'Note', exportOnly: true, cell: (item) => item.note ?? '', csv: (item) => item.note ?? '' },
  ]

  return <div className="page-stack">
    <SectionHeading
      title="Approvals"
      description="Decide on leave and HR requests. Employees are notified of every decision."
      actions={canEditAllowances ? <button type="button" className="button button-secondary" onClick={() => setEditingAllowances(true)}><SlidersHorizontal aria-hidden="true" />Leave allowances</button> : undefined}
    />
    <div className="stats-grid stats-grid-3">
      <StatCard icon={CalendarCheck} label="Leave waiting" value={pendingLeaves.length} detail={`${pendingLeaves.reduce((sum, item) => sum + item.days, 0)} days requested`} tone="amber" onClick={() => setView('leave')} />
      <StatCard icon={FileCheck2} label="HR requests open" value={requests.length} detail={`${requests.filter((item) => item.priority === 'Urgent').length} urgent`} tone="blue" onClick={() => setView('requests')} />
      <StatCard icon={MessageSquareText} label="Waiting on employee" value={requests.filter((item) => item.status === 'More Information').length} detail="Asked for more information" tone="purple" onClick={() => setView('requests')} />
    </div>

    <section className="panel">
      <div className="panel-header panel-header-tabs">
        <Tabs idPrefix="approvals" label="Approval queues" tabs={[{ id: 'leave', label: 'Leave', icon: CalendarCheck, count: pendingLeaves.length }, { id: 'requests', label: 'HR requests', icon: FileCheck2, count: requests.length }, { id: 'history', label: 'History', icon: History }]} active={view} onChange={setView} />
      </div>
      <div {...tabPanelProps('approvals', view)} className="tab-panel">
        {view === 'leave' && <DataTable
          rows={pendingLeaves}
          columns={leaveColumns}
          getRowId={(item) => item.id}
          caption="Leave requests waiting for a decision"
          count={{ singular: 'leave request', plural: 'leave requests' }}
          search={{ placeholder: 'Search by employee', text: (item) => `${personName(data, item.employeeId)} ${item.employeeId} ${item.reason}` }}
          filters={[{ id: 'type', label: 'Leave types', value: (item) => item.type }, { id: 'department', label: 'Departments', value: (item) => data.employees.find((employee) => employee.id === item.employeeId)?.department ?? '' }]}
          initialSort={{ column: 'dates', direction: 'asc' }}
          rowActionLabel={(item) => `${personName(data, item.employeeId)} ${item.type} leave`}
          selection={{ actions: (rows, clear) => <><button type="button" className="button button-primary button-small" onClick={() => { openLeaveDecision({ requests: rows, status: 'Approved' }); clear() }}><Check aria-hidden="true" />Approve {rows.length}</button><button type="button" className="button button-secondary button-small danger-text" onClick={() => { openLeaveDecision({ requests: rows, status: 'Rejected' }); clear() }}><X aria-hidden="true" />Reject {rows.length}</button></> }}
          empty={{ icon: CheckCircle2, title: 'No leave waiting', text: 'New leave requests will appear here.' }}
        />}
        {view === 'requests' && <DataTable
          rows={requests}
          columns={requestColumns}
          getRowId={(item) => item.id}
          caption="HR requests waiting for review"
          count={{ singular: 'request', plural: 'requests' }}
          search={{ placeholder: 'Search requests', text: (item) => `${item.id} ${item.subject} ${item.description} ${personName(data, item.employeeId)}` }}
          filters={[{ id: 'type', label: 'Types', value: (item) => item.type }, { id: 'priority', label: 'Priorities', value: (item) => item.priority }, { id: 'status', label: 'Statuses', value: (item) => item.status }]}
          initialSort={{ column: 'priority', direction: 'asc' }}
          onRowClick={openRequest}
          rowActionLabel={(item) => `Review ${item.subject}`}
          empty={{ icon: CheckCircle2, title: 'No open HR requests', text: 'Employee requests will appear here.' }}
        />}
        {view === 'history' && <DataTable
          rows={history}
          columns={historyColumns}
          getRowId={(item) => item.id}
          caption="Decided leave and HR requests"
          count={{ singular: 'decision', plural: 'decisions' }}
          search={{ placeholder: 'Search history', text: (item) => `${personName(data, item.employeeId)} ${item.item} ${item.kind} ${item.note ?? ''}` }}
          filters={[{ id: 'status', label: 'Decisions', value: (item) => item.status }, { id: 'kind', label: 'Types', value: (item) => item.kind }]}
          initialSort={{ column: 'when', direction: 'desc' }}
          exportName="approval-history"
          empty={{ icon: History, title: 'No decisions yet', text: 'Approved, rejected, and completed requests will appear here.' }}
        />}
      </div>
    </section>

    {leaveDecision && <ConfirmDialog
      title={leaveDecision.status === 'Approved' ? 'Approve leave' : 'Reject leave'}
      icon={leaveDecision.status === 'Approved' ? Check : X}
      tone={leaveDecision.status === 'Approved' ? 'primary' : 'danger'}
      heading={leaveDecision.requests.length === 1
        ? `${leaveDecision.status === 'Approved' ? 'Approve' : 'Reject'} ${personName(data, leaveDecision.requests[0].employeeId)}’s ${leaveDecision.requests[0].type.toLowerCase()} leave?`
        : `${leaveDecision.status === 'Approved' ? 'Approve' : 'Reject'} ${leaveDecision.requests.length} leave requests?`}
      message={<>
        <ul className="confirm-list">{leaveDecision.requests.slice(0, 5).map((item) => <li key={item.id}><strong>{personName(data, item.employeeId)}</strong> · {item.type} · {formatDate(item.startDate)} – {formatDate(item.endDate)} ({item.days} day{item.days === 1 ? '' : 's'})</li>)}{leaveDecision.requests.length > 5 && <li>and {leaveDecision.requests.length - 5} more</li>}</ul>
        <p>{leaveDecision.status === 'Approved' ? `Approved days are deducted from ${leaveDecision.requests.length === 1 ? 'their' : 'each employee’s'} leave balance.` : 'Rejected leave is not deducted from the balance.'} {leaveDecision.requests.length === 1 ? 'The employee is' : 'Each employee is'} notified{leaveNote.trim() ? ' with your note' : ''}.</p>
      </>}
      confirmLabel={leaveDecision.status === 'Approved' ? `Approve${leaveDecision.requests.length > 1 ? ` ${leaveDecision.requests.length}` : ''}` : `Reject${leaveDecision.requests.length > 1 ? ` ${leaveDecision.requests.length}` : ''}`}
      busyLabel="Saving decisions…"
      confirmDisabled={rejectNeedsNote}
      onCancel={() => setLeaveDecision(null)}
      onConfirm={applyLeaveDecision}
    >
      <div className="rf-field confirm-dialog-field">
        <div className="rf-label-row"><label className="rf-label" htmlFor="leave-decision-note">{leaveDecision.status === 'Rejected' ? 'Reason for the employee' : 'Note to the employee'}</label><span className="rf-count">{leaveNote.length}/500</span></div>
        <textarea id="leave-decision-note" aria-describedby="leave-decision-note-help" rows={3} maxLength={500} value={leaveNote} onChange={(event) => setLeaveNote(event.target.value)} placeholder={leaveDecision.status === 'Rejected' ? 'For example: The team is short-staffed that week. Could you choose other dates?' : 'Optional. For example: Enjoy your break.'} required={leaveDecision.status === 'Rejected'} />
        <p className="rf-help" id="leave-decision-note-help">{leaveDecision.status === 'Rejected' ? 'Required. The employee sees this reason with the decision.' : 'Optional. The employee sees this note with the decision.'}</p>
      </div>
    </ConfirmDialog>}

    {editingAllowances && saveLeavePolicy && <LeaveAllowancesDialog policies={policies} onSave={saveLeavePolicy} onClose={() => setEditingAllowances(false)} />}

    {selected && <Modal title={`Review request #${selected.id}`} onClose={closeReview} size="large">
      <div className="rf-form rf-form--lg">
        <div className="rf-record-head">
          <div className="inline-badges"><span className="rf-tag">{selected.type}</span><Badge tone={priorityTone(selected.priority)}>{selected.priority} priority</Badge><Badge tone={statusTone(selected.status)}>{selected.status}</Badge></div>
          <h3>{selected.subject}</h3>
          <p>{selected.description}</p>
        </div>

        <div className="rf-single">
          <dl className="rf-facts">
            <div><dt>Requested by</dt><dd>{personName(data, selected.employeeId)}<small>{selectedEmployee?.department || selected.employeeId}</small></dd></div>
            <div><dt>Related date</dt><dd>{formatDate(selected.requestedDate)}</dd></div>
            <div><dt>Requested change</dt><dd>{selected.requestedValue || 'Not specified'}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
          </dl>

          <div className="rf-columns">
            <section className="rf-panel" aria-labelledby="request-conversation-title">
              <div className="rf-panel-head"><h3 id="request-conversation-title">Conversation</h3><Badge tone="neutral">{comments.length} {comments.length === 1 ? 'message' : 'messages'}</Badge></div>
              <p className="rf-help">Replies to the employee and private HR notes are kept separate.</p>

              <div className="rf-timeline">
                {comments.map((item) => <article key={item.id} className={item.internal ? 'is-private' : ''}>
                  <span>{item.internal ? <LockKeyhole aria-hidden="true" /> : <MessageSquareText aria-hidden="true" />}</span>
                  <div><div className="rf-timeline-meta"><strong>{personName(data, item.authorId)}</strong><span className={`rf-tag ${item.internal ? 'rf-tag--private' : 'rf-tag--visible'}`}>{item.internal ? 'HR only' : 'Employee sees'}</span></div><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div>
                </article>)}
                {!comments.length && <div className="rf-empty"><MessageSquareText aria-hidden="true" /><strong>No messages yet</strong><p>Your first reply or private note will appear here.</p></div>}
              </div>

              <form className="rf-fields" aria-label="Request conversation note" onSubmit={addComment}>
                <fieldset className="rf-field rf-choices rf-choices--2">
                  <legend className="rf-label">Who can see your message?</legend>
                  <div>
                    <button type="button" className={`rf-choice${!internal ? ' is-selected' : ''}`} aria-pressed={!internal} onClick={() => setInternal(false)}><Eye aria-hidden="true" /><span><strong>Employee response</strong><small>The employee sees it and is notified</small></span></button>
                    <button type="button" className={`rf-choice${internal ? ' is-selected' : ''}`} aria-pressed={internal} onClick={() => setInternal(true)}><EyeOff aria-hidden="true" /><span><strong>Private HR note</strong><small>Only authorized HR staff</small></span></button>
                  </div>
                </fieldset>
                <div className="rf-field">
                  <label className="rf-label" htmlFor="request-review-note">{internal ? 'Private HR note' : 'Reply to the employee'}</label>
                  <textarea id="request-review-note" aria-describedby="request-review-note-help" rows={3} minLength={1} maxLength={1000} placeholder={internal ? 'Context for other HR reviewers' : 'Explain the update and what the employee should expect next'} value={comment} onChange={(event) => setComment(event.target.value)} required />
                  <p className="rf-help" id="request-review-note-help">{internal ? 'The employee cannot see this note.' : 'The employee is notified when you send this reply.'}</p>
                </div>
                <button className="button button-secondary">{internal ? <LockKeyhole aria-hidden="true" /> : <Send aria-hidden="true" />}{internal ? 'Save private note' : 'Send reply'}</button>
              </form>
            </section>

            <form className="rf-panel" aria-labelledby="request-decision-title" onSubmit={decide}>
              <div className="rf-panel-head"><h3 id="request-decision-title">Decision</h3></div>
              <fieldset className="rf-field rf-choices rf-choices--list">
                <legend className="rf-label">Choose an outcome</legend>
                <div>{decisionOptions.map((option) => <label key={option.value} className={`rf-choice${decision === option.value ? ' is-selected' : ''}`}>
                  <input type="radio" name="request-decision" value={option.value} checked={decision === option.value} onChange={(event) => setDecision(event.target.value)} />
                  <span><strong>{option.value}</strong><small>{option.detail}</small></span>
                </label>)}</div>
              </fieldset>

              <div className="rf-field">
                <div className="rf-label-row"><label className="rf-label" htmlFor="request-decision-reason">Decision reason</label>{decisionRequiresReason && <span className="rf-status rf-status--editing">Required</span>}</div>
                <textarea id="request-decision-reason" aria-describedby="request-decision-reason-help" rows={4} minLength={decisionRequiresReason ? 3 : 0} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the outcome and the employee’s next step" required={decisionRequiresReason} />
                <p className="rf-help" id="request-decision-reason-help">{decisionRequiresReason ? 'A clear explanation is required for this outcome.' : 'Recommended, so the employee understands the decision.'}</p>
              </div>

              <p className="rf-note"><Users aria-hidden="true" /><span>Saving updates the request, records you as the reviewer, keeps your reason, and notifies the employee.</span></p>
              <button className="button button-primary"><ShieldCheck aria-hidden="true" />Save decision</button>
            </form>
          </div>
        </div>

        <footer className="rf-footer">
          <p><LockKeyhole aria-hidden="true" /><span>Replies, private notes, and decisions are kept in the request history.</span></p>
          <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closeReview}>Close</button></div>
        </footer>
      </div>
    </Modal>}
  </div>
}
