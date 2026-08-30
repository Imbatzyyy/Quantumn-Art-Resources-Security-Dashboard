import { useState, type FormEvent } from 'react'
import { FileCheck2, FileText, FolderLock, Plus, ShieldCheck } from 'lucide-react'
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
  const activeEmployees = data.employees.filter((item) => item.role === 'employee' && item.status !== 'Inactive')
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
    {showCreate && <Modal title="Publish HR document" onClose={() => setShowCreate(false)} size="large"><form className="form-grid" onSubmit={submit}><label>Audience<select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}><option value="">All active employees</option>{activeEmployees.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label>Document type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['Policy', 'Payslip', 'Certificate', 'Contract', 'Memo', 'Tax', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="span-2">Title<input minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Filename<input placeholder="example-policy.txt" value={form.filename} onChange={(event) => setForm({ ...form, filename: event.target.value })} required /></label><label>Version<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} required /></label><label>Period<input value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} /></label><label>Expiry (optional)<input type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label><label className="span-2">Document text<textarea rows={7} minLength={3} maxLength={10000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label><div className="check-row span-2"><label><input type="checkbox" checked={form.requiresAck} onChange={(event) => setForm({ ...form, requiresAck: event.target.checked })} />Require employee acknowledgement</label><label><input type="checkbox" checked={form.sensitive} onChange={(event) => setForm({ ...form, sensitive: event.target.checked })} />Sensitive employee record</label></div><p className="form-note span-2">The content and metadata are stored in Supabase. The employee download is generated only after an authorized RLS-protected read.</p><div className="modal-actions span-2"><button type="button" className="button button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary">Publish & notify</button></div></form></Modal>}
  </div>
}
