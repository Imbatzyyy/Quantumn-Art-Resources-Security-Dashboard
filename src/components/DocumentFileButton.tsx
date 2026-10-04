import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { useHrms } from '../state/useHrms.js'
import type { DocumentRecord } from '../types/hrms.js'
import { DOCUMENT_FILE_TYPES, formatFileSize } from '../utils/documentFiles.js'

/** Downloads a document's attached file through a short-lived private link. */
export function DocumentFileButton({ document, primary = false }: { document: DocumentRecord; primary?: boolean }) {
  const { getDocumentFileUrl, notify, recordActivity } = useHrms()
  const [opening, setOpening] = useState(false)
  if (!document.filePath || !getDocumentFileUrl) return null
  const kind = DOCUMENT_FILE_TYPES[document.mimeType ?? ''] ?? 'File'
  const open = async () => {
    setOpening(true)
    try {
      const url = await getDocumentFileUrl(document)
      const link = window.document.createElement('a')
      link.href = url
      link.rel = 'noopener'
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      void recordActivity({ action: 'Downloaded authorized document file', target: document.title }).catch(() => undefined)
    } catch {
      notify('The file could not be opened. Refresh the page and try again, or contact HR.', 'error')
    } finally {
      setOpening(false)
    }
  }
  return <button type="button" className={`button ${primary ? 'button-primary' : 'button-secondary'}`} onClick={() => void open()} disabled={opening} aria-label={`Download attached ${kind}: ${document.filename}`}>
    <Paperclip size={17} aria-hidden="true" />{opening ? 'Opening…' : `Download ${kind}${document.fileSize ? ` · ${formatFileSize(document.fileSize)}` : ''}`}
  </button>
}
