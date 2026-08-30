import { useState, type FormEvent } from 'react'
import { CalendarCheck, Check, CheckCircle2, FileCheck2, MessageSquareText, X } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime, statusTone } from '../utils/format.js'
import type { HrmsSnapshot } from '../types/hrms.js'

const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
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

  const decide = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId) return
    try {
      await reviewRequest(selectedId, decision, reason)
      setReason('')
      if (['Approved', 'Rejected', 'Completed'].includes(decision)) setSelectedId(null)
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
    <section className="panel"><div className="panel-header"><div><h2>HR request queue</h2><p>Cross-functional requests with a shared conversation history</p></div></div>{requests.length ? <TableShell><thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Priority</th><th>Status</th><th /></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><strong>#{item.id} · {item.subject}</strong><small className="table-subtitle">{item.description}</small></td><td>{personName(data, item.employeeId)}</td><td>{item.type}</td><td><Badge tone={item.priority === 'Urgent' ? 'danger' : item.priority === 'High' ? 'warning' : 'neutral'}>{item.priority}</Badge></td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td><button className="text-button" onClick={() => { setSelectedId(item.id); setDecision(item.status === 'Submitted' ? 'Under Review' : item.status); setReason(item.decisionNote || '') }}>Review</button></td></tr>)}</tbody></TableShell> : <EmptyState icon={CheckCircle2} title="No HR request approvals" text="Employee requests will appear here." />}</section>
    {selected && <Modal title={`Review request #${selected.id}`} onClose={() => setSelectedId(null)} size="large"><div className="request-detail"><div className="request-detail-head"><div><span className="eyebrow">{selected.type} · {personName(data, selected.employeeId)}</span><h2>{selected.subject}</h2><p>{selected.description}</p></div><Badge tone={statusTone(selected.status)}>{selected.status}</Badge></div><dl className="detail-grid"><div><dt>Priority</dt><dd>{selected.priority}</dd></div><div><dt>Related date</dt><dd>{formatDate(selected.requestedDate)}</dd></div><div><dt>Requested value</dt><dd>{selected.requestedValue || '—'}</dd></div><div><dt>Submitted</dt><dd>{formatDateTime(selected.createdAt)}</dd></div></dl><div className="timeline">{comments.map((item) => <article key={item.id}><span>{item.internal ? 'IN' : 'HR'}</span><div><strong>{personName(data, item.authorId)}{item.internal ? ' · Internal note' : ''}</strong><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div></article>)}</div><form className="inline-response admin-response" onSubmit={addComment}><textarea rows={3} minLength={1} maxLength={1000} placeholder="Add a response or private handoff note…" value={comment} onChange={(event) => setComment(event.target.value)} required /><label className="check-label"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Internal note (hidden from employee)</label><button className="button button-secondary"><MessageSquareText />Add note</button></form><form className="decision-form" onSubmit={decide}><label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value)}><option>Under Review</option><option>More Information</option><option>Approved</option><option>Rejected</option><option>Completed</option></select></label><label>Decision reason<textarea rows={3} minLength={['More Information', 'Rejected'].includes(decision) ? 3 : 0} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain impact and the employee’s next step." required={['More Information', 'Rejected'].includes(decision)} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setSelectedId(null)}>Cancel</button><button className="button button-primary">Save decision & notify</button></div></form></div></Modal>}
  </div>
}
