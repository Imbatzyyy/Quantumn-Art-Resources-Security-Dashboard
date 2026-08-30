import { useState, type FormEvent } from 'react'
import { BellRing, CalendarDays, CheckCircle2, FileCheck2, FileKey2, FileText, FolderLock, LockKeyhole, Plus, Send, ShieldCheck, Sparkles, Tags, UsersRound } from 'lucide-react'
import { Badge, EmptyState, Modal, SectionHeading, StatCard, TableShell } from '../components/ui.js'
import { useHrms } from '../state/useHrms.js'
import { formatDateTime } from '../utils/format.js'
import type { DocumentInput, HrmsSnapshot } from '../types/hrms.js'

const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminDocumentOperations() {
  const { data, createDocument } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<DocumentInput>({ employeeId: '', title: '', type: 'Policy', period: `${new Date().getFullYear()}`, content: '', filename: '', version: '1.0', requiresAck: true, sensitive: false, expiresOn: '' })
  if (!data) return null
  const acknowledgedPairs = new Set(data.documentAcknowledgements.map((item) => `${item.documentId}:${item.employeeId}`))
  const activeEmployees = data.employees.filter((item) => item.role === 'employee' && ['Active', 'On Leave'].includes(item.status))
  const selectedEmployee = activeEmployees.find((item) => item.id === form.employeeId)
  const audienceLabel = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'All eligible employees'
  const targetCount = selectedEmployee ? 1 : activeEmployees.length
  const requiredCount = data.documents.reduce((count, document) => {
    if (!document.requiresAck) return count
    const targets = document.employeeId ? [document.employeeId] : activeEmployees.map((item) => item.id)
    return count + targets.filter((employeeId) => !acknowledgedPairs.has(`${document.id}:${employeeId}`)).length
  }, 0)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try { await createDocument(form); setShowCreate(false); setForm({ ...form, title: '', content: '', filename: '', employeeId: '' }) } catch { /* Keep protected input. */ }
  }

  return <div className="page-stack">
    <SectionHeading eyebrow="Policy lifecycle" title="Documents & Acknowledgements" description="Publish organization policies or employee-specific records and monitor acknowledgement completion." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus />Publish document</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={FileText} label="Documents" value={data.documents.length} tone="blue" /><StatCard icon={FileCheck2} label="Acknowledgements due" value={requiredCount} tone="amber" /><StatCard icon={ShieldCheck} label="Sensitive documents" value={data.documents.filter((item) => item.sensitive).length} tone="purple" /></div>
    <section className="panel"><div className="panel-header"><div><h2>Document register</h2><p>Audience, version, sensitivity, and acknowledgement status</p></div></div>{data.documents.length ? <TableShell><thead><tr><th>Document</th><th>Audience</th><th>Version</th><th>Added</th><th>Acknowledgement</th><th>Classification</th></tr></thead><tbody>{data.documents.map((item) => { const targets = item.employeeId ? [item.employeeId] : activeEmployees.map((employee) => employee.id); const acknowledged = targets.filter((employeeId) => acknowledgedPairs.has(`${item.id}:${employeeId}`)).length; return <tr key={item.id}><td><strong>{item.title}</strong><small className="table-subtitle">{item.type} · {item.filename}</small></td><td>{item.employeeId ? personName(data, item.employeeId) : 'All active employees'}</td><td>{item.version}</td><td>{formatDateTime(item.createdAt)}</td><td>{item.requiresAck ? <Badge tone={acknowledged === targets.length ? 'success' : 'warning'}>{acknowledged}/{targets.length} acknowledged</Badge> : <Badge tone="neutral">Not required</Badge>}</td><td><Badge tone={item.sensitive ? 'warning' : 'info'}>{item.sensitive ? 'Sensitive' : 'Standard'}</Badge></td></tr> })}</tbody></TableShell> : <EmptyState icon={FolderLock} title="No documents" text="Publish a policy or employee record to begin." />}</section>
    {showCreate && <Modal title="Publish HR document" onClose={() => setShowCreate(false)} size="large">
      <form className="document-publish-shell" onSubmit={submit}>
        <section className="document-publish-intro">
          <span className="document-publish-intro-icon"><FileKey2 aria-hidden="true" /></span>
          <div><small>Controlled document release</small><h3>Publish with confidence and clear accountability</h3><p>Prepare the employee-facing content, define its governance rules, and verify the delivery scope before release.</p></div>
          <span className="document-publish-state"><ShieldCheck aria-hidden="true" />RLS protected</span>
        </section>

        <div className="document-publish-content">
          <section className="document-composer-card" aria-labelledby="document-composer-title">
            <header className="document-form-heading"><span><FileText aria-hidden="true" /></span><div><h4 id="document-composer-title">Document content</h4><p>Create a recognizable record employees can understand and retrieve.</p></div></header>

            <label className="document-premium-field">Document title
              <span className="document-input-shell"><FileCheck2 aria-hidden="true" /><input aria-label="Title" minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Remote Work Security Policy" required /></span>
              <small><span>Use the official title employees will see in their vault.</span><strong>{form.title.length}/160</strong></small>
            </label>

            <div className="document-file-grid">
              <label className="document-premium-field">Filename
                <span className="document-input-shell"><FileText aria-hidden="true" /><input aria-label="Filename" placeholder="example-policy.txt" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} required /></span>
              </label>
              <label className="document-premium-field compact">Version
                <span className="document-input-shell"><Tags aria-hidden="true" /><input aria-label="Version" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} required /></span>
              </label>
            </div>

            <label className="document-premium-field">Document text
              <textarea aria-label="Document text" rows={8} minLength={3} maxLength={10000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Write the controlled document content employees will receive…" required />
              <small><span>This content becomes the authorized downloadable employee record.</span><strong>{form.content.length}/10,000</strong></small>
            </label>
          </section>

          <aside className="document-governance-card" aria-labelledby="document-governance-title">
            <header className="document-form-heading"><span><ShieldCheck aria-hidden="true" /></span><div><h4 id="document-governance-title">Distribution & governance</h4><p>Control who receives the document and how it must be handled.</p></div></header>

            <div className="document-governance-grid">
              <label className="document-select-field"><span><UsersRound aria-hidden="true" />Audience</span><select aria-label="Audience" value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}><option value="">All eligible employees</option>{activeEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label>
              <label className="document-select-field"><span><Tags aria-hidden="true" />Document type</span><select aria-label="Document type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['Policy', 'Payslip', 'Certificate', 'Contract', 'Memo', 'Tax', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="document-select-field"><span><CalendarDays aria-hidden="true" />Period</span><input aria-label="Period" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} /></label>
              <label className="document-select-field"><span><CalendarDays aria-hidden="true" />Expiry <em>Optional</em></span><input aria-label="Expiry (optional)" type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label>
            </div>

            <fieldset className="document-control-picker">
              <legend>Document controls</legend>
              <label className={form.requiresAck ? 'active' : ''}><input aria-label="Require employee acknowledgement" type="checkbox" checked={form.requiresAck} onChange={(event) => setForm({ ...form, requiresAck: event.target.checked })} /><span><CheckCircle2 aria-hidden="true" /></span><div><strong>Require employee acknowledgement</strong><small>Track a dated confirmation from every recipient.</small></div></label>
              <label className={form.sensitive ? 'active sensitive' : ''}><input aria-label="Sensitive employee record" type="checkbox" checked={form.sensitive} onChange={(event) => setForm({ ...form, sensitive: event.target.checked })} /><span><LockKeyhole aria-hidden="true" /></span><div><strong>Sensitive employee record</strong><small>Apply heightened visibility and handling expectations.</small></div></label>
            </fieldset>

            <section className={`document-delivery-preview ${form.sensitive ? 'sensitive' : ''}`} aria-labelledby="document-delivery-title">
              <header><div><small>Release summary</small><h4 id="document-delivery-title">Secure delivery preview</h4></div><span><Sparkles aria-hidden="true" /></span></header>
              <div className="document-preview-title"><span>{form.sensitive ? <LockKeyhole aria-hidden="true" /> : <FileText aria-hidden="true" />}</span><div><strong>{form.title.trim() || 'Untitled HR document'}</strong><p>{form.type} · Version {form.version || '1.0'}</p></div></div>
              <dl><div><dt>Audience</dt><dd>{audienceLabel}</dd></div><div><dt>Recipients</dt><dd>{targetCount}</dd></div><div><dt>Acknowledgement</dt><dd>{form.requiresAck ? 'Required' : 'Not required'}</dd></div><div><dt>Classification</dt><dd>{form.sensitive ? 'Sensitive' : 'Standard'}</dd></div></dl>
              <div className="document-notification-note"><BellRing aria-hidden="true" /><p><strong>Notification ready.</strong> Supabase creates the employee notification only after the protected document insert succeeds.</p></div>
            </section>
          </aside>
        </div>

        <footer className="document-publish-footer">
          <div><ShieldCheck aria-hidden="true" /><p><strong>Authorized delivery only.</strong> Content is read through Supabase RLS before an employee download is generated.</p></div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary"><Send aria-hidden="true" />Publish & notify</button></div>
        </footer>
      </form>
    </Modal>}
  </div>
}
