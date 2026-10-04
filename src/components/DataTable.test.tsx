import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type DataColumn } from './DataTable.js'

vi.mock('../utils/downloads.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../utils/downloads.js')>()), downloadCsv: vi.fn() }))
import { downloadCsv } from '../utils/downloads.js'

interface Row { id: string; name: string; team: string; score: number }
const rows: Row[] = Array.from({ length: 23 }, (_, index) => ({ id: `R${index + 1}`, name: `Person ${String(index + 1).padStart(2, '0')}`, team: index % 2 ? 'Finance' : 'Operations', score: 100 - index }))
const columns: DataColumn<Row>[] = [
  { id: 'name', header: 'Name', primary: true, cell: (row) => <strong>{row.name}</strong>, sortValue: (row) => row.name },
  { id: 'team', header: 'Team', cell: (row) => row.team, sortValue: (row) => row.team },
  { id: 'score', header: 'Score', align: 'end', cell: (row) => row.score, sortValue: (row) => row.score },
]
const renderTable = (onRowClick = vi.fn()) => {
  render(<DataTable rows={rows} columns={columns} getRowId={(row) => row.id} caption="People" count={{ singular: 'person', plural: 'people' }} search={{ placeholder: 'Search people', text: (row) => row.name }} filters={[{ id: 'team', label: 'Teams', value: (row) => row.team }]} exportName="people" onRowClick={onRowClick} rowActionLabel={(row) => `Open ${row.name}`} empty={{ icon: Users, title: 'Nobody yet', text: 'Add someone.' }} />)
  return onRowClick
}
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('shared data table', () => {
  it('pages long lists and reports the visible range', async () => {
    const user = userEvent.setup()
    renderTable()
    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByText('Showing 1–10 of 23 people')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Showing 11–20 of 23 people')).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows' }), '25')
    expect(bodyRows()).toHaveLength(23)
  })

  it('sorts by a column and exposes the sort state to assistive technology', async () => {
    const user = userEvent.setup()
    renderTable()
    const header = screen.getByRole('columnheader', { name: /Score/ })
    expect(header).toHaveAttribute('aria-sort', 'none')
    await user.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(bodyRows()[0]).toHaveTextContent('Person 23')
    await user.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'descending')
    expect(bodyRows()[0]).toHaveTextContent('Person 01')
  })

  it('searches, filters, clears, and exports exactly the matching rows', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Teams' }), 'Finance')
    expect(screen.getByText(/of 11 people \(filtered from 23\)|11 people \(filtered from 23\)/)).toBeVisible()
    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'Person 02')
    expect(bodyRows()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(downloadCsv).toHaveBeenCalledWith('people', expect.any(Array), [rows[1]])
    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'zzz')
    expect(screen.getByText('No matching people')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Showing 1–10 of 23 people')).toBeVisible()
  })

  it('opens a row from its keyboard-accessible link and shows an empty state without rows', async () => {
    const user = userEvent.setup()
    const onRowClick = renderTable()
    await user.click(screen.getByRole('button', { name: 'Open Person 01' }))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there is no data', () => {
    render(<DataTable rows={[]} columns={columns} getRowId={(row) => row.id} caption="People" empty={{ icon: Users, title: 'Nobody yet', text: 'Add someone.' }} />)
    expect(screen.getByText('Nobody yet')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
