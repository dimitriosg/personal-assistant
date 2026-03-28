import { useState } from 'react'
import { post } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import type { Account } from '../../pages/Transactions/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const BUDGET_SUBTYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
]

const TRACKING_SUBTYPES = [
  { value: 'investment', label: 'Investment' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
]

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

// ── Props ──────────────────────────────────────────────────────────────────────

interface AddAccountWizardProps {
  onClose: () => void
  onSuccess: (account: Account) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AddAccountWizard({ onClose, onSuccess }: AddAccountWizardProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [accountType, setAccountType] = useState<'budget' | 'tracking' | null>(null)
  const [accountSubtype, setAccountSubtype] = useState('')

  // Step 2 state
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('0.00')
  const [currency, setCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)

  const subtypes = accountType === 'budget' ? BUDGET_SUBTYPES : TRACKING_SUBTYPES

  function handleTypeSelect(type: 'budget' | 'tracking') {
    setAccountType(type)
    setAccountSubtype('')
  }

  function handleNext() {
    if (!accountType || !accountSubtype) return
    // Pre-fill name with subtype label
    const found = subtypes.find(s => s.value === accountSubtype)
    setName(found?.label ?? accountSubtype)
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountType || !accountSubtype || !name.trim()) return

    setSaving(true)
    try {
      const created = await post<Account>('/accounts', {
        name: name.trim(),
        type: accountType,
        account_type: accountSubtype,
        balance: parseFloat(balance) || 0,
        currency,
      })
      showToast({ message: 'Account added!', type: 'success' })
      onSuccess(created)
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to add account',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">
            {step === 1 ? 'What kind of account?' : 'Name your account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="p-5 space-y-4">
            {/* Type cards */}
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                emoji="🏦"
                title="Budget Account"
                description="Checking, Savings, Cash, Credit Card"
                subtext="Affects your budget"
                selected={accountType === 'budget'}
                onClick={() => handleTypeSelect('budget')}
              />
              <TypeCard
                emoji="📊"
                title="Tracking Account"
                description="Investments, Mortgage, Loans"
                subtext="Net worth only"
                selected={accountType === 'tracking'}
                onClick={() => handleTypeSelect('tracking')}
              />
            </div>

            {/* Sub-type dropdown */}
            {accountType && (
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Account sub-type</label>
                <select
                  value={accountSubtype}
                  onChange={e => setAccountSubtype(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Select sub-type…</option>
                  {subtypes.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleNext}
                disabled={!accountType || !accountSubtype}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                  disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm
                  font-medium transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Account name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                  text-sm text-gray-200 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Balance */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Opening balance</label>
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                step="0.01"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                  text-sm text-gray-200 outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-gray-600">Enter today's balance</p>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                  text-sm text-gray-200 outline-none focus:border-indigo-500"
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                  disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm
                  font-medium transition-colors"
              >
                {saving ? 'Adding…' : 'Add Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────

function TypeCard({
  emoji,
  title,
  description,
  subtext,
  selected,
  onClick,
}: {
  emoji: string
  title: string
  description: string
  subtext: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-600/10'
          : 'border-gray-700 bg-gray-800/60 hover:border-gray-600'
      }`}
    >
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="text-sm font-medium text-gray-200 mb-1">{title}</div>
      <div className="text-[11px] text-gray-500 leading-tight">{description}</div>
      <div className="text-[10px] text-gray-600 mt-1.5 italic">{subtext}</div>
    </button>
  )
}
