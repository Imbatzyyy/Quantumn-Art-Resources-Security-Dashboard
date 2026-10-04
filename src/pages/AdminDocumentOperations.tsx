import { useState, type FormEvent } from 'react'
import { BellRing, CheckCircle2, Circle, FileCheck2, FileText, FolderLock, LoaderCircle, Paperclip, Plus, Send, ShieldCheck, X } from 'lucide-react'
import { Badge, Modal, SectionHeading, StatCard, Tabs } from '../components/ui.js'
import { tabPanelProps } from '../components/tabPanel.js'
import { DataTable, type DataColumn } from '../components/DataTable.js'
import { useDocumentPreview } from './employee/documentPreview.js'
import { DocumentFileButton } from '../components/DocumentFileButton.js'
import { DOCUMENT_FILE_ACCEPT, documentFileError, formatFileSize } from '../utils/documentFiles.js'
import { Field, FormFooter, FormIntro, Note, SectionTitle, SummaryList } from '../components/readable.js'
import { useSubmissionLock } from '../utils/useSubmissionLock.js'
import { useHrms } from '../state/useHrms.js'
import { formatDate, formatDateTime } from '../utils/format.js'
import { businessDate } from '../utils/securityMetrics.js'
import type { DocumentInput, DocumentRecord, HrmsSnapshot } from '../types/hrms.js'

const personName = (data: HrmsSnapshot, employeeId: string) => {
  const employee = data.employees.find((item) => item.id === employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : employeeId
}

export default function AdminDocumentOperations({ documentId, onDocumentChange }: { documentId?: string | null; onDocumentChange?: (id: string | null) => void } = {}) {
  const submission = useSubmissionLock()
  const { data, createDocument } = useHrms()
  const [showCreate, setShowCreate] = useState(false)
  const [formError, setFormError] = useState('')
  const [localDocument, setLocalDocument] = useState<string | null>(null)
  const [form, setForm] = useState<DocumentInput>({ employeeId: '', title: '', type: 'Policy', period: `${new Date().getFullYear()}`, content: '', filename: '', version: '1.0', requiresAck: true, sensitive: false, expiresOn: '', file: null })
  const [fileError, setFileError] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
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
    try { await createDocument(form); setShowCreate(false); setForm({ ...form, title: '', content: '', filename: '', employeeId: '', file: null }); setFileInputKey((key) => key + 1) } catch { /* Keep protected input. */ } finally { submission.finish() }
  }
  const chooseFile = (file: File | undefined) => {
    setFileError('')
    if (!file) return
    const problem = documentFileError(file)
    if (problem) {
      setFileError(problem)
      setFileInputKey((key) => key + 1)
      return
    }
    setForm((current) => ({ ...current, file, filename: current.filename || file.name }))
  }
  const removeFile = () => {
    setForm((current) => ({ ...current, file: null }))
    setFileInputKey((key) => key + 1)
  }

  const selectedDocumentId = onDocumentChange ? documentId ?? null : localDocument
  const selectDocument = (id: string | null) => onDocumentChange ? onDocumentChange(id) : setLocalDocument(id)
  const selectedDocument = data.documents.find((item) => item.id === selectedDocumentId)
  const audienceOf = (document: DocumentRecord) => document.employeeId ? [document.employeeId] : activeEmployees.map((employee) => employee.id)
  const acknowledgedCount = (document: DocumentRecord) => audienceOf(document).filter((employeeId) => acknowledgedPairs.has(`${document.id}:${employeeId}`)).length
  const columns: DataColumn<DocumentRecord>[] = [
    { id: 'title', header: 'Document', primary: true, cell: (item) => <span className="cell-stack"><strong>{item.title}</strong><small>{item.type} · Version {item.version}{item.filePath ? ' · File attached' : ''}</small></span>, sortValue: (item) => item.title },
    { id: 'audience', header: 'Audience', cell: (item) => item.employeeId ? personName(data, item.employeeId) : 'All employees', sortValue: (item) => item.employeeId ? personName(data, item.employeeId) : '' },
    { id: 'added', header: 'Published', hideOnMobile: true, cell: (item) => formatDate(item.createdAt.slice(0, 10)), sortValue: (item) => item.createdAt },
    { id: 'ack', header: 'Acknowledged', cell: (item) => { if (!item.requiresAck) return <span className="text-muted">Not required</span>; const done = acknowledgedCount(item); const total = audienceOf(item).length; return <span className="inline-progress"><progress value={done} max={Math.max(total, 1)} aria-hidden="true" />{done} of {total}</span> }, sortValue: (item) => item.requiresAck ? acknowledgedCount(item) / Math.max(audienceOf(item).length, 1) : -1, csv: (item) => item.requiresAck ? `${acknowledgedCount(item)}/${audienceOf(item).length}` : 'Not required' },
    { id: 'classification', header: 'Handling', hideOnMobile: true, cell: (item) => <Badge tone={item.sensitive ? 'warning' : 'neutral'}>{item.sensitive ? 'Sensitive' : 'Standard'}</Badge>, sortValue: (item) => item.sensitive ? 'Sensitive' : 'Standard' },
  ]

  return <div className="page-stack">
    <SectionHeading title="Documents & Policies" description="Publish policies and personal documents, and track who has acknowledged them." actions={<button className="button button-primary" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />Publish document</button>} />
    <div className="stats-grid stats-grid-3"><StatCard icon={FileText} label="Documents" value={data.documents.length} detail={`${data.documents.filter((item) => !item.employeeId).length} company-wide`} tone="blue" /><StatCard icon={FileCheck2} label="Acknowledgements outstanding" value={requiredCount} detail="Across all required documents" tone="amber" /><StatCard icon={ShieldCheck} label="Sensitive documents" value={data.documents.filter((item) => item.sensitive).length} detail="Personal, restricted access" tone="purple" /></div>
    <section className="panel">
      <DataTable
        rows={data.documents}
        columns={columns}
        getRowId={(item) => item.id}
        caption="Document register"
        count={{ singular: 'document', plural: 'documents' }}
        search={{ placeholder: 'Search documents', text: (item) => `${item.title} ${item.type} ${item.filename} ${item.employeeId ? personName(data, item.employeeId) : ''}` }}
        filters={[{ id: 'type', label: 'Types', value: (item) => item.type }, { id: 'audience', label: 'Audiences', value: (item) => item.employeeId ? 'One employee' : 'All employees' }]}
        initialSort={{ column: 'added', direction: 'desc' }}
        exportName="document-register"
        onRowClick={(item) => selectDocument(item.id)}
        rowActionLabel={(item) => `Open ${item.title}`}
        empty={{ icon: FolderLock, title: 'No documents yet', text: 'Publish a policy or a personal document to begin.', action: <button type="button" className="button button-primary button-small" onClick={() => setShowCreate(true)}><Plus aria-hidden="true" />Publish document</button> }}
      />
    </section>
    {selectedDocument && <DocumentDetail document={selectedDocument} audience={audienceOf(selectedDocument)} acknowledged={(employeeId) => data.documentAcknowledgements.find((item) => item.documentId === selectedDocument.id && item.employeeId === employeeId)?.acknowledgedAt} name={(employeeId) => personName(data, employeeId)} onClose={() => selectDocument(null)} />}
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
              <Field label="Attach a file" optional help="PDF, Word (.docx), PNG, JPEG or text, up to 10 MB. Stored privately; only the audience can download it.">{(control) => form.file
                ? <div className="file-chip"><Paperclip aria-hidden="true" /><span><strong>{form.file.name}</strong><small>{formatFileSize(form.file.size)}</small></span><button type="button" className="icon-button" onClick={removeFile} aria-label={`Remove ${form.file.name}`}><X aria-hidden="true" /></button></div>
                : <input {...control} key={fileInputKey} type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => chooseFile(event.target.files?.[0])} />}</Field>
              {fileError && <p className="rf-error" role="alert">{fileError}</p>}
              <Field label={form.file ? 'Summary' : 'Document text'} count={`${form.content.length.toLocaleString()}/10,000`} help={form.file ? 'A short description shown with the attached file.' : 'This text becomes the document employees download.'}>{(control) => <textarea {...control} rows={form.file ? 4 : 8} minLength={3} maxLength={10000} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder={form.file ? 'What the file is and what employees should do with it' : 'Write the document content employees will receive'} required />}</Field>
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
              ['Attached file', form.file ? form.file.name : 'None, text only'],
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

function DocumentDetail({ document, audience, acknowledged, name, onClose }: { document: DocumentRecord; audience: string[]; acknowledged: (employeeId: string) => string | undefined; name: (employeeId: string) => string; onClose: () => void }) {
  const { readDocument } = useHrms()
  const [view, setView] = useState<'status' | 'text'>(document.requiresAck ? 'status' : 'text')
  const preview = useDocumentPreview(view === 'text' ? document : undefined, readDocument)
  const done = audience.filter((employeeId) => acknowledged(employeeId))
  const pending = audience.filter((employeeId) => !acknowledged(employeeId))
  return <Modal title={document.title} onClose={onClose} size="large">
    <div className="document-preview">
      <div className="document-preview-meta"><Badge tone={document.sensitive ? 'warning' : 'info'}>{document.type}</Badge><span>Version {document.version}</span><span>{document.employeeId ? name(document.employeeId) : 'All employees'}</span><span>Published {formatDateTime(document.createdAt)}</span>{document.expiresOn && <span>Expires {formatDate(document.expiresOn)}</span>}</div>
      <Tabs idPrefix="document-detail" label="Document details" tabs={[...(document.requiresAck ? [{ id: 'status' as const, label: 'Acknowledgements', count: pending.length }] : []), { id: 'text' as const, label: document.filePath ? 'Summary' : 'Document text' }]} active={view} onChange={setView} />
      <div {...tabPanelProps('document-detail', view)} className="tab-panel">
        {view === 'status' && <div className="ack-roster">
          <p className="tab-panel-intro">{done.length} of {audience.length} acknowledged{pending.length ? ` · ${pending.length} still to go` : ' · complete'}</p>
          <ul>{[...pending, ...done].map((employeeId) => { const at = acknowledged(employeeId); return <li key={employeeId} className={at ? 'is-done' : undefined}>{at ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><strong>{name(employeeId)}</strong><small>{at ? `Acknowledged ${formatDateTime(at)}` : 'Not yet acknowledged'}</small></span></li> })}</ul>
        </div>}
        {view === 'text' && <div className="document-preview-body" tabIndex={0} aria-label={`${document.title} text`}>
          {preview.status === 'loading' && <p className="document-preview-state" role="status"><LoaderCircle className="spin" aria-hidden="true" />Opening document…</p>}
          {preview.status === 'error' && <p className="document-preview-state" role="alert"><FileText aria-hidden="true" />This document is unavailable or has expired.</p>}
          {preview.status === 'ready' && <div className="document-preview-text">{preview.text}</div>}
        </div>}
      </div>
      <div className="modal-actions"><DocumentFileButton document={document} /><button type="button" className="button button-primary" onClick={onClose}>Done</button></div>
    </div>
  </Modal>
}
