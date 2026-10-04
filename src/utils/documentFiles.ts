/** Files HR can attach to a document, matching the private storage bucket. */
export const DOCUMENT_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG image',
  'image/jpeg': 'JPEG image',
  'text/plain': 'Text file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
}

export const DOCUMENT_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.docx'
export const DOCUMENT_FILE_MAX_BYTES = 10 * 1024 * 1024

/** A reason the file cannot be attached, or an empty string when it can. */
export function documentFileError(file: Pick<File, 'type' | 'size'>): string {
  if (!DOCUMENT_FILE_TYPES[file.type]) return 'Attach a PDF, PNG, JPEG, text or Word (.docx) file.'
  if (file.size > DOCUMENT_FILE_MAX_BYTES) return 'Attach a file of 10 MB or less.'
  if (file.size === 0) return 'The selected file is empty.'
  return ''
}

/** A storage-safe file name that keeps the extension readable. */
export function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|-+$/g, '')
  return (cleaned || 'document').slice(-120)
}

export function documentStoragePath(name: string): string {
  return `${crypto.randomUUID()}/${safeFileName(name)}`
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
