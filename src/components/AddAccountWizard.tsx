import { useState } from 'react'
import { post } from '../lib/api'
import { useToast } from '../hooks/useToast'
import type { Account } from '../pages/Transactions/types'

// ── Sub-type options per account type ─────────────────────────────────────────

const BUDGET_SUBTYPES = ['Checking', 'Savings', 'Cash', 'Credit Card']
const TRACKING_SUBTYPES = ['Investment', 'Mortgage', 'Loan', 'Other']
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (account: Account) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddAccountWizard({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedType, setSelectedType] = useState<'budget' | 'tracking' | null>(null)
  const [subType, setSubType] = useState('')
  const [accountName, setAccountName] = useState('')
  const [balance, setBalance] = useState('0.00')
  const [currency, setCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  if (!open) return null

  const subTypeOptions = selectedType === 'budget' ? BUDGET_SUBTYPES : TRACKING_SUBTYPES

  function handleTypeSelect(type: 'budget' | 'tracking') {
    if (selectedType !== type) {
      setSelectedType(type)
      setSubType('')
    }
  }

  function handleSubTypeChange(value: string) {
    setSubType(value)
    setAccountName(value)
  }

  function handleNext() {
    if (!selectedType || !subType) return
    setStep(2)
    setError(null)
  }

  function handleBack() {
    setStep(1)
    setError(null)
  }

  function handleClose() {
    // Reset state on close
    setStep(1)
    setSelectedType(null)
    setSubType('')
    setAccountName('')
    setBalance('0.00')
    setCurrency('EUR')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType || !subType || !accountName.trim()) return

    const parsedBalance = parseFloat(balance)
    if (isNaN(parsedBalance)) {
      setError('Balance must be a valid number')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const account = await post<Account>('/accounts', {
        name: accountName.trim(),
        type: selectedType,
        account_type: subType,
        balance: Math.round(parsedBalance * 100) / 100,
        currency,
      })
      showToast({ message: 'Account added!', type: 'success' })
      // Reset state before calling onSuccess to avoid stale state
      setStep(1)
      setSelectedType(null)
      setSubType('')
      setAccountName('')
      setBalance('0.00')
      setCurrency('EUR')
      onSuccess(account)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create account'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 mb-5">
          <StepDot active={step >= 1} done={step > 1} label="1" />
          <div className={`flex-1 h-px ${step > 1 ? 'bg-indigo-600' : 'bg-gray-700'}`} />
          <StepDot active={step >= 2} done={false} label="2" />
        </div>

        {step === 1 ? (
          <>
            {/* ── Step 1: Account Type ── */}
            <h2 className="text-base font-semibold text-gray-100 mb-1">Add Your First Account</h2>
            <p className="text-sm text-gray-500 mb-5">What type of account is it?</p>

            {/* Type cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <TypeCard
                selected={selectedType === 'budget'}
                onClick={() => handleTypeSelect('budget')}
                emoji="🏦"
                title="Budget Account"
                description="Checking, Savings, Cash, Credit Card"
                note="Affects your budget"
              />
              <TypeCard
                selected={selectedType === 'tracking'}
                onClick={() => handleTypeSelect('tracking')}
                emoji="📊"
                title="Tracking Account"
                description="Investments, Mortgage, Loans"
                note="Net worth only"
              />
            </div>

            {/* Sub-type dropdown — only shown after a type is selected */}
            {selectedType && (
              <div className="mb-5">
                <label className="block text-xs text-gray-500 mb-1">Account sub-type</label>
                <select
                  value={subType}
                  onChange={e => handleSubTypeChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500"
                >
                  <option value="">Select sub-type…</option>
                  {subTypeOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleNext}
                disabled={!selectedType || !subType}
                className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
                  text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Step 2: Account Details ── */}
            <h2 className="text-base font-semibold text-gray-100 mb-1">Name Your Account</h2>
            <p className="text-sm text-gray-500 mb-5">
              {selectedType === 'budget' ? '🏦 Budget Account' : '📊 Tracking Account'} · {subType}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={e => { setAccountName(e.target.value); setError(null) }}
                  placeholder="e.g. My Checking"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Current Balance */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Current Balance</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={balance}
                  onChange={e => { setBalance(e.target.value); setError(null) }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500 tabular-nums"
                />
                <p className="text-xs text-gray-600 mt-1">Enter the balance as of today</p>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
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

              {error && (
                <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={saving || !accountName.trim()}
                  className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
                    text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Adding…' : 'Add Account'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface TypeCardProps {
  selected: boolean
  onClick: () => void
  emoji: string
  title: string
  description: string
  note: string
}

function TypeCard({ selected, onClick, emoji, title, description, note }: TypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-colors w-full
        ${selected
          ? 'border-indigo-500 bg-indigo-950/30'
          : 'border-gray-700 bg-gray-800/60 hover:border-gray-600 hover:bg-gray-800'
        }`}
    >
      <div className="text-2xl mb-2">{emoji}</div>
      <div className="text-sm font-medium text-gray-100 mb-1">{title}</div>
      <div className="text-xs text-gray-500 mb-2">{description}</div>
      <div className={`text-xs font-medium ${selected ? 'text-indigo-400' : 'text-gray-600'}`}>
        {note}
      </div>
    </button>
  )
}

interface StepDotProps {
  active: boolean
  done: boolean
  label: string
}

function StepDot({ active, done, label }: StepDotProps) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
        ${done ? 'bg-indigo-600 text-white'
          : active ? 'bg-indigo-600 text-white'
          : 'bg-gray-800 text-gray-500 border border-gray-700'
        }`}
    >
      {label}
    </div>
  )
}
