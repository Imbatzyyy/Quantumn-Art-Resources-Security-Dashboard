export interface NavigateProps { onNavigate: (target: string) => void }

export const openRequestStatuses = ['Submitted', 'Under Review', 'More Information']
export const closedRequestStatuses = ['Approved', 'Rejected', 'Completed', 'Cancelled']

export const requestTypes = [
  'Attendance Correction', 'Overtime', 'Schedule Change', 'Profile Correction',
  'Document Request', 'Payroll Concern', 'General HR',
] as const

export const requestRouting: Record<string, { team: string; guidance: string }> = {
  'Attendance Correction': { team: 'Time & Attendance', guidance: 'Include the date, expected time, and what appears incorrectly.' },
  Overtime: { team: 'Time & Attendance', guidance: 'Include the work date, total hours, and approving supervisor.' },
  'Schedule Change': { team: 'People Operations', guidance: 'State the requested schedule and when it should take effect.' },
  'Profile Correction': { team: 'People Operations', guidance: 'Describe the current value and the correct employee information.' },
  'Document Request': { team: 'HR Services', guidance: 'Name the document, intended recipient, and required delivery date.' },
  'Payroll Concern': { team: 'Payroll Operations', guidance: 'Identify the pay period and the amount or item that needs review.' },
  'General HR': { team: 'People Operations', guidance: 'Give HR enough context to route and resolve the request correctly.' },
}

export const requestPriorities = [
  { value: 'Normal', label: 'Normal', detail: 'Standard HR review' },
  { value: 'High', label: 'High', detail: 'Time-sensitive issue' },
  { value: 'Urgent', label: 'Urgent', detail: 'Immediate work impact' },
] as const

export const priorityTone = (priority: string) => priority === 'Urgent' ? 'danger' : priority === 'High' ? 'warning' : 'neutral'

export const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** The four-digit year mentioned in a payroll period label such as "August 2026". */
export const periodYear = (period: string) => Number(/\b(20\d{2})\b/.exec(period)?.[1] ?? 0)
