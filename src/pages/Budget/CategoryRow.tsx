import { useState, useEffect, memo } from 'react'
import type { BudgetCategory } from './types'
import AmountCell from './AmountCell'
import StatusBadge, { deriveStatus } from '../../components/StatusBadge'
import CategoryProgressBar from '../../components/budget/CategoryProgressBar'
import AvailableBadge from '../../components/budget/AvailableBadge'
import EmojiPicker from '../../components/budget/EmojiPicker'
import { patch } from '../../lib/api'

interface Props {
  category: BudgetCategory
  onRowClick: (categoryId: number) => void
  /** ID of the category whose picker is currently open (null = none). */
  openPickerId: number | null
  /** Setter to open/close any picker — shared across all rows. */
  setOpenPickerId: (id: number | null) => void
  selectedIds: Set<number>
  onSelect: (id: number, checked: boolean) => void
}

export default memo(function CategoryRow({ category, onRowClick, openPickerId, setOpenPickerId, selectedIds, onSelect }: Props) {
  const [localEmoji, setLocalEmoji] = useState<string | null>(category.emoji)

  // Keep localEmoji in sync if the parent re-fetches and the value changes
  useEffect(() => {
    setLocalEmoji(category.emoji)
  }, [category.emoji])

  const isPickerOpen = openPickerId === category.id

  function togglePicker(e: React.MouseEvent) {
    e.stopPropagation()
    setOpenPickerId(isPickerOpen ? null : category.id)
  }

  async function handleEmojiSelect(emoji: string | null) {
    // Close picker immediately
    setOpenPickerId(null)
    // No-op if the value hasn't changed
    if (emoji === localEmoji) return
    // Optimistic update
    const prev = localEmoji
    setLocalEmoji(emoji)
    try {
      await patch(`/categories/${category.id}/emoji`, { emoji })
    } catch {
      // Revert on failure
      setLocalEmoji(prev)
    }
  }

  // Derive Available badge props
  const target = category.target
  const hasTarget = target !== null
  const isFunded = hasTarget && category.assigned >= target.target_amount

  // Derive status badge
  const status = deriveStatus(
    category.available,
    category.assigned,
    category.activity,
    target?.target_amount ?? null,
  )

  return (
    <div
      className="group grid grid-cols-[20px_1fr_80px_80px_80px] sm:grid-cols-[20px_1fr_100px_100px_100px] gap-1 items-center px-3 sm:px-4 py-1.5
        hover:bg-gray-800/40 transition-colors text-sm border-b border-gray-800/40 last:border-0 cursor-pointer"
      onClick={() => { if (!isPickerOpen) onRowClick(category.id) }}
    >

      {/* Checkbox — stops row-click so checkbox toggle and edit don't conflict */}
      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selectedIds.has(category.id)}
          onChange={e => onSelect(category.id, e.target.checked)}
          className={`accent-indigo-500 w-4 h-4 cursor-pointer transition-opacity ${selectedIds.has(category.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        />
      </div>

      {/* Category name + badges + target progress */}
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          {/* Emoji trigger — always visible when set, hover-only when unset */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={togglePicker}
              className={`w-6 h-6 flex items-center justify-center rounded text-base leading-none
                hover:bg-gray-700 transition-colors
                ${localEmoji ? '' : 'opacity-0 group-hover:opacity-100'}`}
              title={localEmoji ? 'Change emoji' : 'Add emoji'}
              style={{ fontSize: '16px' }}
            >
              {localEmoji ?? '＋'}
            </button>
            {isPickerOpen && (
              <EmojiPicker
                currentEmoji={localEmoji}
                onSelect={handleEmojiSelect}
                onClose={() => setOpenPickerId(null)}
              />
            )}
          </div>

          {/* Category name */}
          <div className="flex items-center gap-2 min-w-0">
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
        </div>
        {/* Target progress bar (shown only when a target exists) */}
        {target && (
          <CategoryProgressBar
            assigned={category.assigned}
            targetAmount={target.target_amount}
            available={category.available}
          />
        )}
      </div>

      {/* Assigned — click opens Inspector, stops propagation to avoid double-trigger */}
      <div className="text-right" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onRowClick(category.id)}
          className="w-full text-right tabular-nums text-gray-300 hover:text-indigo-400
            hover:bg-indigo-500/10 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
          title="Click to inspect and assign"
        >
          <AmountCell value={category.assigned} />
        </button>
      </div>

      {/* Activity */}
      <div className="text-right">
        <AmountCell value={category.activity} variant="activity" />
      </div>

      {/* Available */}
      <div className="text-right font-medium">
        <AvailableBadge
          amount={category.available}
          isFunded={isFunded}
          hasTarget={hasTarget}
        />
      </div>
    </div>
  )
})
