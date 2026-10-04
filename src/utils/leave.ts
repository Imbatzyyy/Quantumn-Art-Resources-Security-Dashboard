import type { HrmsSnapshot, LeavePolicyRecord, LeaveRequestRecord } from '../types/hrms.js'

export const LEAVE_TYPES = ['Vacation', 'Sick', 'Emergency', 'Other'] as const

/** The organization defaults, used until HR saves its own allowances. */
export const DEFAULT_LEAVE_POLICIES: LeavePolicyRecord[] = [
  { type: 'Vacation', annualDays: 12, description: 'Planned time off. File at least a few days ahead.' },
  { type: 'Sick', annualDays: 12, description: 'Illness or medical appointments.' },
  { type: 'Emergency', annualDays: 3, description: 'Unexpected family or personal emergencies.' },
  { type: 'Other', annualDays: null, description: 'Reviewed case by case by HR.' },
]

export function leavePoliciesOf(data: Pick<HrmsSnapshot, 'leavePolicies'> | null | undefined): LeavePolicyRecord[] {
  const saved = data?.leavePolicies ?? []
  return LEAVE_TYPES.map((type) => saved.find((policy) => policy.type === type)
    ?? DEFAULT_LEAVE_POLICIES.find((policy) => policy.type === type)
    ?? { type, annualDays: null, description: '' })
}

export interface LeaveBalance {
  type: string
  /** Yearly allowance in days; null when the type has no fixed allowance. */
  allowance: number | null
  used: number
  pending: number
  /** Days left after approved leave; null when there is no fixed allowance. */
  remaining: number | null
}

const daysIn = (requests: LeaveRequestRecord[], type: string, status: string, year: string) => requests
  .filter((request) => request.type === type && request.status === status && request.startDate.startsWith(year))
  .reduce((total, request) => total + request.days, 0)

/** Per-type balances for one employee in one calendar year ("2026"). */
export function leaveBalances(policies: LeavePolicyRecord[], requests: LeaveRequestRecord[], employeeId: string, year: string): LeaveBalance[] {
  const own = requests.filter((request) => request.employeeId === employeeId)
  return policies.map((policy) => {
    const used = daysIn(own, policy.type, 'Approved', year)
    return {
      type: policy.type,
      allowance: policy.annualDays,
      used,
      pending: daysIn(own, policy.type, 'Pending', year),
      remaining: policy.annualDays == null ? null : Math.max(0, policy.annualDays - used),
    }
  })
}

export function balanceFor(balances: LeaveBalance[], type: string): LeaveBalance | undefined {
  return balances.find((balance) => balance.type === type)
}

export const formatLeaveDays = (days: number) => `${Number.isInteger(days) ? days : days.toFixed(1)} day${days === 1 ? '' : 's'}`

/** Employees can withdraw pending leave, or approved leave that has not started. */
export const canCancelLeave = (request: LeaveRequestRecord, today: string) =>
  request.status === 'Pending' || (request.status === 'Approved' && request.startDate > today)
