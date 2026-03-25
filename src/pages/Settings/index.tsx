import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    const confirmed = window.confirm(
      'This will delete ALL your data (income, expenses, transactions, stress tests) and restart the setup wizard.\n\nAre you sure?'
    )
    if (!confirmed) return

    setResetting(true)
    try {
      const r = await fetch('/api/onboarding/reset', { method: 'POST' })
      if (!r.ok) throw new Error(await r.text())
      navigate('/setup', { replace: true })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed')
      setResetting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-lg">

      <div>
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">App configuration and data management.</p>
      </div>

      {/* More settings panels will be added in a later build step */}

      {/* Danger zone */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Danger zone</h2>
        <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Reset &amp; re-run setup</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Deletes all income, expenses, transactions, and stress tests, then
                restarts the onboarding wizard. Settings are preserved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
