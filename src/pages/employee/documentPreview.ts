import { useEffect, useState } from 'react'
import { requireSupabase } from '../../services/supabaseClient.js'
import type { DocumentRecord } from '../../types/hrms.js'

/** Reads a document's text through the authorized document RPC (access is logged). */
export async function readDocumentText(id: string): Promise<string> {
  const { data: body, error } = await requireSupabase().rpc('read_employee_document', { selected_document_id: Number(id) })
  if (error) throw error
  return String(body ?? '')
}

export type DocumentPreview = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'error' }

/** Loads a document's text once per document; returns loading until the matching result arrives. */
export function useDocumentPreview(document?: DocumentRecord, readerOverride?: (id: string) => Promise<string>): DocumentPreview {
  const [result, setResult] = useState<{ id: string; preview: DocumentPreview } | null>(null)
  const reader = readerOverride ?? readDocumentText
  const documentId = document?.id
  useEffect(() => {
    if (!documentId) return
    let active = true
    reader(documentId)
      .then((text) => { if (active) setResult({ id: documentId, preview: { status: 'ready', text } }) })
      .catch(() => { if (active) setResult({ id: documentId, preview: { status: 'error' } }) })
    return () => { active = false }
  }, [documentId, reader])
  return result && result.id === documentId ? result.preview : { status: 'loading' }
}
