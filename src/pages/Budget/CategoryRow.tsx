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
  onDeleteCategory: (categoryId: number) => void
}

export default memo(function CategoryRow({ category, month, onAssign, onInspect, openPickerId, setOpenPickerId, selectedIds, onSelect, onDeleteCategory }: Props) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [localEmoji, setLocalEmoji] = useState<string | null>(category.emoji)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Displayed value when NOT editing — kept in state so prop updates (silentRefetch,
  // Undo) trigger a re-render and paint the correct number immediately.
  const [displayedAssigned, setDisplayedAssigned] = useState(category.assigned)
  // Expression base — a ref so Enter can update it synchronously without an extra render.
  const localAssigned = useRef(category.assigned)

  // Focus + select when edit mode opens
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // Sync both display state and expression-base ref when the server prop changes,
  // but only while NOT editing so mid-session expressions aren't clobbered.
  useEffect(() => {
    if (!editing) {
      setDisplayedAssigned(category.assigned)
      localAssigned.current = category.assigned
    }
  }, [category.assigned, editing])

  // Keep localEmoji in sync if the parent re-fetches and the value changes
  useEffect(() => {
    setLocalEmoji(category.emoji)
  }, [category.emoji])

  const isPickerOpen = openPickerId === category.id

  // Clicking anywhere on the row enters edit mode (YNAB-style), unless already
  // editing or the emoji picker is open. Specific cells stop propagation below.
  function handleRowClick() {
    if (editing || isPickerOpen) return
    setInputValue(localAssigned.current === 0 ? '' : localAssigned.current.toFixed(2))
    setEditing(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const resolved = resolveExpression(inputValue, localAssigned.current)
      if (!isNaN(resolved)) {
        if (resolved !== localAssigned.current) {
          localAssigned.current = resolved   // update base BEFORE calling onAssign
          setDisplayedAssigned(resolved)     // keep display in sync
          onAssign(category.id, month, resolved)
        }
        setInputValue(resolved.toFixed(2))   // show absolute value, ready for next expr
        inputRef.current?.select()           // re-select so user can type next expression
        // Stay in editing mode (YNAB-style) — blur or Escape closes
      }
    }
    if (e.key === 'Escape') {
      setEditing(false)   // just close — no API call, localAssigned keeps last committed value
    }
  }

  // Blur only closes edit mode visually — NEVER fires onAssign
  function handleBlur() {
    setEditing(false)
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

      {/* Assigned — editable; stop propagation only while editing so input clicks
           don't re-fire handleRowClick; in static mode let clicks bubble to the row */}
      <div className="text-right" onClick={editing ? e => e.stopPropagation() : undefined}>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-800 border border-indigo-500 rounded px-1.5 py-0.5
              text-right text-sm text-gray-100 outline-none tabular-nums"
          />
        ) : (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="w-full text-right tabular-nums text-gray-300 hover:text-indigo-400
              hover:bg-indigo-500/10 rounded px-1.5 py-0.5 transition-colors cursor-text"
            title="Click to edit assigned amount"
          >
            <AmountCell value={displayedAssigned} />
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

      {/* Inspect + Delete buttons */}
      <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          title="Delete category"
          className="text-gray-500 hover:text-red-400 text-xs px-0.5 transition-colors opacity-0 group-hover:opacity-100"
        >
          🗑️
        </button>
        <button
          type="button"
          onClick={() => onInspect(category.id)}
          title="Inspect category"
          className="text-gray-500 hover:text-white text-xs px-0.5 transition-colors opacity-0 group-hover:opacity-100"
        >
          ℹ
        </button>
      </div>

      {/* Inline delete confirmation */}
      {showDeleteConfirm && (
        <div className="col-span-full bg-red-950/40 border border-red-900/50 rounded px-3 py-2 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-red-300">Delete {category.name}? This cannot be undone.</span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { setShowDeleteConfirm(false); onDeleteCategory(category.id) }}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
