import { useState, useMemo } from 'react'
import type { BudgetGroup } from './types'
import { post } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

interface Props {
  month: string
  groups: BudgetGroup[]
  readyToAssign: number
  /** Pre-selected source category. undefined = no pre-selection, null = Ready to Assign */
  initialFromId?: number | null
  /** Pre-selected destination category. undefined = no pre-selection, null = Ready to Assign */
  initialToId?: number | null
  onComplete: () => void
  onClose: () => void
}

/** Sentinel select value representing "Ready to Assign" (null category id) */
const RTA = 'rta'

/** Returns null (Ready to Assign), a category id number, or '' (unselected) */
function fromSelectVal(val: string): number | null | '' {
  if (val === '') return ''
  if (val === RTA) return null
  return Number(val)
}

export default function MoveMoneyModal({
  month,
  groups,
  readyToAssign,
  initialFromId,
  initialToId,
  onComplete,
  onClose,
}: Props) {
  const [fromVal, setFromVal] = useState<string>(() => {
    if (initialFromId === undefined) return ''
    if (initialFromId === null) return RTA
    return String(initialFromId)
  })
  const [toVal, setToVal] = useState<string>(() => {
    if (initialToId === undefined) return ''
    if (initialToId === null) return RTA
    return String(initialToId)
  })
  const [amountRaw, setAmountRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const fromId = fromSelectVal(fromVal)  // number | null | ''
  const toId = fromSelectVal(toVal)

  const allCategories = useMemo(
    () => groups.flatMap(g => g.categories.map(c => ({ ...c, groupName: g.name }))),
    [groups]
  )

  const fromCat = typeof fromId === 'number' ? allCategories.find(c => c.id === fromId) : null
  const toCat   = typeof toId   === 'number' ? allCategories.find(c => c.id === toId)   : null

  const fromAvailable = fromId === null ? readyToAssign : (fromCat?.available ?? 0)
  const fromName = fromId === null ? 'Ready to Assign' : (fromCat?.name ?? '—')
  const toName   = toId   === null ? 'Ready to Assign' : (toCat?.name   ?? '—')

  /** Parse an amount expression:
   *  "=100" → 100 exactly
   *  any positive number string → that value
   */
  const resolvedAmount = useMemo(() => {
    const raw = amountRaw.trim()
    if (!raw) return null
    const num = parseFloat(raw.startsWith('=') ? raw.slice(1) : raw)
    return isNaN(num) ? null : num
  }, [amountRaw])

  const canSubmit =
    fromId !== '' &&
    toId !== '' &&
    fromId !== toId &&
    resolvedAmount !== null &&
    resolvedAmount > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || fromId === '' || toId === '') return

    const amt = resolvedAmount!
    setSaving(true)
    setError(null)
    try {
      await post('/budget/move', {
        fromCategoryId: fromId,   // null = Ready to Assign
        toCategoryId: toId,
        month,
        amount: Math.round(amt * 100) / 100,
      })
      showToast({
        message: `Moved EUR ${amt.toFixed(2)} from ${fromName} → ${toName}`,
        type: 'success',
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move money')
    } finally {
      setSaving(false)
    }
  }

  // Source groups: only categories with available > 0
  const sourceGroups = useMemo(
    () =>
      groups
        .map(g => ({ ...g, categories: g.categories.filter(c => c.available > 0) }))
        .filter(g => g.categories.length > 0),
    [groups]
  )

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-100 mb-4">Move Money</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* From category — only categories with available > 0 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">From category</label>
            <select
              value={fromVal}
              onChange={e => setFromVal(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select source…</option>
              {readyToAssign > 0 && (
                <option value={RTA}>
                  Ready to Assign (€{readyToAssign.toFixed(2)} available)
                </option>
              )}
              {sourceGroups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} (€{c.available.toFixed(2)} available)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* To category — all categories; Ready to Assign at bottom */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">To category</label>
            <select
              value={toVal}
              onChange={e => setToVal(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500"
            >
              <option value="">Select destination…</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories
                    .filter(c => String(c.id) !== fromVal)
                    .map(c => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} (€{c.available.toFixed(2)})
                      </option>
                    ))}
                </optgroup>
              ))}
              {fromVal !== RTA && (
                <option value={RTA}>
                  Ready to Assign (€{readyToAssign.toFixed(2)})
                </option>
              )}
            </select>
          </div>

          {/* Amount — text input supports expressions like "=100" */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (EUR)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amountRaw}
              onChange={e => setAmountRaw(e.target.value)}
              placeholder="50.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                text-sm text-gray-200 outline-none focus:border-indigo-500 tabular-nums"
            />
            {fromId !== '' && (
              <div className="text-xs text-gray-600 mt-1">
                Available in {fromName}: €{fromAvailable.toFixed(2)}
              </div>
            )}
          </div>

          {/* Live preview */}
          {canSubmit && (
            <div className="text-sm text-indigo-300 bg-indigo-950/30 border border-indigo-900/40
              rounded-lg px-3 py-2 text-center">
              Move EUR {resolvedAmount!.toFixed(2)} from {fromName} → {toName}
            </div>
          )}

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
              disabled={saving || !canSubmit}
              className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
                text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Moving…' : 'Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
