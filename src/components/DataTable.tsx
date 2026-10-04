import { useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react'
import { downloadCsv } from '../utils/downloads.js'
import { EmptyState } from './ui.js'

export interface DataColumn<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Value written to CSV exports; falls back to sortValue. */
  csv?: (row: T) => unknown
  align?: 'start' | 'end' | 'center'
  /** Shown as the card heading when the table collapses to cards on phones. */
  primary?: boolean
  hideOnMobile?: boolean
  /** Included in CSV exports but not shown in the table. */
  exportOnly?: boolean
  className?: string
}

export interface DataFilter<T> {
  id: string
  label: string
  value: (row: T) => string
  options?: string[]
}

interface CountLabel { singular: string; plural: string }

interface DataTableProps<T> {
  rows: T[]
  columns: DataColumn<T>[]
  getRowId: (row: T) => string
  caption: string
  count?: CountLabel
  search?: { placeholder: string; text: (row: T) => string; initial?: string }
  filters?: DataFilter<T>[]
  initialSort?: { column: string; direction: 'asc' | 'desc' }
  pageSize?: number
  onRowClick?: (row: T) => void
  rowActionLabel?: (row: T) => string
  exportName?: string
  empty: { icon: LucideIcon; title: string; text: string; action?: ReactNode }
  toolbar?: ReactNode
  selection?: { isSelectable?: (row: T) => boolean; actions: (selected: T[], clear: () => void) => ReactNode }
  rowClassName?: (row: T) => string | undefined
}

const PAGE_SIZES = [10, 25, 50]

const compare = (left: string | number | null | undefined, right: string | number | null | undefined) => {
  if (left === right) return 0
  if (left === null || left === undefined || left === '') return 1
  if (right === null || right === undefined || right === '') return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' })
}

/**
 * The shared HR data table: search, filters, sorting, paging, CSV export,
 * row selection, and a card layout on phones. Rows open with a real button,
 * so keyboard and screen-reader users get the same action as a mouse click.
 */
export function DataTable<T>({
  rows, columns: allColumns, getRowId, caption, count = { singular: 'record', plural: 'records' }, search, filters = [],
  initialSort, pageSize: initialPageSize = 10, onRowClick, rowActionLabel, exportName, empty, toolbar, selection, rowClassName,
}: DataTableProps<T>) {
  const id = useId()
  const columns = allColumns.filter((column) => !column.exportOnly)
  const [query, setQuery] = useState(search?.initial ?? '')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filterOptions = useMemo(() => Object.fromEntries(filters.map((filter) => [
    filter.id,
    filter.options ?? [...new Set(rows.map(filter.value).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
  ])), [filters, rows])

  const visibleRows = useMemo(() => {
    const text = query.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (text && search && !search.text(row).toLowerCase().includes(text)) return false
      return filters.every((filter) => !filterValues[filter.id] || filter.value(row) === filterValues[filter.id])
    })
    const column = sort && columns.find((item) => item.id === sort.column)
    if (!column?.sortValue) return filtered
    const direction = sort?.direction === 'desc' ? -1 : 1
    return [...filtered].sort((left, right) => compare(column.sortValue!(left), column.sortValue!(right)) * direction)
  }, [rows, query, search, filters, filterValues, sort, columns])

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const pageRows = visibleRows.slice(start, start + pageSize)
  const filtersActive = Boolean(query.trim()) || Object.values(filterValues).some(Boolean)
  const selectableRows = selection ? pageRows.filter((row) => selection.isSelectable?.(row) ?? true) : []
  const selectedRows = selection ? rows.filter((row) => selected.has(getRowId(row))) : []
  const allPageSelected = selectableRows.length > 0 && selectableRows.every((row) => selected.has(getRowId(row)))
  const label = (total: number) => `${total.toLocaleString()} ${total === 1 ? count.singular : count.plural}`

  const resetPage = () => setPage(1)
  const clearFilters = () => { setQuery(''); setFilterValues({}); resetPage() }
  const toggleSort = (column: DataColumn<T>) => {
    if (!column.sortValue) return
    setSort((current) => current?.column === column.id
      ? { column: column.id, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { column: column.id, direction: 'asc' })
  }
  const toggleRow = (row: T) => setSelected((current) => {
    const next = new Set(current)
    const key = getRowId(row)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const togglePage = () => setSelected((current) => {
    const next = new Set(current)
    if (allPageSelected) selectableRows.forEach((row) => next.delete(getRowId(row)))
    else selectableRows.forEach((row) => next.add(getRowId(row)))
    return next
  })
  const exportRows = () => {
    if (!exportName) return
    const exportable = allColumns.filter((column) => column.csv || column.sortValue)
    downloadCsv(exportName, exportable.map((column) => ({ label: column.header, value: (row) => (column.csv ?? column.sortValue)!(row as T) })), visibleRows as object[])
  }
  const rowClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return
    onRowClick(row)
  }

  if (!rows.length) {
    return <div className="data-table data-table-empty">
      {toolbar && <div className="data-table-toolbar"><div className="data-table-tools">{toolbar}</div></div>}
      <EmptyState icon={empty.icon} title={empty.title} text={empty.text} action={empty.action} />
    </div>
  }

  return <div className="data-table">
    {(search || filters.length > 0 || toolbar || exportName) && <div className="data-table-toolbar">
      <div className="data-table-filters">
        {search && <label className="data-table-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{search.placeholder}</span>
          <input type="search" value={query} placeholder={search.placeholder} onChange={(event) => { setQuery(event.target.value); resetPage() }} />
        </label>}
        {filters.map((filter) => <label className="data-table-filter" key={filter.id}>
          <span className="sr-only">{filter.label}</span>
          <select value={filterValues[filter.id] ?? ''} onChange={(event) => { setFilterValues((current) => ({ ...current, [filter.id]: event.target.value })); resetPage() }}>
            <option value="">{`All ${filter.label.toLowerCase()}`}</option>
            {filterOptions[filter.id]?.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>)}
        {filtersActive && <button type="button" className="text-button data-table-clear" onClick={clearFilters}><X size={15} aria-hidden="true" />Clear</button>}
      </div>
      <div className="data-table-tools">
        {toolbar}
        {exportName && <button type="button" className="button button-secondary button-small" onClick={exportRows} disabled={!visibleRows.length}><Download size={16} aria-hidden="true" />Export CSV</button>}
      </div>
    </div>}

    {selection && selectedRows.length > 0 && <div className="data-table-bulk" role="region" aria-label="Selected rows">
      <strong>{selectedRows.length} selected</strong>
      <div>{selection.actions(selectedRows, () => setSelected(new Set()))}</div>
      <button type="button" className="text-button" onClick={() => setSelected(new Set())}>Clear selection</button>
    </div>}

    {visibleRows.length ? <div className="table-shell data-table-shell">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selection && <th className="data-table-check"><input type="checkbox" aria-label="Select all rows on this page" checked={allPageSelected} disabled={!selectableRows.length} onChange={togglePage} /></th>}
            {columns.map((column) => {
              const sorted = sort?.column === column.id ? sort.direction : undefined
              return <th key={column.id} scope="col" className={`${column.align ? `align-${column.align}` : ''} ${column.className ?? ''}`.trim() || undefined} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : column.sortValue ? 'none' : undefined}>
                {column.sortValue
                  ? <button type="button" className="data-table-sort" onClick={() => toggleSort(column)}>{column.header}{sorted === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : sorted === 'desc' ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUpDown size={14} aria-hidden="true" />}</button>
                  : column.header || <span className="sr-only">Actions</span>}
              </th>
            })}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const key = getRowId(row)
            return <tr key={key} className={`${onRowClick ? 'is-clickable' : ''} ${rowClassName?.(row) ?? ''}`.trim() || undefined} onClick={(event) => rowClick(event, row)}>
              {selection && <td className="data-table-check">{(selection.isSelectable?.(row) ?? true) && <input type="checkbox" aria-label={`Select ${rowActionLabel?.(row) ?? key}`} checked={selected.has(key)} onChange={() => toggleRow(row)} />}</td>}
              {columns.map((column) => <td key={column.id} data-label={column.header || undefined} className={`${column.align ? `align-${column.align}` : ''} ${column.primary ? 'is-primary' : ''} ${column.hideOnMobile ? 'hide-mobile' : ''} ${column.className ?? ''}`.trim() || undefined}>
                {column.primary && onRowClick
                  ? <button type="button" className="data-table-row-link" aria-label={rowActionLabel?.(row)} onClick={() => onRowClick(row)}>{column.cell(row)}</button>
                  : column.cell(row)}
              </td>)}
            </tr>
          })}
        </tbody>
      </table>
    </div> : <div className="data-table-no-match" role="status">
      <strong>No matching {count.plural}</strong>
      <p>Try a different search or clear the filters.</p>
      <button type="button" className="button button-secondary button-small" onClick={clearFilters}>Clear filters</button>
    </div>}

    {visibleRows.length > 0 && <div className="data-table-footer">
      <p aria-live="polite">{visibleRows.length > pageSize ? `Showing ${start + 1}–${Math.min(start + pageSize, visibleRows.length)} of ${label(visibleRows.length)}` : label(visibleRows.length)}{filtersActive && rows.length !== visibleRows.length ? ` (filtered from ${rows.length.toLocaleString()})` : ''}</p>
      {visibleRows.length > PAGE_SIZES[0] && <div className="data-table-pager">
        <label><span>Rows</span><select id={`${id}-size`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}>{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <button type="button" className="icon-button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button>
        <span>Page {currentPage} of {pageCount}</span>
        <button type="button" className="icon-button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button>
      </div>}
    </div>}
  </div>
}
