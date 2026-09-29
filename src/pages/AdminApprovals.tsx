import { useState, type FormEvent } from 'react'
import { CalendarCheck, Check, CheckCircle2, Eye, EyeOff, FileCheck2, LockKeyhole, MessageSquareText, Send, ShieldCheck, X } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime, statusTone } from '../utils/format.js'
import type { HrmsSnapshot } from '../types/hrms.js'

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
      <div className="rf-form rf-form--lg">
        <div className="rf-record-head">
          <div className="inline-badges"><span className="rf-tag">{selected.type}</span><Badge tone={selected.priority === 'Urgent' ? 'danger' : selected.priority === 'High' ? 'warning' : 'neutral'}>{selected.priority} priority</Badge><Badge tone={statusTone(selected.status)}>{selected.status}</Badge></div>
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
                    <button type="button" className={`rf-choice${internal ? ' is-selected' : ''}`} aria-pressed={internal} onClick={() => setInternal(true)}><EyeOff aria-hidden="true" /><span><strong>Private handoff</strong><small>Only authorized HR staff</small></span></button>
                  </div>
                </fieldset>
                <div className="rf-field">
                  <label className="rf-label" htmlFor="request-review-note">{internal ? 'Private HR handoff note' : 'Employee-visible response'}</label>
                  <textarea id="request-review-note" aria-describedby="request-review-note-help" rows={3} minLength={1} maxLength={1000} placeholder={internal ? 'Context for other HR reviewers' : 'Explain the update and what the employee should expect next'} value={comment} onChange={(event) => setComment(event.target.value)} required />
                  <p className="rf-help" id="request-review-note-help">{internal ? 'The employee cannot see this note.' : 'The employee is notified when you post this reply.'}</p>
                </div>
                <button className="button button-secondary">{internal ? <LockKeyhole aria-hidden="true" /> : <Send aria-hidden="true" />}{internal ? 'Save internal note' : 'Post employee response'}</button>
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

              <p className="rf-note"><Send aria-hidden="true" /><span>Saving updates the request, records you as the reviewer, keeps your reason, and notifies the employee.</span></p>
              <button className="button button-primary"><ShieldCheck aria-hidden="true" />Save decision &amp; notify</button>
            </form>
          </div>
        </div>

        <footer className="rf-footer">
          <p><LockKeyhole aria-hidden="true" /><span>Replies, private notes, and decisions are kept separately in the audit history.</span></p>
          <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closeReview}>Close review</button></div>
        </footer>
      </div>
    </Modal>}
  </div>
}
