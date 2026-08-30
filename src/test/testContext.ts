import type { HrmsContextValue, HrmsSnapshot, PortalIdentity } from '../types/hrms.js'

export const emptySnapshot: HrmsSnapshot = {
  employees: [], securityAlerts: [], notifications: [], leaveRequests: [],
  employeeRequests: [], sessions: [], auditLog: [], zapScanRuns: [], zapFindings: [],
  alertResponses: [], attendance: [], payroll: [], benefits: [], goals: [], performance: [],
  documents: [], documentAcknowledgements: [], schedules: [], announcements: [],
  requestComments: [], lifecycleCases: [], lifecycleTasks: [], payrollRuns: [], performanceCycles: [],
}

const resolved = async () => emptySnapshot

export function createTestContext(overrides: Partial<HrmsContextValue> = {}): HrmsContextValue {
  return {
    user: null, data: emptySnapshot, loading: false, toast: null,
    notify: () => undefined,
    login: async () => ({ id: 'TEST', portal: 'employee', firstName: 'Test', lastName: 'User' }),
    verifyMfaLogin: async () => ({ id: 'TEST', portal: 'employee', firstName: 'Test', lastName: 'User' }),
    logout: async () => undefined, refreshData: resolved, inviteAdminAccount: resolved,
    completeAdminInvitation: resolved, addSecurityAlert: resolved, updateSecurityInvestigation: resolved,
    endSession: resolved, importZapReport: resolved, recordActivity: resolved,
    getOrganizationSecuritySummary: async () => ({ totalAccounts: 0, mfaEnabled: 0, mfaPending: 0, privilegedAccounts: 0, privilegedMfaEnabled: 0 }),
    respondToAlert: resolved, updateAlert: resolved, changePassword: resolved,
    getMfaStatus: async () => ({ enabled: false, factorId: null, currentLevel: 'aal1' }),
    beginMfaEnrollment: async () => ({ factorId: 'factor', qrCode: '', secret: '' }),
    verifyMfaEnrollment: async () => ({ enabled: true, factorId: 'factor', currentLevel: 'aal2' }),
    disableMfa: async () => ({ enabled: false, factorId: null, currentLevel: 'aal1' }),
    addEmployee: resolved, updateEmployee: resolved, updateProfilePhoto: resolved, saveBenefit: resolved, clock: resolved,
    submitLeave: resolved, submitRequest: resolved, addRequestComment: resolved, cancelRequest: resolved,
    markNotificationRead: resolved, markAllNotificationsRead: resolved, updateGoalProgress: resolved,
    acknowledgeDocument: resolved, saveSchedule: resolved, reviewLeave: resolved, reviewRequest: resolved,
    createLifecycleCase: resolved, updateLifecycleTask: resolved, completeInitialPassword: async () => null,
    generatePayroll: resolved, transitionPayrollRun: resolved, savePerformance: resolved,
    publishPerformance: resolved, createPerformanceCycle: resolved, saveGoal: resolved,
    createDocument: resolved, addAnnouncement: resolved,
    ...overrides,
  }
}

export const adminIdentity: PortalIdentity = {
  id: 'ADM-TEST', portal: 'admin', firstName: 'Admin', lastName: 'Tester',
  role: 'admin', status: 'Active', email: 'admin@example.test',
}

export const employeeIdentity: PortalIdentity = {
  id: 'EMP-TEST', portal: 'employee', firstName: 'Employee', lastName: 'Tester',
  role: 'employee', status: 'Active', email: 'employee@example.test',
}
