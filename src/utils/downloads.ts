export interface CsvColumn {
  label: string
  key?: string
  value?: (row: unknown) => unknown
}

const csvCell = (value: unknown): string => {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

const safeFilename = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export function downloadCsv(title: string, columns: CsvColumn[], rows: object[]): void {
  const header = columns.map(({ label }) => csvCell(label)).join(',')
  const body = rows.map((row) =>
    columns.map(({ key, value }) => {
      const cell = value ? value(row) : key ? (row as Record<string, unknown>)[key] : ''
      return csvCell(cell)
    }).join(','),
  )
  const csv = `\uFEFF${[header, ...body].join('\r\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `${safeFilename(title)}.csv`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function inclusiveDays(startDate?: string | null, endDate?: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}
