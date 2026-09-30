import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import App from './App.js'
import { HrmsProvider } from './state/HrmsContext.js'

const AccountPolicyPage = lazy(() => import('./pages/AccountPolicyPage.js'))

export default function AppRouter() {
  return <Routes>
    {/* Public notices do not need an Auth session or a database connection. */}
    <Route path="/terms" element={<Suspense fallback={<main className="app-loading">Loading terms…</main>}><AccountPolicyPage kind="terms" /></Suspense>} />
    <Route path="/privacy" element={<Suspense fallback={<main className="app-loading">Loading privacy notice…</main>}><AccountPolicyPage kind="privacy" /></Suspense>} />
    <Route path="*" element={<HrmsProvider><App /></HrmsProvider>} />
  </Routes>
}
