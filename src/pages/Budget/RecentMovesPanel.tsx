import { useEffect, useState } from 'react'
import { get, post } from '../../lib/api'

export interface BudgetMove {
  id: number
  from: string
  to: string
  fromCategoryId: number | null
  toCategoryId: number | null
  amount: number
  moved_at: string
  undone: number
}

interface Props {
  month: string
  monthLabel: string
  onClose: () => void
  onDataChange: () => void
  showToast: (opts: { message: string; type: 'success' | 'error' | 'info' }) => void
}

export default function RecentMovesPanel({ month, monthLabel, onClose, onDataChange, showToast }: Props) {
  const [moves, setMoves] = useState<BudgetMove[]>([])
  const [loading, setLoading] = useState(true)
  const [undoing, setUndoing] = useState<number | null>(null)

  async function fetchMoves() {
    try {
      const data = await get<BudgetMove[]>(`/budget/moves?month=${month}`)
      setMoves(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMoves()
  }, [month])

  async function handleUndo(move: BudgetMove) {
    setUndoing(move.id)
    try {
      await post(`/budget/moves/${move.id}/undo`, {})
      showToast({ message: `Move undone: EUR ${move.amount.toFixed(2)} back to ${move.from}`, type: 'info' })
      await fetchMoves()
      onDataChange()
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to undo', type: 'error' })
    } finally {
      setUndoing(null)
    }
  }

  function formatTime(movedAt: string) {
    try {
      const d = new Date(movedAt + 'Z')
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      {/* Panel sliding in from the right */}
      <div
        className="absolute top-0 right-0 h-full w-[300px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">
            Recent Moves — {monthLabel}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Moves list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && (
            <div className="text-center py-8 text-gray-500 text-xs">Loading…</div>
          )}
          {!loading && moves.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-xs">
              No moves for this month.
            </div>
          )}
          {moves.map(move => {
            const isUndone = move.undone === 1
            return (
              <div
                key={move.id}
                className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 bg-gray-800/60
                  ${isUndone ? 'text-gray-500 line-through' : 'text-gray-300'}`}
              >
                <span className="shrink-0">↕</span>
                <span className="flex-1 min-w-0 truncate">
                  EUR {move.amount.toFixed(2)}&ensp;{move.from} → {move.to}
                </span>
                <span className="shrink-0 text-gray-600">{formatTime(move.moved_at)}</span>
                <button
                  onClick={() => handleUndo(move)}
                  disabled={isUndone || undoing === move.id}
                  className={`shrink-0 text-indigo-400 hover:text-indigo-300 transition-colors
                    ${isUndone || undoing === move.id ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {undoing === move.id ? '…' : 'Undo'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
