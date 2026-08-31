import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useHrms } from './state/useHrms.js'

const LoginPage = lazy(() => import('./pages/LoginPage.js'))
const EmployeeRecoveryPage = lazy(() => import('./pages/EmployeeRecoveryPage.js'))
const AdminPortal = lazy(() => import('./pages/AdminPortal.js'))
const EmployeePortal = lazy(() => import('./pages/EmployeePortal.js'))
const AdminInviteSetupPage = lazy(() => import('./pages/AdminInviteSetupPage.js'))

function WorkspaceLoading() {
  return <div className="app-loading"><span /><p>Preparing your secure workspace…</p></div>
}

function Protected({ portal, children }: { portal: 'admin' | 'employee'; children: ReactNode }) {
  const { user, loading } = useHrms()
  if (loading) return <WorkspaceLoading />
  if (!user || user.portal !== portal) return <Navigate to={`/${portal}/login`} replace />
  if (portal === 'admin' && user.mustSetPassword) return <Navigate to="/admin/setup-password" replace />
  return children
}

export default function App() {
  const { user, toast } = useHrms()

  return (
    <>
      <Suspense fallback={<WorkspaceLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/employee/login" replace />} />
          <Route path="/admin/login" element={user?.portal === 'admin' ? <Navigate to="/admin" replace /> : <LoginPage key="admin-login" portal="admin" />} />
          <Route path="/admin/setup-password" element={<AdminInviteSetupPage />} />
          <Route path="/employee/login" element={user?.portal === 'employee' ? <Navigate to="/employee" replace /> : <LoginPage key="employee-login" portal="employee" />} />
          <Route path="/employee/forgot-password" element={<EmployeeRecoveryPage mode="request" />} />
          <Route path="/employee/reset-password" element={<EmployeeRecoveryPage mode="update" />} />
          <Route path="/admin/*" element={<Protected portal="admin"><AdminPortal /></Protected>} />
          <Route path="/employee/*" element={<Protected portal="employee"><EmployeePortal /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {toast && <div className={`toast toast-${toast.tone}${toast.exiting ? ' toast-exiting' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live="polite">{toast.message}</div>}
    </>
  )
}
