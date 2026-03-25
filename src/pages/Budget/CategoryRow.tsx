import { useState, useRef, useEffect } from 'react'
import type { BudgetCategory } from './types'
import AmountCell from './AmountCell'
import StatusBadge, { deriveStatus } from '../../components/StatusBadge'
import TargetProgressBar from '../../components/TargetProgressBar'

interface Props {
  category: BudgetCategory
  month: string
  onAssign: (categoryId: number, month: string, assigned: number) => void
}

export default function CategoryRow({ category, month, onAssign }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function startEdit() {
    setEditValue(category.assigned === 0 ? '' : category.assigned.toFixed(2))
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const val = parseFloat(editValue)
    if (!isNaN(val) && val !== category.assigned) {
      onAssign(category.id, month, val)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  // Determine Available badge/color
  const availColor =
    category.available > 0 ? 'text-green-400'
    : category.available < 0 ? 'text-red-400'
    : 'text-gray-600'

  // Derive status badge
  const target = category.target
  const status = deriveStatus(
    category.available,
    category.assigned,
    category.activity,
    target?.target_amount ?? null,
  )

  return (
    <div className="group grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] gap-1 items-center px-3 sm:px-4 py-1.5
      hover:bg-gray-800/40 transition-colors text-sm border-b border-gray-800/40 last:border-0">

      {/* Category name + badges + target progress */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-gray-300">
            {category.name}
          </span>
          {category.is_shared && (
            <span className="shrink-0 text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              shared
            </span>
          )}
          <StatusBadge status={status} />
        </div>
        {/* Target progress bar (shown only when a target exists) */}
        {target && (
          <TargetProgressBar
            assigned={category.assigned}
            targetAmount={target.target_amount}
            targetType={target.target_type}
            targetDate={target.target_date}
          />
        )}
      </div>

      {/* Assigned — editable */}
      <div className="text-right">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-800 border border-indigo-500 rounded px-1.5 py-0.5
              text-right text-sm text-gray-100 outline-none tabular-nums"
          />
        ) : (
          <button
            onClick={startEdit}
            className="w-full text-right tabular-nums text-gray-300 hover:text-indigo-400
              hover:bg-indigo-500/10 rounded px-1.5 py-0.5 transition-colors cursor-text"
            title="Click to edit assigned amount"
          >
            <AmountCell value={category.assigned} />
          </button>
        )}
      </div>

      {/* Activity */}
      <div className="text-right">
        <AmountCell value={category.activity} variant="activity" />
      </div>

      {/* Available */}
      <div className={`text-right font-medium ${availColor}`}>
        <AmountCell value={category.available} variant="available" />
      </div>
    </div>
  )
}
