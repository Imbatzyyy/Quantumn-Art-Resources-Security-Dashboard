import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useHrms } from './state/useHrms.js'

const LoginPage = lazy(() => import('./pages/LoginPage.js'))
const SignInVerificationPage = lazy(() => import('./pages/SignInVerificationPage.js'))
const EmployeeRecoveryPage = lazy(() => import('./pages/EmployeeRecoveryPage.js'))
const AdminPortal = lazy(() => import('./pages/AdminPortal.js'))
const EmployeePortal = lazy(() => import('./pages/EmployeePortal.js'))
const AdminInviteSetupPage = lazy(() => import('./pages/AdminInviteSetupPage.js'))
const SignOutConfirmation = lazy(() => import('./components/SignOutConfirmation.js'))

function WorkspaceLoading({ verified = false }: { verified?: boolean }) {
  return <div className="app-loading" role="status"><span aria-hidden="true" /><p>{verified ? 'Sign-in verified. Loading your workspace…' : 'Preparing your secure workspace…'}</p></div>
}

function WorkspaceLoadFailure({ portal }: { portal: 'admin' | 'employee' }) {
  const { retryWorkspaceLoad, logout } = useHrms()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  return <div className="app-loading workspace-load-error">
    <strong>Your sign-in is verified.</strong>
    <p role="alert">Your records could not load. Check your connection and try again.</p>
    <button className="button button-primary" onClick={() => void retryWorkspaceLoad?.()}>Try loading again</button>
    <button className="button button-secondary" onClick={() => setConfirmSignOut(true)}>Sign out</button>
    {confirmSignOut && <SignOutConfirmation open portal={portal} onCancel={() => setConfirmSignOut(false)} onConfirm={logout} />}
  </div>
}

function Protected({ portal, children }: { portal: 'admin' | 'employee'; children: ReactNode }) {
  const { user, data, loading } = useHrms()
  if (loading) return <WorkspaceLoading verified={Boolean(user)} />
  if (!user || user.portal !== portal) return <Navigate to={`/${portal}/login`} replace />
  if (portal === 'admin' && user.mustSetPassword) return <Navigate to="/admin/setup-password" replace />
  if (!data) return <WorkspaceLoadFailure portal={portal} />
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
          <Route path="/admin/verify-email" element={<SignInVerificationPage key="admin-verify" portal="admin" />} />
          <Route path="/employee/verify-email" element={<SignInVerificationPage key="employee-verify" portal="employee" />} />
          <Route path="/admin/setup-password" element={<AdminInviteSetupPage />} />
          <Route path="/admin/forgot-password" element={<EmployeeRecoveryPage portal="admin" mode="request" />} />
          <Route path="/admin/reset-password" element={<EmployeeRecoveryPage portal="admin" mode="update" />} />
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
