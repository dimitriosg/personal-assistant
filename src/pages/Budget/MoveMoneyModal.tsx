import { useState } from 'react'
import type { BudgetGroup } from './types'
import { post } from '../../lib/api'

interface Props {
  month: string
  groups: BudgetGroup[]
  onComplete: () => void
  onClose: () => void
}

interface CategoryOption {
  id: number
  name: string
  groupName: string
  available: number
}

export default function MoveMoneyModal({ month, groups, onComplete, onClose }: Props) {
  const [fromId, setFromId] = useState<number | ''>('')
  const [toId, setToId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Flatten categories for dropdowns
  const options: CategoryOption[] = groups.flatMap(g =>
    g.categories.map(c => ({
      id: c.id,
      name: c.name,
      groupName: g.name,
      available: c.available,
    }))
  )

  const fromCat = options.find(o => o.id === fromId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromId || !toId || !amount) return

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await post('/budget/move', {
        from_category_id: fromId,
        to_category_id: toId,
        month,
        amount: amt,
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move money')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-100 mb-4">Move Money</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* From category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">From category</label>
            <select
              value={fromId}
              onChange={e => setFromId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select source…</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (€{c.available.toFixed(2)} available)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* To category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">To category</label>
            <select
              value={toId}
              onChange={e => setToId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select destination…</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories.filter(c => c.id !== fromId).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (€{c.available.toFixed(2)} available)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (EUR)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500 tabular-nums"
            />
            {fromCat && (
              <div className="text-xs text-gray-600 mt-1">
                Available in {fromCat.name}: €{fromCat.available.toFixed(2)}
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !fromId || !toId || !amount}
              className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
                text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Moving…' : 'Move Money'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
