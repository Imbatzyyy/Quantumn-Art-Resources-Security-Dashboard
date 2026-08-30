import { useState, type FormEvent } from 'react'
import { CalendarCheck, Check, CheckCircle2, Clock3, Eye, EyeOff, FileCheck2, LockKeyhole, MessageSquareText, Send, ShieldCheck, UserRound, X } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime, statusTone } from '../utils/format.js'
import type { HrmsSnapshot } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
const decisionOptions = [
  { value: 'Under Review', detail: 'Keep the case active while HR validates details.' },
  { value: 'More Information', detail: 'Ask the employee for a specific follow-up.' },
  { value: 'Approved', detail: 'Confirm the request is authorized to proceed.' },
  { value: 'Rejected', detail: 'Close the request with a clear explanation.' },
  { value: 'Completed', detail: 'Mark the requested work as fully delivered.' },
]
const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminApprovals() {
  const { data, reviewLeave, reviewRequest, addRequestComment } = useHrms()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [decision, setDecision] = useState('Under Review')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [internal, setInternal] = useState(false)
  if (!data) return null

  const pendingLeaves = data.leaveRequests.filter((item) => item.status === 'Pending')
  const requests = data.employeeRequests.filter((item) => openRequestStatuses.includes(item.status))
  const selected = data.employeeRequests.find((item) => item.id === selectedId)
  const comments = data.requestComments.filter((item) => item.requestId === selectedId)
  const selectedEmployee = data.employees.find((item) => item.id === selected?.employeeId)
  const decisionRequiresReason = ['More Information', 'Rejected'].includes(decision)
  const closeReview = () => {
    setSelectedId(null)
    setComment('')
    setInternal(false)
    setReason('')
  }

  const decide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    try {
      await reviewRequest(selectedId, decision, reason)
      setReason('')
      if (['Approved', 'Rejected', 'Completed'].includes(decision)) closeReview()
    } catch { /* Keep the protected decision form open. */ }
  }
  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    try { await addRequestComment(selectedId, comment, internal); setComment(''); setInternal(false) } catch { /* Keep the note for correction. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Explainable decisions" title="Unified Approvals" description="Review leave and HR requests with clear context, decision reasons, comments, and employee notifications." />
    <div className="stats-grid stats-grid-3"><StatCard icon={CalendarCheck} label="Leave decisions" value={pendingLeaves.length} tone="amber" /><StatCard icon={FileCheck2} label="HR request queue" value={requests.length} tone="blue" /><StatCard icon={MessageSquareText} label="Needs information" value={requests.filter((item) => item.status === 'More Information').length} tone="purple" /></div>
    <section className="panel"><div className="panel-header"><div><h2>Leave requests</h2><p>Dates, duration, and reason before each decision</p></div></div>{pendingLeaves.length ? <TableShell><thead><tr><th>Employee</th><th>Leave</th><th>Dates</th><th>Reason</th><th>Decision</th></tr></thead><tbody>{pendingLeaves.map((item) => <tr key={item.id}><td><strong>{personName(data, item.employeeId)}</strong><small className="table-subtitle">{item.employeeId}</small></td><td>{item.type} · {item.days} day{item.days === 1 ? '' : 's'}</td><td>{formatDate(item.startDate)}–{formatDate(item.endDate)}</td><td>{item.reason}</td><td><div className="table-actions"><button className="mini-button approve" onClick={() => void reviewLeave(item.id, 'Approved')}><Check />Approve</button><button className="mini-button reject" onClick={() => void reviewLeave(item.id, 'Rejected')}><X />Reject</button></div></td></tr>)}</tbody></TableShell> : <EmptyState icon={CheckCircle2} title="No leave approvals" text="New leave requests will appear here." />}</section>
    <section className="panel"><div className="panel-header"><div><h2>HR request queue</h2><p>Cross-functional requests with a shared conversation history</p></div></div>{requests.length ? <TableShell><thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>#{item.id} · {item.subject}</strong><small className="table-subtitle">{item.description}</small></td><td>{personName(data, item.employeeId)}</td><td>{item.type}</td><td><Badge tone={item.priority === 'Urgent' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge></td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td><button className="text-button" onClick={() => { setSelectedId(item.id); setDecision(item.status === 'Submitted' ? 'Under Review' : item.status); setReason(item.decisionNote || ''); setComment(''); setInternal(false) }}>Review</button></td></tr>)}</tbody></TableShell> : <EmptyState icon={CheckCircle2} title="No HR request approvals" text="Employee requests will appear here." />}</section>
    {selected && <Modal title={`Review request #${selected.id}`} onClose={closeReview} size="large">
      <div className="request-review-shell">
        <section className="request-review-hero">
          <span className="request-review-hero-icon"><FileCheck2 aria-hidden="true" /></span>
          <div>
            <small>{selected.type} · {personName(data, selected.employeeId)}</small>
            <h3>{selected.subject}</h3>
            <p>{selected.description}</p>
          </div>
          <div className="request-review-badges">
            <Badge tone={selected.priority === 'Urgent' ? 'danger' : selected.priority === 'High' ? 'warning' : 'neutral'}>{selected.priority} priority</Badge>
            <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
          </div>
        </section>

        <dl className="request-review-facts">
          <div><dt><UserRound aria-hidden="true" />Requester</dt><dd>{personName(data, selected.employeeId)}<small>{selectedEmployee?.department || selected.employeeId}</small></dd></div>
          <div><dt><CalendarCheck aria-hidden="true" />Related date</dt><dd>{formatDate(selected.requestedDate)}<small>Employee supplied</small></dd></div>
          <div><dt><FileCheck2 aria-hidden="true" />Requested value</dt><dd>{selected.requestedValue || 'Not specified'}<small>Requested outcome</small></dd></div>
          <div><dt><Clock3 aria-hidden="true" />Submitted</dt><dd>{formatDateTime(selected.createdAt)}<small>Original intake time</small></dd></div>
        </dl>

        <div className="request-review-workspace">
          <section className="request-conversation-card" aria-labelledby="request-conversation-title">
            <header className="request-workspace-heading">
              <span><MessageSquareText aria-hidden="true" /></span>
              <div><h4 id="request-conversation-title">Conversation & handoff</h4><p>Keep employee communication separate from private HR coordination.</p></div>
              <Badge tone="neutral">{comments.length} {comments.length === 1 ? 'note' : 'notes'}</Badge>
            </header>

            <div className="request-review-timeline">
              {comments.map((item) => <article key={item.id} className={item.internal ? 'internal' : ''}>
                <span>{item.internal ? <LockKeyhole aria-hidden="true" /> : <MessageSquareText aria-hidden="true" />}</span>
                <div><strong>{personName(data, item.authorId)}</strong><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div>
                <em>{item.internal ? 'HR only' : 'Employee visible'}</em>
              </article>)}
              {!comments.length && <div className="request-empty-conversation"><MessageSquareText aria-hidden="true" /><strong>No conversation yet</strong><p>The first response or internal handoff note will appear here.</p></div>}
            </div>

            <form className="request-note-composer" aria-label="Request conversation note" onSubmit={addComment}>
              <fieldset>
                <legend>Message visibility</legend>
                <div className="request-visibility-picker">
                  <button type="button" className={!internal ? 'active' : ''} aria-pressed={!internal} onClick={() => setInternal(false)}><Eye aria-hidden="true" /><span><strong>Employee response</strong><small>Visible and notified</small></span></button>
                  <button type="button" className={internal ? 'active private' : ''} aria-pressed={internal} onClick={() => setInternal(true)}><EyeOff aria-hidden="true" /><span><strong>Private handoff</strong><small>Authorized HR only</small></span></button>
                </div>
              </fieldset>
              <label htmlFor="request-review-note">{internal ? 'Private HR handoff note' : 'Employee-visible response'}</label>
              <textarea id="request-review-note" rows={3} minLength={1} maxLength={1000} placeholder={internal ? 'Add operational context for authorized HR reviewers…' : 'Explain the update and what the employee should expect next…'} value={comment} onChange={(event) => setComment(event.target.value)} required />
              <div className={`request-note-privacy ${internal ? 'private' : ''}`}>
                {internal ? <LockKeyhole aria-hidden="true" /> : <Send aria-hidden="true" />}
                <span>{internal ? 'This note is protected from the employee by request-comment RLS.' : 'The employee receives a notification when this response is posted.'}</span>
              </div>
              <button className="button button-secondary">{internal ? <LockKeyhole aria-hidden="true" /> : <Send aria-hidden="true" />}{internal ? 'Save internal note' : 'Post employee response'}</button>
            </form>
          </section>

          <form className="request-decision-card" aria-labelledby="request-decision-title" onSubmit={decide}>
            <header className="request-workspace-heading">
              <span><ShieldCheck aria-hidden="true" /></span>
              <div><h4 id="request-decision-title">Decision & employee impact</h4><p>Select an accountable outcome and explain the next step.</p></div>
            </header>

            <fieldset className="request-decision-picker">
              <legend>Decision</legend>
              <div>{decisionOptions.map((option) => <label key={option.value} className={decision === option.value ? `active decision-${option.value.toLowerCase().replaceAll(' ', '-')}` : ''}>
                <input type="radio" name="request-decision" value={option.value} checked={decision === option.value} onChange={(event) => setDecision(event.target.value)} />
                <span><CheckCircle2 aria-hidden="true" /></span>
                <div><strong>{option.value}</strong><small>{option.detail}</small></div>
              </label>)}</div>
            </fieldset>

            <div className="request-decision-reason">
              <label htmlFor="request-decision-reason">Decision reason {decisionRequiresReason && <em>Required</em>}</label>
              <textarea id="request-decision-reason" rows={4} minLength={decisionRequiresReason ? 3 : 0} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the impact and the employee’s next step…" required={decisionRequiresReason} />
              <small>{decisionRequiresReason ? 'A clear explanation is required for this outcome.' : 'Recommended for a transparent, usable decision history.'}</small>
            </div>

            <div className="request-decision-notice">
              <Send aria-hidden="true" />
              <div><strong>Employee notification included</strong><p>Saving updates the Supabase request record, assigns the reviewer, preserves the reason, and notifies the employee.</p></div>
            </div>
            <button className="button button-primary request-save-decision"><ShieldCheck aria-hidden="true" />Save decision & notify</button>
          </form>
        </div>

        <footer className="request-review-footer">
          <div><LockKeyhole aria-hidden="true" /><p><strong>Role-protected workflow.</strong> Public replies, private notes, and decisions remain separate in the audit history.</p></div>
          <button type="button" className="button button-secondary" onClick={closeReview}>Close review</button>
        </footer>
      </div>
    </Modal>}
  </div>
}
