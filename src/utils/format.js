export function formatMoney(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function statusTone(status) {
  const tones = {
    Active: 'success',
    Present: 'success',
    Approved: 'success',
    Processed: 'success',
    Released: 'success',
    Paid: 'success',
    Locked: 'neutral',
    Published: 'success',
    Complete: 'success',
    Completed: 'success',
    Closed: 'neutral',
    Resolved: 'success',
    Remediated: 'success',
    Passed: 'success',
    Confirmed: 'danger',
    Contained: 'warning',
    'False Positive': 'neutral',
    'Accepted Risk': 'warning',
    'Review Needed': 'warning',
    Failed: 'danger',
    Open: 'danger',
    'In Progress': 'warning',
    Pending: 'warning',
    Submitted: 'info',
    'Under Review': 'warning',
    'More Information': 'warning',
    Validation: 'warning',
    Review: 'warning',
    Investigating: 'warning',
    Draft: 'neutral',
    Cancelled: 'neutral',
    Skipped: 'neutral',
    Acknowledged: 'info',
    Late: 'warning',
    Rejected: 'danger',
    'At Risk': 'danger',
    New: 'danger',
    'On Leave': 'info',
  }
  return tones[status] ?? 'neutral'
}
