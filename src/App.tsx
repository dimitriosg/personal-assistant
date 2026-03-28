import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/setup'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import AddAccountWizard from './components/AddAccountWizard'
import Budget from './pages/Budget'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import StressTest from './pages/StressTest'
import Postpone from './pages/Postpone'
import Calendar from './pages/Calendar'
import Prompt from './pages/Prompt'
import Assistant from './pages/Assistant'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'
import type { Account } from './pages/Transactions/types'

function AppRoutes() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    fetch('/api/settings/onboarding_complete')
      .then(r => r.json())
      .then(data => setOnboardingComplete(data.value === 'true'))
      .catch(() => setOnboardingComplete(false))
  }, [])

  // Once onboarding is confirmed complete, check if any accounts exist
  useEffect(() => {
    if (!onboardingComplete) return
    fetch('/api/accounts')
      .then(r => r.json())
      .then((accounts: Account[]) => {
        if (Array.isArray(accounts) && accounts.length === 0) {
          setWizardOpen(true)
        }
      })
      .catch(() => {/* silent — don't block the app */})
  }, [onboardingComplete])

  if (onboardingComplete === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-600 text-sm">Loading…</div>
      </div>
    )
  }

  function handleWizardSuccess(account: Account) {
    setWizardOpen(false)
  }

  return (
    <>
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
          <Route path="/assistant"     element={<ErrorBoundary><Assistant /></ErrorBoundary>} />
          <Route path="/settings"      element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {onboardingComplete && (
        <AddAccountWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  )
}
