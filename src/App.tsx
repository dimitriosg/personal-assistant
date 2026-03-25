import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/setup'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import StressTest from './pages/StressTest'
import Settings from './pages/Settings'

// Placeholder pages — replaced in later build steps
const Placeholder = ({ name }: { name: string }) => (
  <div>
    <h1 className="text-xl font-bold text-gray-100 mb-2">{name}</h1>
    <p className="text-gray-500 text-sm">Coming in a later build step.</p>
  </div>
)

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
        <Route path="/"              element={<Dashboard />} />
        <Route path="/transactions"  element={<Placeholder name="Transactions" />} />
        <Route path="/expenses"      element={<Expenses />} />
        <Route path="/income"        element={<Income />} />
        <Route path="/stress-test"   element={<StressTest />} />
        <Route path="/postpone"      element={<Placeholder name="Postpone" />} />
        <Route path="/calendar"      element={<Placeholder name="Calendar" />} />
        <Route path="/prompt"        element={<Placeholder name="Prompt Generator" />} />
        <Route path="/settings"      element={<Settings />} />
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
