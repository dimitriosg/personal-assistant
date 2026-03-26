import { useState } from 'react'
import type { Transaction, CategoryGroup } from './types'
import CategoryPicker from './CategoryPicker'
import PayeeInput from './PayeeInput'

interface Props {
  transaction: Transaction | null   // null = "add new"
  groups: CategoryGroup[]
  payees: string[]
  onSave: (data: TransactionPayload) => Promise<void>
  onClose: () => void
}

export interface TransactionPayload {
  date: string
  payee: string
  category_id: number | null
  memo: string
  amount: number
  cleared: boolean
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TransactionForm({ transaction, groups, payees, onSave, onClose }: Props) {
  const isEdit = transaction !== null

  const [date, setDate] = useState(transaction?.date ?? todayISO())
  const [payee, setPayee] = useState(transaction?.payee ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(transaction?.category_id ?? null)
  const [memo, setMemo] = useState(transaction?.memo ?? '')
  const [type, setType] = useState<'outflow' | 'inflow'>(
    transaction ? (transaction.amount > 0 ? 'inflow' : 'outflow') : 'outflow'
  )
  const [amount, setAmount] = useState(
    transaction ? String(Math.abs(transaction.amount)) : ''
  )
  const [cleared, setCleared] = useState(transaction?.cleared ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!date.trim()) {
      setError('Date is required')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Date must be in YYYY-MM-DD format')
      return
    }
    if (isNaN(amt) || amt <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    if (amt > 999999999) {
      setError('Amount must not exceed 999,999,999')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave({
        date: date.trim(),
        payee: payee.trim(),
        category_id: categoryId,
        memo: memo.trim(),
        amount: type === 'outflow' ? -amt : amt,
        cleared,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-100 mb-4">
          {isEdit ? 'Edit Transaction' : 'Add Transaction'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500
                [color-scheme:dark]"
            />
          </div>

          {/* Payee */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payee</label>
            <PayeeInput value={payee} payees={payees} onChange={setPayee} />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <CategoryPicker
              value={categoryId}
              groups={groups}
              onChange={setCategoryId}
              className="w-full"
            />
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Memo</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="Optional note"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Type toggle + Amount */}
          <div className="flex gap-3">
            <div className="shrink-0">
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setType('outflow')}
                  className={`px-3 py-2 text-sm transition-colors ${
                    type === 'outflow'
                      ? 'bg-red-600/20 text-red-400 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Outflow
                </button>
                <button
                  type="button"
                  onClick={() => setType('inflow')}
                  className={`px-3 py-2 text-sm transition-colors ${
                    type === 'inflow'
                      ? 'bg-green-600/20 text-green-400 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Inflow
                </button>
              </div>
            </div>

            <div className="flex-1">
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
            </div>
          </div>

          {/* Cleared */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cleared}
              onChange={e => setCleared(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500
                focus:ring-indigo-500 focus:ring-offset-0"
            />
            <span className="text-sm text-gray-400">Cleared / Reconciled</span>
          </label>

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
              disabled={saving || !amount || !date}
              className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
                text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
