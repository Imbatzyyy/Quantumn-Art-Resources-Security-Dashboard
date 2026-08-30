import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import EmployeeRecoveryPage from './pages/EmployeeRecoveryPage.jsx'
import AdminPortal from './pages/AdminPortal.jsx'
import EmployeePortal from './pages/EmployeePortal.jsx'
import AdminInviteSetupPage from './pages/AdminInviteSetupPage.jsx'
import { useHrms } from './state/useHrms.js'

function Protected({ portal, children }) {
  const { user, loading } = useHrms()
  if (loading) return <div className="app-loading"><span /><p>Preparing your secure workspace…</p></div>
  if (!user || user.portal !== portal) return <Navigate to={`/${portal}/login`} replace />
  if (portal === 'admin' && user.mustSetPassword) return <Navigate to="/admin/setup-password" replace />
  return children
}

export default function App() {
  const { user, toast } = useHrms()

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={user ? `/${user.portal}` : '/admin/login'} replace />} />
        <Route path="/admin/login" element={user?.portal === 'admin' ? <Navigate to="/admin" replace /> : <LoginPage key="admin-login" portal="admin" />} />
        <Route path="/admin/setup-password" element={<AdminInviteSetupPage />} />
        <Route path="/employee/login" element={user?.portal === 'employee' ? <Navigate to="/employee" replace /> : <LoginPage key="employee-login" portal="employee" />} />
        <Route path="/employee/forgot-password" element={<EmployeeRecoveryPage mode="request" />} />
        <Route path="/employee/reset-password" element={<EmployeeRecoveryPage mode="update" />} />
        <Route path="/admin/*" element={<Protected portal="admin"><AdminPortal /></Protected>} />
        <Route path="/employee/*" element={<Protected portal="employee"><EmployeePortal /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast && <div className={`toast toast-${toast.tone}${toast.exiting ? ' toast-exiting' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'} aria-live="polite">{toast.message}</div>}
    </>
  )
}
