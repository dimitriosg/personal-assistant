import { useState, useEffect, useCallback } from 'react'
import { get, post, del } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import TransactionForm, { type TransactionPayload } from '../../pages/Transactions/TransactionForm'
import type { CategoryGroup } from '../../pages/Transactions/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RegisterRow {
  id: number
  date: string
  description: string | null
  amount: number
  type: 'income' | 'expense'
  category_id: number | null
  category_name: string | null
  account_id: number | null
  running_balance: number
}

interface Props {
  accountId: number
  accountName: string
  groups: CategoryGroup[]
  payees: string[]
  onTransactionChange: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccountRegister({
  accountId,
  accountName,
  groups,
  payees,
  onTransactionChange,
}: Props) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<RegisterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchRegister = useCallback(async () => {
    setLoading(true)
    try {
      const data = await get<RegisterRow[]>(`/accounts/${accountId}/register`)
      setRows(data)
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to load register',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [accountId, showToast])

  useEffect(() => {
    fetchRegister()
  }, [fetchRegister])

  async function handleSave(data: TransactionPayload) {
    setShowForm(false)
    try {
      await post('/transactions', { ...data, account_id: accountId })
      showToast({ message: 'Transaction added', type: 'success' })
      await fetchRegister()
      onTransactionChange()
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to save transaction',
        type: 'error',
      })
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return
    try {
      await del(`/transactions/${id}`)
      showToast({ message: 'Transaction deleted', type: 'success' })
      await fetchRegister()
      onTransactionChange()
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to delete transaction',
        type: 'error',
      })
    }
  }

  const finalBalance = rows.length > 0 ? rows[rows.length - 1].running_balance : 0

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-7 w-40 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 w-20 bg-gray-800 rounded-full animate-pulse" />
          </div>
          <div className="h-8 w-36 bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800/40 border-b border-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-100">{accountName}</h2>
          <span
            className={`text-sm font-medium px-2.5 py-0.5 rounded-full tabular-nums ${
              finalBalance < 0
                ? 'bg-red-900/30 text-red-400 border border-red-800/40'
                : 'bg-green-900/30 text-green-400 border border-green-800/40'
            }`}
          >
            {fmt(finalBalance)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
            text-white rounded-lg transition-colors"
        >
          + Add Transaction
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/60 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Running Balance</th>
              <th className="px-2 py-2 w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-600 text-sm">
                  No transactions for this account yet.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group"
                >
                  {/* Date */}
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>

                  {/* Description */}
                  <td className="px-3 py-2 text-gray-200 max-w-[200px] truncate">
                    {row.description || <span className="text-gray-600 italic">—</span>}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2 max-w-[200px] truncate">
                    {row.category_name ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-xs font-medium
                          bg-indigo-600/15 text-indigo-300 border border-indigo-600/20 truncate max-w-full"
                      >
                        {row.category_name}
                      </span>
                    ) : row.type === 'income' ? (
                      <span className="text-xs font-medium text-green-400">Ready to Assign</span>
                    ) : (
                      <span className="text-gray-600 italic">Uncategorized</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {row.type === 'income' ? (
                      <span className="text-green-400">+{fmt(row.amount)}</span>
                    ) : (
                      <span className="text-red-400">{fmt(Math.abs(row.amount))}</span>
                    )}
                  </td>

                  {/* Running Balance */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className={row.running_balance < 0 ? 'text-red-400' : 'text-green-400'}>
                      {fmt(row.running_balance)}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400
                        transition-colors text-sm px-1"
                      title="Delete transaction"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Transaction modal */}
      {showForm && (
        <TransactionForm
          transaction={null}
          groups={groups}
          payees={payees}
          accountId={accountId}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
