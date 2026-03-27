import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BudgetCategory } from './types'
import CategoryProgressBar from '../../components/budget/CategoryProgressBar'
import { get } from '../../lib/api'
import { resolveExpression } from '../../utils/resolveExpression'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

interface Transaction {
  id: number
  date: string
  payee: string | null
  amount: number
  memo: string | null
}

interface Props {
  category: BudgetCategory
  month: string
  onClose: () => void
  onAssign: (categoryId: number, month: string, assigned: number) => void
}

export default function CategoryInspector({ category, month, onClose, onAssign }: Props) {
  const navigate = useNavigate()
  const [quickAssign, setQuickAssign] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the Quick Assign input when Inspector opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [category.id])

  // Fetch recent transactions for this category + month
  useEffect(() => {
    setLoadingTx(true)
    setTransactions([])
    get<Transaction[]>(`/transactions?category_id=${category.id}&month=${month}`)
      .then(data => setTransactions(data.slice(0, 5)))
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false))
  }, [category.id, month])

  function handleQuickAssignSubmit() {
    const trimmed = quickAssign.trim()
    if (!trimmed) return
    const newAmount = resolveExpression(trimmed, category.assigned)
    if (isNaN(newAmount)) return
    onAssign(category.id, month, newAmount)
    setQuickAssign('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleQuickAssignSubmit()
    if (e.key === 'Escape') onClose()
  }

  const target = category.target
  const hasTarget = target !== null && target.target_amount > 0

  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-l border-[#2a2a4a] bg-[#1a1a2e] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a4a] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {category.emoji && (
            <span className="text-base leading-none shrink-0">{category.emoji}</span>
          )}
          <span className="text-sm font-semibold text-gray-200 truncate">{category.name}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 transition-colors text-base leading-none shrink-0 ml-2"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Assigned / Activity / Available */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-400">Assigned</span>
            <span className="tabular-nums text-gray-200">{fmt(category.assigned)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-400">Activity</span>
            <span className={`tabular-nums ${category.activity < 0 ? 'text-red-400' : 'text-gray-200'}`}>
              {fmt(category.activity)}
            </span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-400">Available</span>
            <span className={`tabular-nums font-medium ${
              category.available < 0 ? 'text-red-400'
              : category.available > 0 ? 'text-green-400'
              : 'text-gray-500'
            }`}>
              {fmt(category.available)}
            </span>
          </div>
        </div>

        {/* Target section */}
        {hasTarget && target && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Target</p>
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-400">Target</span>
              <span className="tabular-nums text-gray-200">{fmt(target.target_amount)}</span>
            </div>
            <CategoryProgressBar
              assigned={category.assigned}
              targetAmount={target.target_amount}
              available={category.available}
            />
          </div>
        )}

        {/* Quick Assign */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Quick Assign</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={quickAssign}
              onChange={e => setQuickAssign(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 50  +20  -10  =300"
              className="flex-1 bg-[#2a2a4a] border border-[#3a3a5a] text-white text-sm
                rounded px-2 py-1 outline-none focus:border-indigo-500 placeholder:text-gray-600"
            />
            <button
              onClick={handleQuickAssignSubmit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1 rounded
                transition-colors shrink-0"
            >
              Set
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1">Supports expressions: +20  -10  =300</p>
        </div>

        {/* Recent Transactions */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Recent Transactions</p>
          {loadingTx ? (
            <p className="text-xs text-gray-600">Loading…</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-gray-600">No transactions this month.</p>
          ) : (
            <div className="space-y-1">
              {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between text-xs py-0.5">
                  <div className="flex flex-col min-w-0 mr-2">
                    <span className="text-gray-500">{tx.date}</span>
                    <span className="text-gray-300 truncate">{tx.payee ?? '—'}</span>
                  </div>
                  <span className={`tabular-nums shrink-0 ${tx.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate(`/transactions?categoryId=${category.id}`)}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all transactions →
          </button>
        </div>
      </div>
    </aside>
  )
}
