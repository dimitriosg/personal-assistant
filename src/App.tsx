import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/setup'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Budget from './pages/Budget'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import StressTest from './pages/StressTest'
import Postpone from './pages/Postpone'
import Calendar from './pages/Calendar'
import Prompt from './pages/Prompt'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'

function AppRoutes() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/settings/onboarding_complete')
      .then(r => r.json())
      .then(data => setOnboardingComplete(data.value === 'true'))
      .catch(() => setOnboardingComplete(false))
  }, [])

  if (onboardingComplete === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-600 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Setup wizard — no layout wrapper */}
      <Route path="/setup" element={<Setup />} />

      {/* Authenticated pages — all blocked until onboarding is complete */}
      <Route element={onboardingComplete ? <Layout /> : <Navigate to="/setup" replace />}>
        <Route path="/"              element={<ErrorBoundary><Budget /></ErrorBoundary>} />
        <Route path="/dashboard"     element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="/transactions"  element={<ErrorBoundary><Transactions /></ErrorBoundary>} />
        <Route path="/expenses"      element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
        <Route path="/income"        element={<ErrorBoundary><Income /></ErrorBoundary>} />
        <Route path="/stress-test"   element={<ErrorBoundary><StressTest /></ErrorBoundary>} />
        <Route path="/postpone"      element={<ErrorBoundary><Postpone /></ErrorBoundary>} />
        <Route path="/calendar"      element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
        <Route path="/prompt"        element={<ErrorBoundary><Prompt /></ErrorBoundary>} />
        <Route path="/settings"      element={<ErrorBoundary><Settings /></ErrorBoundary>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
