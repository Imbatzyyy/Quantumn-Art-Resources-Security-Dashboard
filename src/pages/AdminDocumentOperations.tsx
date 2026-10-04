import { useState, type FormEvent } from 'react'
import { BellRing, FileCheck2, FileText, FolderLock, Plus, Send, ShieldCheck } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { Field, FormFooter, FormIntro, Note, SectionTitle, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { formatDateTime } from '../utils/format.js'
import { businessDate } from '../utils/securityMetrics.js'
import type { DocumentInput, HrmsSnapshot } from '../types/hrms.js'

const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminDocumentOperations() {
  const submission = useSubmissionLock()
  const { data, createDocument } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<DocumentInput>({ employeeId: '', title: '', type: 'Policy', period: `${new Date().getFullYear()}`, content: '', filename: '', version: '1.0', requiresAck: true, sensitive: false, expiresOn: '' })
  if (!data) return null
  const acknowledgedPairs = new Set(data.documentAcknowledgements.map((item) => `${item.documentId}:${item.employeeId}`))
  const activeEmployees = data.employees.filter((item) => item.role === 'employee' && ['Active', 'On Leave'].includes(item.status))
  const selectedEmployee = activeEmployees.find((item) => item.id === form.employeeId)
  const audienceLabel = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'All eligible employees'
  const targetCount = selectedEmployee ? 1 : activeEmployees.length
  const requiredCount = data.documents.reduce((count, document) => {
    if (!document.requiresAck || (document.expiresOn && document.expiresOn < businessDate())) return count
    const targets = document.employeeId ? [document.employeeId] : activeEmployees.map((item) => item.id)
    return count + targets.filter((employeeId) => !acknowledgedPairs.has(`${document.id}:${employeeId}`)).length
  }, 0)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (form.sensitive && !form.employeeId) {
      setFormError('Select a specific employee as the audience. Sensitive employee records cannot be published to everyone.')
      return
    }
    if (!submission.begin()) return
    try { await createDocument(form); setShowCreate(false); setForm({ ...form, title: '', content: '', filename: '', employeeId: '' }) } catch { /* Keep protected input. */ } finally { submission.finish() }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Policy lifecycle" title="Documents & Acknowledgements" description="Publish organization policies or employee-specific records and monitor acknowledgement completion." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />Publish document</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={FileText} label="Documents" value={data.documents.length} tone="blue" /><StatCard icon={FileCheck2} label="Acknowledgements due" value={requiredCount} tone="amber" /><StatCard icon={ShieldCheck} label="Sensitive documents" value={data.documents.filter((item) => item.sensitive).length} tone="purple" /></div>
    <section className="panel"><div className="panel-header"><div><h2>Document register</h2><p>Audience, version, sensitivity, and acknowledgement status</p></div></div>{data.documents.length ? <TableShell><thead><tr><th>Document</th><th>Audience</th><th>Version</th><th>Added</th><th>Acknowledgement</th><th>Classification</th></tr></thead><tbody>{data.documents.map((item) => { const targets = item.employeeId ? [item.employeeId] : activeEmployees.map((employee) => employee.id); const acknowledged = targets.filter((employeeId) => acknowledgedPairs.has(`${item.id}:${employeeId}`)).length; return <tr key={item.id}><td><strong>{item.title}</strong><small className="table-subtitle">{item.type} · {item.filename}</small></td><td>{item.employeeId ? personName(data, item.employeeId) : 'All active employees'}</td><td>{item.version}</td><td>{formatDateTime(item.createdAt)}</td><td>{item.requiresAck ? <Badge tone={acknowledged === targets.length ? 'success' : 'warning'}>{acknowledged}/{targets.length} acknowledged</Badge> : <Badge tone="neutral">Not required</Badge>}</td><td><Badge tone={item.sensitive ? 'warning' : 'info'}>{item.sensitive ? 'Sensitive' : 'Standard'}</Badge></td></tr> })}</tbody></TableShell> : <EmptyState icon={FolderLock} title="No documents" text="Publish a policy or employee record to begin." />}</section>
    {showCreate && <Modal title="Publish HR document" onClose={() => setShowCreate(false)} size="large">
      <form className="rf-form rf-form--lg" onSubmit={submit}>
        <FormIntro>Write the document, choose who receives it, and decide whether they must confirm they have read it. Recipients are notified when it is published.</FormIntro>

        <div className="rf-layout">
          <div className="rf-fields">
            {formError && <p className="rf-error" role="alert">{formError}</p>}
            <section className="rf-section">
              <SectionTitle step={1}>Document</SectionTitle>
              <Field label="Document title" count={`${form.title.length}/160`} help="The official title employees will see in their documents.">{(control) => <input {...control} minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Remote Work Security Policy" required />}</Field>
              <div className="rf-grid">
                <Field label="Filename">{(control) => <input {...control} placeholder="example-policy.txt" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} required />}</Field>
                <Field label="Version">{(control) => <input {...control} value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} required />}</Field>
              </div>
              <Field label="Document text" count={`${form.content.length.toLocaleString()}/10,000`} help="This text becomes the document employees download.">{(control) => <textarea {...control} rows={8} minLength={3} maxLength={10000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Write the document content employees will receive" required />}</Field>
            </section>

            <section className="rf-section">
              <SectionTitle step={2}>Audience and handling</SectionTitle>
              <div className="rf-grid">
                <Field label="Audience">{(control) => <select {...control} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}><option value="">All eligible employees</option>{activeEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select>}</Field>
                <Field label="Document type">{(control) => <select {...control} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['Policy', 'Payslip', 'Certificate', 'Contract', 'Memo', 'Tax', 'Other'].map((item) => <option key={item}>{item}</option>)}</select>}</Field>
                <Field label="Period">{(control) => <input {...control} value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} />}</Field>
                <Field label="Expiry" optional>{(control) => <input {...control} type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} />}</Field>
              </div>
              <fieldset className="rf-field rf-choices rf-choices--list">
                <legend className="rf-label">Document controls</legend>
                <div>
                  <label className="rf-choice"><input aria-label="Require employee acknowledgement" type="checkbox" checked={form.requiresAck} onChange={(event) => setForm({ ...form, requiresAck: event.target.checked })} /><span><strong>Require employee acknowledgement</strong><small>Each recipient confirms they have read it, and the date is recorded.</small></span></label>
                  <label className="rf-choice"><input aria-label="Sensitive employee record" type="checkbox" checked={form.sensitive} onChange={(event) => setForm({ ...form, sensitive: event.target.checked })} /><span><strong>Sensitive employee record</strong><small>For one employee only, with extra care in handling.</small></span></label>
                </div>
              </fieldset>
            </section>
          </div>

          <aside className="rf-summary" aria-label="Release summary">
            <h3>Release summary</h3>
            <div className="rf-preview"><span>{form.type} · Version {form.version || '1.0'}</span><strong>{form.title.trim() || 'Untitled HR document'}</strong></div>
            <SummaryList items={[
              ['Audience', audienceLabel],
              ['Recipients', targetCount],
              ['Acknowledgement', form.requiresAck ? 'Required' : 'Not required'],
              ['Classification', form.sensitive ? <Badge tone="warning">Sensitive</Badge> : 'Standard'],
            ]} />
            <Note icon={BellRing}>Recipients get a notification once the document is saved.</Note>
          </aside>
        </div>

        <FormFooter icon={ShieldCheck} note="Only the selected audience can open and download this document.">
          <button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="button button-primary" disabled={submission.busy}><Send aria-hidden="true" />Publish &amp; notify</button>
        </FormFooter>
      </form>
    </Modal>}
  </div>
}
