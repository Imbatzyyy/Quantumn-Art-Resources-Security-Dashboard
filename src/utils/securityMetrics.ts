import type { AttendanceRecord } from '../types/hrms.js'

export const isOpenSecurityAlert = (status: string) => !['Resolved', 'False Positive'].includes(status)
export const securitySeverityOrder = (severity: string) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 })[severity] ?? 4
export const businessDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

// An open shift may span Philippine midnight. Match the protected clock RPC.
export function attendanceForClock(records: AttendanceRecord[], employeeId: string, now = new Date()) {
  const today = businessDate(now)
  const yesterday = businessDate(new Date(now.getTime() - 86_400_000))
  return records.find((row) => row.employeeId === employeeId && row.date >= yesterday && row.date <= today && row.clockIn && !row.clockOut)
    ?? records.find((row) => row.employeeId === employeeId && row.date === today)
}

export function isUnclosedPastShift(row: AttendanceRecord, now = new Date()) {
  return Boolean(row.clockIn && !row.clockOut && now.getTime() - Date.parse(`${row.date}T${row.clockIn}:00+08:00`) > 86_400_000)
}
