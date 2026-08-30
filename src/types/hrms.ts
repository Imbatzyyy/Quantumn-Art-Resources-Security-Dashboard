import type { LucideIcon } from 'lucide-react'

export type PortalKind = 'admin' | 'employee'
export type ThemeMode = 'light' | 'dark'

export interface PortalNavigationItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: 'alerts' | 'inbox' | 'approvals' | number | string
  group?: string
}

export interface PortalIdentity {
  id: string
  portal: PortalKind
  firstName: string
  lastName: string
  preferredName?: string
  position?: string
  department?: string
  role?: string
  mustSetPassword?: boolean
  mustChangePassword?: boolean
}

export interface SecurityAlertSummary {
  employeeId?: string
  status: string
  severity?: string
}

export interface NotificationSummary {
  employeeId: string
  readAt?: string | null
}

export interface WorkflowSummary {
  status: string
}

export interface HrmsSnapshot {
  securityAlerts: SecurityAlertSummary[]
  notifications: NotificationSummary[]
  leaveRequests: WorkflowSummary[]
  employeeRequests: WorkflowSummary[]
}

export interface ToastMessage {
  message: string
  tone: 'success' | 'error' | 'warning' | 'info'
  exiting?: boolean
}

export interface HrmsContextValue {
  user: PortalIdentity | null
  data: HrmsSnapshot | null
  loading: boolean
  toast: ToastMessage | null
  logout: () => Promise<void>
  refreshData: () => Promise<unknown>
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export type StatTone = 'blue' | 'green' | 'amber' | 'purple' | 'red'
