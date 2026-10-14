import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { requireSupabase } from './supabaseClient.js'

export interface LeaveBalance {
  type: string
  year: number
  annualDays: number | null
  approved: number
  pending: number
  available: number | null
  description: string
}

// The standalone visual-test entry supplies fictional data here. Production
// never installs this provider and always calls the authenticated database.
export const LeaveBalanceSource = createContext<((year: number) => Promise<LeaveBalance[]>) | null>(null)

export function useLeaveBalances(year: number, revision: unknown) {
  const source = useContext(LeaveBalanceSource)
  const pending = useRef<{ year: number; revision: unknown; result: Promise<LeaveBalance[]> } | null>(null)
  const [state, setState] = useState<{ year: number; balances: LeaveBalance[]; error: boolean } | null>(null)
  useEffect(() => {
    let active = true
    if (!pending.current || pending.current.year !== year || pending.current.revision !== revision) {
      pending.current = { year, revision, result: (async () => {
        if (source) return source(year)
        const { data, error } = await requireSupabase().rpc('my_leave_balances', { balance_year: year })
        if (error || !Array.isArray(data)) throw error || new Error('Invalid balances')
        const balances = data.map(row => {
          if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.type !== 'string'
            || typeof row.approved !== 'number' || typeof row.pending !== 'number'
            || (row.available !== null && typeof row.available !== 'number')
            || (row.annualDays !== null && typeof row.annualDays !== 'number')) throw new Error('Invalid balance')
          return { type: row.type, year, annualDays: row.annualDays, approved: row.approved, pending: row.pending,
            available: row.available, description: String(row.description || '') }
        })
        return balances
      })() }
    }
    void pending.current.result.then(balances => { if (active) setState({ year, balances, error: false }) })
      .catch(() => { if (active) setState({ year, balances: [], error: true }) })
    return () => { active = false }
  }, [year, revision, source])
  return state?.year === year ? state : null
}

export const balanceLabel = (balance?: LeaveBalance) => !balance ? 'Unavailable' : balance.available === null ? 'HR review' : `${balance.available} days`
