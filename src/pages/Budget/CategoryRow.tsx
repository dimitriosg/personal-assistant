import { useState, useRef, useEffect, memo } from 'react'
import type { BudgetCategory } from './types'
import AmountCell from './AmountCell'
import StatusBadge, { deriveStatus } from '../../components/StatusBadge'
import CategoryProgressBar from '../../components/budget/CategoryProgressBar'
import AvailableBadge from '../../components/budget/AvailableBadge'
import EmojiPicker from '../../components/budget/EmojiPicker'
import { patch } from '../../lib/api'
import { resolveExpression } from '../../utils/resolveExpression'

interface Props {
  category: BudgetCategory
  month: string
  onAssign: (categoryId: number, month: string, assigned: number) => void
  onInspect: (categoryId: number) => void
  /** ID of the category whose picker is currently open (null = none). */
  openPickerId: number | null
  /** Setter to open/close any picker — shared across all rows. */
  setOpenPickerId: (id: number | null) => void
  selectedIds: Set<number>
  onSelect: (id: number, checked: boolean) => void
}

export default memo(function CategoryRow({ category, month, onAssign, onInspect, openPickerId, setOpenPickerId, selectedIds, onSelect }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [localEmoji, setLocalEmoji] = useState<string | null>(category.emoji)
  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks the assigned value at the moment the row was clicked into edit mode,
  // used to revert on Escape (even after multiple Enter commits in the same session).
  const originalValue = useRef(0)
  // Prevents the onBlur handler from re-firing commitEdit after Enter/Escape already handled it.
  const committed = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Keep localEmoji in sync if the parent re-fetches and the value changes
  useEffect(() => {
    setLocalEmoji(category.emoji)
  }, [category.emoji])

  const isPickerOpen = openPickerId === category.id

  // Clicking anywhere on the row enters edit mode (YNAB-style), unless already
  // editing or the emoji picker is open. Specific cells stop propagation below.
  function handleRowClick() {
    if (editing || isPickerOpen) return
    originalValue.current = category.assigned
    committed.current = false
    setEditValue(category.assigned === 0 ? '' : category.assigned.toFixed(2))
    setEditing(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      // Resolve expression → absolute value, then stay in editing mode (YNAB-style)
      const resolved = resolveExpression(editValue, category.assigned)
      if (!isNaN(resolved)) {
        committed.current = true
        // Update input to show resolved absolute value so blur won't re-apply expression
        setEditValue(resolved.toFixed(2))
        if (resolved !== category.assigned) {
          onAssign(category.id, month, resolved)
        }
        // Re-select all text after React re-renders, then clear the guard so
        // a subsequent click-away blur commits normally
        requestAnimationFrame(() => {
          inputRef.current?.select()
          committed.current = false
        })
      }
    }
    if (e.key === 'Escape') {
      // Mark as handled so the blur that fires when the input is removed from the
      // DOM (due to setEditing(false) below) does not try to commit again.
      committed.current = true
      setEditing(false)
      if (originalValue.current !== category.assigned) {
        onAssign(category.id, month, originalValue.current)
      }
    }
  }

  function handleBlur() {
    // If Enter or Escape already handled this commit, skip
    if (committed.current) {
      committed.current = false
      return
    }
    // Blur without Enter = commit current value and close edit mode
    setEditing(false)
    const resolved = resolveExpression(editValue, category.assigned)
    if (!isNaN(resolved) && resolved !== category.assigned) {
      onAssign(category.id, month, resolved)
    }
  }

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
      className="group grid grid-cols-[20px_1fr_80px_80px_80px_24px] sm:grid-cols-[20px_1fr_100px_100px_100px_24px] gap-1 items-center px-3 sm:px-4 py-1.5
        hover:bg-gray-800/40 transition-colors text-sm border-b border-gray-800/40 last:border-0 cursor-pointer"
      onClick={handleRowClick}
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

      {/* Assigned — editable; stops row-click so the row handler doesn't re-fire */}
      <div className="text-right" onClick={e => e.stopPropagation()}>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-800 border border-indigo-500 rounded px-1.5 py-0.5
              text-right text-sm text-gray-100 outline-none tabular-nums"
          />
        ) : (
          <button
            onClick={handleRowClick}
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
      <div className="text-right font-medium">
        <AvailableBadge
          amount={category.available}
          isFunded={isFunded}
          hasTarget={hasTarget}
        />
      </div>

      {/* Inspect button — sole trigger for Inspector panel */}
      <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onInspect(category.id)}
          title="Inspect category"
          className="text-gray-500 hover:text-white text-xs px-1 transition-colors opacity-0 group-hover:opacity-100"
        >
          ℹ
        </button>
      </div>
    </div>
  )
})
