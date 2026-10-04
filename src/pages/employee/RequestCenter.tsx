import { useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock3, FileCheck2, Info, Lightbulb, MessageSquareText, Plus, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Badge, ConfirmDialog, Modal, SectionHeading, StatCard } from '../../components/ui.js'
import { DataTable, type DataColumn } from '../../components/DataTable.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDate, formatDateTime, statusTone } from '../../utils/format.js'
import type { EmployeeRequestRecord } from '../../types/hrms.js'
import { openRequestStatuses, priorityTone, requestPriorities, requestRouting, requestTypes } from './shared.js'

interface RequestCenterProps {
  selectedId?: string | null
  newType?: string | null
  onSelect: (id: string | null) => void
  onCloseNew: () => void
}

const emptyForm = (type = 'Attendance Correction') => ({ type, subject: '', description: '', requestedDate: '', requestedValue: '', priority: 'Normal' })

export function RequestCenter({ selectedId, newType, onSelect, onCloseNew }: RequestCenterProps) {
  const { data, user, submitRequest, addRequestComment, cancelRequest } = useHrms()
  const initialType = newType && (requestTypes as readonly string[]).includes(newType) ? newType : 'Attendance Correction'
  const [showCreate, setShowCreate] = useState(Boolean(newType))
  const requestKey = useRef<string | null>(null)
  const [comment, setComment] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [form, setForm] = useState(() => emptyForm(initialType))
  if (!data || !user) return null
  const requests = data.employeeRequests.filter((item) => item.employeeId === user.id)
  const selected = requests.find((item) => item.id === selectedId)
  const comments = data.requestComments.filter((item) => item.requestId === selectedId && !item.internal)
  const routing = requestRouting[form.type] ?? requestRouting['General HR']
  const requestReady = form.subject.trim().length >= 3 && form.description.trim().length >= 3
  const openCount = requests.filter((item) => openRequestStatuses.includes(item.status)).length
  const replyCount = requests.filter((item) => item.status === 'More Information').length

  const closeCreate = () => {
    setShowCreate(false)
    onCloseNew()
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestKey.current ||= crypto.randomUUID()
    try {
      await submitRequest({ ...form, idempotencyKey: requestKey.current })
      requestKey.current = null
      setForm(emptyForm())
      closeCreate()
    } catch { /* Retain the request key for a safe retry. */ }
  }
  const respond = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!comment.trim() || !selectedId) return
    try { await addRequestComment(selectedId, comment, false); setComment('') } catch { /* Keep response text. */ }
  }

  const columns: DataColumn<EmployeeRequestRecord>[] = [
    { id: 'subject', header: 'Request', primary: true, cell: (item) => <span className="cell-stack"><strong>{item.subject}</strong><small>#{item.id} · {item.type}</small></span>, sortValue: (item) => item.subject },
    { id: 'type', header: 'Type', hideOnMobile: true, cell: (item) => item.type, sortValue: (item) => item.type },
    { id: 'priority', header: 'Priority', cell: (item) => <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>, sortValue: (item) => ({ Urgent: 0, High: 1, Normal: 2 }[item.priority] ?? 3), csv: (item) => item.priority },
    { id: 'updated', header: 'Last update', cell: (item) => formatDateTime(item.updatedAt), sortValue: (item) => item.updatedAt },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={statusTone(item.status)}>{item.status === 'More Information' ? 'Needs your reply' : item.status}</Badge>, sortValue: (item) => item.status },
  ]

  return (
    <div className="page-stack">
      <SectionHeading
        title="Request Center"
        description="Ask HR for corrections, documents, and answers, and follow every reply in one place."
        actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />New request</button>}
      />
      {requests.length > 0 && <div className="stats-grid stats-grid-3">
        <StatCard icon={Clock3} label="Open" value={openCount} detail="Being handled by HR" tone="blue" />
        <StatCard icon={MessageSquareText} label="Needs your reply" value={replyCount} detail={replyCount ? 'HR asked for more details' : 'Nothing waiting on you'} tone="amber" />
        <StatCard icon={CheckCircle2} label="Resolved" value={requests.filter((item) => ['Approved', 'Rejected', 'Completed'].includes(item.status)).length} detail="Decided or completed" tone="green" />
      </div>}
      <section className="panel">
        <div className="panel-header"><div><h2>My requests</h2><p>Select a request to see replies and the decision.</p></div></div>
        <DataTable
          rows={requests}
          columns={columns}
          getRowId={(item) => item.id}
          caption="My HR requests"
          count={{ singular: 'request', plural: 'requests' }}
          search={{ placeholder: 'Search requests', text: (item) => `${item.id} ${item.subject} ${item.description} ${item.type}` }}
          filters={[{ id: 'status', label: 'Statuses', value: (item) => item.status }, { id: 'type', label: 'Types', value: (item) => item.type }]}
          initialSort={{ column: 'updated', direction: 'desc' }}
          onRowClick={(item) => onSelect(item.id)}
          rowActionLabel={(item) => `Open request ${item.subject}`}
          empty={{ icon: FileCheck2, title: 'No HR requests yet', text: 'Use New request when you need a correction, a document, or an answer from HR.', action: <button type="button" className="button button-primary button-small" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />New request</button> }}
        />
      </section>

      {showCreate && <Modal title="Create an HR request" onClose={closeCreate} size="large">
        <form className="rf-form" onSubmit={submit}>
          <div className="rf-intro">
            <p>Tell HR what you need. Your request, HR’s replies, and the final decision stay together in one private case. All fields are required unless marked optional.</p>
          </div>

          <div className="rf-layout">
            <div className="rf-fields">
              <div className="rf-grid">
                <label className="rf-field rf-span-2">
                  <span className="rf-label">Request type</span>
                  <select aria-label="Request type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{requestTypes.map((type) => <option key={type}>{type}</option>)}</select>
                  <span className="rf-help rf-tip"><Lightbulb aria-hidden="true" />{routing.guidance}</span>
                </label>

                <fieldset className="rf-field rf-span-2 rf-choices">
                  <legend className="rf-label">Priority</legend>
                  <div>{requestPriorities.map((priority) => <label className={`rf-choice${form.priority === priority.value ? ' is-selected' : ''}`} key={priority.value}><input type="radio" name="request-priority" value={priority.value} checked={form.priority === priority.value} onChange={(event) => setForm({ ...form, priority: event.target.value })} /><span><strong>{priority.label}</strong><small>{priority.detail}</small></span></label>)}</div>
                </fieldset>

                <label className="rf-field rf-span-2">
                  <span className="rf-label-row"><span className="rf-label">Subject</span><span className="rf-count">{form.subject.length}/120</span></span>
                  <input aria-label="Subject" minLength={3} maxLength={120} placeholder="Summarize your request in one sentence" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required />
                </label>

                <label className="rf-field">
                  <span className="rf-label">Related date <span className="rf-optional">(optional)</span></span>
                  <input aria-label="Related date (optional)" type="date" value={form.requestedDate} onChange={(event) => setForm({ ...form, requestedDate: event.target.value })} />
                </label>

                <label className="rf-field">
                  <span className="rf-label">Requested value <span className="rf-optional">(optional)</span></span>
                  <input aria-label="Requested value (optional)" maxLength={240} placeholder="Example: Correct clock-out to 5:06 PM" value={form.requestedValue} onChange={(event) => setForm({ ...form, requestedValue: event.target.value })} />
                </label>

                <label className="rf-field rf-span-2">
                  <span className="rf-label-row"><span className="rf-label">Details</span><span className="rf-count">{form.description.length}/1000</span></span>
                  <textarea aria-label="Details" rows={6} minLength={3} maxLength={1000} placeholder="What happened, what the record shows now, and what you would like HR to do." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
                </label>
              </div>
            </div>

            <aside className="rf-summary" aria-label="HR request summary">
              <h3>Request summary</h3>
              <dl aria-live="polite">
                <div><dt>Request type</dt><dd>{form.type}</dd></div>
                <div><dt>Handled by</dt><dd>{routing.team}</dd></div>
                <div><dt>Priority</dt><dd><Badge tone={priorityTone(form.priority)}>{form.priority}</Badge></dd></div>
                <div><dt>Related date</dt><dd>{form.requestedDate ? formatDate(form.requestedDate) : 'Not specified'}</dd></div>
              </dl>
              <div className="rf-preview"><span>Preview</span><strong>{form.subject.trim() || 'Your subject will appear here'}</strong><p>{form.description.trim() || 'Clear, specific details help HR resolve your request without follow-up questions.'}</p></div>
              <p className="rf-note"><ShieldCheck aria-hidden="true" /><span>Only you and authorized HR staff can see this request. Every update is recorded.</span></p>
            </aside>
          </div>

          <footer className="rf-footer">
            <p><Info aria-hidden="true" /><span><strong>{requestReady ? 'Ready to submit.' : 'Complete the required fields.'}</strong> HR is notified as soon as you submit.</span></p>
            <div className="rf-actions"><button type="button" className="button button-secondary" onClick={closeCreate}>Cancel</button><button className="button button-primary" disabled={!requestReady}><Send aria-hidden="true" />Submit request</button></div>
          </footer>
        </form>
      </Modal>}

      {selected && !confirmCancel && <Modal title={`Request #${selected.id}`} onClose={() => onSelect(null)} size="large">
        <div className="request-detail">
          <div className="request-detail-head">
            <div><span className="request-detail-type">{selected.type}</span><h2>{selected.subject}</h2><p>{selected.description}</p></div>
            <Badge tone={statusTone(selected.status)}>{selected.status === 'More Information' ? 'Needs your reply' : selected.status}</Badge>
          </div>
          <dl className="detail-grid">
            <div><dt>Priority</dt><dd>{selected.priority}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
            <div><dt>Related date</dt><dd>{formatDate(selected.requestedDate)}</dd></div>
            <div><dt>Requested value</dt><dd>{selected.requestedValue || '—'}</dd></div>
          </dl>
          {selected.decisionNote && <div className="decision-note"><ShieldCheck aria-hidden="true" /><div><strong>Latest note from HR</strong><p>{selected.decisionNote}</p></div></div>}
          <div>
            <h3 className="request-detail-subtitle">Conversation</h3>
            <div className="timeline">
              {comments.map((item) => {
                const author = data.employees.find((employee) => employee.id === item.authorId)
                const mine = item.authorId === user.id
                return <article key={item.id} className={mine ? 'is-mine' : undefined}><span aria-hidden="true">{mine ? 'You' : author ? `${author.firstName[0]}${author.lastName[0]}` : 'HR'}</span><div><strong>{mine ? 'You' : author ? `${author.firstName} ${author.lastName}` : 'HR team'}</strong><p>{item.body}</p><time>{formatDateTime(item.createdAt)}</time></div></article>
              })}
              {comments.length === 0 && <p className="form-note">No replies yet. HR updates will appear here.</p>}
            </div>
          </div>
          {!['Cancelled', 'Completed', 'Rejected'].includes(selected.status) && <form className="inline-response" onSubmit={respond}>
            <label className="rf-label" htmlFor="request-response">{selected.status === 'More Information' ? 'Reply to HR' : 'Add a message'}</label>
            <textarea id="request-response" rows={3} maxLength={1000} placeholder="Add information or reply to HR…" value={comment} onChange={(event) => setComment(event.target.value)} required />
            <button className="button button-primary"><Send size={17} aria-hidden="true" />Send reply</button>
          </form>}
          <div className="modal-actions">
            {['Submitted', 'More Information'].includes(selected.status) && <button type="button" className="button button-secondary danger-text" onClick={() => setConfirmCancel(true)}><XCircle size={17} aria-hidden="true" />Cancel request</button>}
            <button type="button" className="button button-secondary" onClick={() => onSelect(null)}>Close</button>
          </div>
        </div>
      </Modal>}

      {selected && confirmCancel && <ConfirmDialog
        title="Cancel request"
        icon={XCircle}
        tone="danger"
        heading="Cancel this request?"
        message={<p>“{selected.subject}” will be closed and HR will stop working on it. You can submit a new request later.</p>}
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        busyLabel="Cancelling…"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={async () => { await cancelRequest(selected.id); setConfirmCancel(false); onSelect(null) }}
      />}
    </div>
  )
}
