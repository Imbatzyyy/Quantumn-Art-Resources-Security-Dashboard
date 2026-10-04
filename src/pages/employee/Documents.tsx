import { useState } from 'react'
import { BookOpenCheck, CheckCircle2, Download, FileText, FolderLock, LoaderCircle } from 'lucide-react'
import { Badge, Modal, SectionHeading } from '../../components/ui.js'
import { DataTable, type DataColumn } from '../../components/DataTable.js'
import { useHrms } from '../../state/useHrms.js'
import { formatDate, formatDateTime } from '../../utils/format.js'
import type { DocumentRecord } from '../../types/hrms.js'
import { downloadText } from './shared.js'
import { useDocumentPreview } from './documentPreview.js'
import { DocumentFileButton } from '../../components/DocumentFileButton.js'

export function DocumentVault({ selectedId, onSelect }: { selectedId?: string | null; onSelect: (id: string | null) => void }) {
  const { data, user } = useHrms()
  if (!data || !user) return null
  const documents = data.documents.filter((item) => !item.employeeId || item.employeeId === user.id)
  const acknowledgements = new Map(data.documentAcknowledgements.filter((item) => item.employeeId === user.id).map((item) => [item.documentId, item]))
  const due = documents.filter((item) => item.requiresAck && !acknowledgements.has(item.id))
  const selected = documents.find((item) => item.id === selectedId)
  const statusOf = (item: DocumentRecord) => item.requiresAck ? acknowledgements.has(item.id) ? 'Acknowledged' : 'Needs acknowledgement' : 'For your records'

  const columns: DataColumn<DocumentRecord>[] = [
    { id: 'title', header: 'Document', primary: true, cell: (item) => <span className="cell-stack"><strong>{item.title}</strong><small>Version {item.version}{item.period ? ` · ${item.period}` : ''}{item.employeeId ? ' · Personal' : ''}{item.filePath ? ' · File attached' : ''}</small></span>, sortValue: (item) => item.title },
    { id: 'type', header: 'Type', cell: (item) => item.type, sortValue: (item) => item.type },
    { id: 'added', header: 'Added', cell: (item) => formatDate(item.createdAt.slice(0, 10)), sortValue: (item) => item.createdAt },
    { id: 'status', header: 'Status', cell: (item) => <Badge tone={item.requiresAck ? acknowledgements.has(item.id) ? 'success' : 'warning' : 'neutral'}>{statusOf(item)}</Badge>, sortValue: statusOf },
  ]

  return <div className="page-stack">
    <SectionHeading title="Documents" description="Company policies and your personal HR documents." />
    {due.length > 0 && <div className="notice-bar notice-bar-warning" role="status"><BookOpenCheck aria-hidden="true" /><p><strong>{due.length} document{due.length === 1 ? '' : 's'} to acknowledge.</strong> Open each one, read it, and confirm.</p><button type="button" className="button button-secondary button-small" onClick={() => onSelect(due[0].id)}>Review now</button></div>}
    <section className="panel">
      <DataTable
        rows={documents}
        columns={columns}
        getRowId={(item) => item.id}
        caption="Your documents"
        count={{ singular: 'document', plural: 'documents' }}
        search={{ placeholder: 'Search documents', text: (item) => `${item.title} ${item.type} ${item.filename}` }}
        filters={[{ id: 'type', label: 'Types', value: (item) => item.type }, { id: 'status', label: 'Statuses', value: statusOf }]}
        initialSort={{ column: 'added', direction: 'desc' }}
        onRowClick={(item) => onSelect(item.id)}
        rowActionLabel={(item) => `Open ${item.title}`}
        empty={{ icon: FolderLock, title: 'No documents yet', text: 'Policies and documents HR shares with you will appear here.' }}
      />
    </section>
    {selected && <DocumentPreviewModal document={selected} acknowledgedAt={acknowledgements.get(selected.id)?.acknowledgedAt} onClose={() => onSelect(null)} />}
  </div>
}

function DocumentPreviewModal({ document, acknowledgedAt, onClose }: { document: DocumentRecord; acknowledgedAt?: string; onClose: () => void }) {
  const { acknowledgeDocument, notify, readDocument } = useHrms()
  const preview = useDocumentPreview(document, readDocument)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const needsAck = document.requiresAck && !acknowledgedAt
  const acknowledge = async () => {
    setSaving(true)
    try { await acknowledgeDocument(document.id); onClose() } catch { /* Toast explains the failure. */ } finally { setSaving(false) }
  }
  const download = () => {
    if (preview.status === 'ready') downloadText(document.filename, preview.text)
    else notify('This document is unavailable or expired. Refresh the page and try again.', 'error')
  }
  return <Modal title={document.title} onClose={onClose} size="large">
    <div className="document-preview">
      <div className="document-preview-meta">
        <Badge tone={document.sensitive ? 'warning' : 'info'}>{document.type}</Badge>
        <span>Version {document.version}</span>
        <span>Added {formatDateTime(document.createdAt)}</span>
        {document.expiresOn && <span>Available until {formatDate(document.expiresOn)}</span>}
      </div>
      <div className="document-preview-body" tabIndex={0} aria-label={`${document.title} text`}>
        {preview.status === 'loading' && <p className="document-preview-state" role="status"><LoaderCircle className="spin" aria-hidden="true" />Opening document…</p>}
        {preview.status === 'error' && <p className="document-preview-state" role="alert"><FileText aria-hidden="true" />This document is unavailable or has expired. Refresh the page and try again, or contact HR.</p>}
        {preview.status === 'ready' && <div className="document-preview-text">{preview.text}</div>}
      </div>
      {acknowledgedAt && <p className="document-preview-ack"><CheckCircle2 aria-hidden="true" />You acknowledged this document on {formatDateTime(acknowledgedAt)}.</p>}
      {needsAck && <label className="rf-choice rf-choice--plain document-preview-confirm"><input type="checkbox" checked={confirmed} disabled={preview.status !== 'ready'} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I have read and understood this document.</strong><small>Your confirmation and the date are recorded.</small></span></label>}
      <div className="modal-actions">
        <DocumentFileButton document={document} />
        <button type="button" className="button button-secondary" onClick={download} disabled={preview.status === 'loading'}><Download size={17} aria-hidden="true" />{document.filePath ? 'Download text' : 'Download'}</button>
        {needsAck
          ? <button type="button" className="button button-primary" onClick={() => void acknowledge()} disabled={!confirmed || saving}><BookOpenCheck size={17} aria-hidden="true" />{saving ? 'Saving…' : 'Acknowledge'}</button>
          : <button type="button" className="button button-primary" onClick={onClose}>Done</button>}
      </div>
    </div>
  </Modal>
}
