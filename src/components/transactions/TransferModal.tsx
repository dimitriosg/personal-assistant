import { useState } from 'react'
import { post } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import type { Account } from '../../pages/Transactions/types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface TransferModalProps {
  accounts: Account[]
  fromAccountId?: number
  onClose: () => void
  onSuccess: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TransferModal({
  accounts,
  fromAccountId,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const { showToast } = useToast()

  const budgetAccounts = accounts.filter(a => a.type === 'budget')

  const [fromId, setFromId] = useState<string>(
    fromAccountId != null ? String(fromAccountId) : (budgetAccounts[0]?.id != null ? String(budgetAccounts[0].id) : '')
  )
  const [toId, setToId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toAccounts = budgetAccounts.filter(a => String(a.id) !== fromId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fromId || !toId) {
      setError('Both accounts are required')
      return
    }
    if (fromId === toId) {
      setError('From and To accounts must be different')
      return
    }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be a positive number')
      return
    }
    if (!date) {
      setError('Date is required')
      return
    }

    setSaving(true)
    try {
      await post('/transactions/transfer', {
        from_account_id: Number(fromId),
        to_account_id: Number(toId),
        amount: amt,
        date,
        description: description.trim() || undefined,
      })
      showToast({ message: 'Transfer saved', type: 'success' })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transfer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-100">↔ Transfer Between Accounts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* From Account */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">From Account</label>
            <select
              value={fromId}
              onChange={e => {
                setFromId(e.target.value)
                if (toId === e.target.value) setToId('')
              }}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select account…</option>
              {budgetAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* To Account */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">To Account</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select account…</option>
              {toAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500 [color-scheme:dark]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Description <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Savings top-up"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm
                font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
