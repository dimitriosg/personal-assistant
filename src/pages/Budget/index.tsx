import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { get, post, patch, put, del, delWithBody } from '../../lib/api'
import type { BudgetData, BudgetCategory, BudgetGroup, SummaryData } from './types'
import MonthSelector from './MonthSelector'
import CollapsibleGroup from './CollapsibleGroup'
import MonthlySummary from './MonthlySummary'
import CategoryInspector from './CategoryInspector'
import MoveMoneyModal from './MoveMoneyModal'
import RecentMovesPanel, { type BudgetMove } from './RecentMovesPanel'
import FilterChips, { type BudgetFilter } from '../../components/budget/FilterChips'
import { useToast } from '../../hooks/useToast'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Budget() {
  const [month, setMonth] = useState(currentMonth)
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveMoneyFromId, setMoveMoneyFromId] = useState<number | null | undefined>(undefined)
  const [moveMoneyToId, setMoveMoneyToId] = useState<number | null | undefined>(undefined)
  const [filter, setFilter] = useState<BudgetFilter>('all')
  const [openPickerId, setOpenPickerId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showRecentMoves, setShowRecentMoves] = useState(false)
  const [undoneStack, setUndoneStack] = useState<BudgetMove[]>([])
  const [lastMoves, setLastMoves] = useState<BudgetMove[]>([])
  const [undoing, setUndoing] = useState(false)
  const [redoing, setRedoing] = useState(false)
  const [inspectedCategoryId, setInspectedCategoryId] = useState<number | null>(null)
  const { showToast } = useToast()

  // Keep a ref to budget so async callbacks can read current value without deps
  const budgetRef = useRef<BudgetData | null>(null)
  budgetRef.current = budget

  const [yr, mo] = month.split('-').map(Number)
  const monthLabel = `${MONTHS[mo - 1]} ${yr}`

  const filteredGroups: BudgetGroup[] = useMemo(() => {
    if (!budget) return []
    if (filter === 'all') return budget.groups

    function matchesFilter(cat: BudgetCategory): boolean {
      switch (filter) {
        case 'snoozed':
          return cat.snoozed === 1
        case 'underfunded':
          return cat.target !== null && cat.available > 0 && cat.available < cat.target.target_amount
        case 'overfunded':
          return cat.target !== null && cat.available > cat.target.target_amount
        case 'money_available':
          return cat.available > 0
        default:
          return true
      }
    }

    return budget.groups
      .map(group => {
        const visibleCategories = group.categories.filter(matchesFilter)
        if (visibleCategories.length === 0) return null

        const totals = {
          assigned: visibleCategories.reduce((s, c) => s + c.assigned, 0),
          activity: visibleCategories.reduce((s, c) => s + c.activity, 0),
          available: visibleCategories.reduce((s, c) => s + c.available, 0),
        }

        return { ...group, categories: visibleCategories, totals }
      })
      .filter((g): g is BudgetGroup => g !== null)
  }, [budget, filter])

  const fetchData = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      const [b, s] = await Promise.all([
        get<BudgetData>(`/budget/${m}`),
        get<SummaryData>(`/summary/${m}`),
      ])
      setBudget(b)
      setSummary(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget')
    } finally {
      setLoading(false)
    }
  }, [])

  // Silent background refetch — no loading indicator, used after optimistic updates
  const silentRefetch = useCallback(async (m: string) => {
    try {
      const [b, s] = await Promise.all([
        get<BudgetData>(`/budget/${m}`),
        get<SummaryData>(`/summary/${m}`),
      ])
      setBudget(b)
      setSummary(s)
    } catch {
      // best-effort, ignore errors on background refetch
    }
  }, [])

  const fetchMoves = useCallback(async (m: string) => {
    // Clear stale moves immediately so undo/redo reflect the correct month
    setLastMoves([])
    try {
      const data = await get<BudgetMove[]>(`/budget/moves?month=${m}`)
      setLastMoves(data)
    } catch {
      // ignore — undo/redo will simply be disabled
    }
  }, [])

  useEffect(() => {
    fetchData(month)
    fetchMoves(month)
  }, [month, fetchData, fetchMoves])

  // Re-fetch silently when accounts are mutated from any page (e.g. Transactions sidebar)
  // so that readyToAssign reflects the latest account balances without a full reload.
  useEffect(() => {
    function onAccountsChanged() {
      silentRefetch(month)
    }
    window.addEventListener('accountsChanged', onAccountsChanged)
    return () => window.removeEventListener('accountsChanged', onAccountsChanged)
  }, [month, silentRefetch])

  function handleMonthChange(m: string) {
    setMonth(m)
    setUndoneStack([])
    setInspectedCategoryId(null)
  }

  // ── "M" shortcut — open Move Money from inspected category ──────────────────
  useEffect(() => {
    if (inspectedCategoryId === null) return

    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing inside an input/textarea/select or contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox'
      ) return
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        openMoveModal(inspectedCategoryId)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [inspectedCategoryId])

  // ── Inspect button → Inspector panel ────────────────────────────────────────
  const handleInspect = useCallback((categoryId: number) => {
    setInspectedCategoryId(prev => prev === categoryId ? null : categoryId)
  }, [])

  // ── Undo / Redo ─────────────────────────────────────────────────────────────

  const canUndo = lastMoves.some(m => m.undone === 0)

  async function handleUndo() {
    const move = lastMoves.find(m => m.undone === 0)
    if (!move) return
    setUndoing(true)
    try {
      await post(`/budget/moves/${move.id}/undo`, {})
      setUndoneStack(prev => [move, ...prev])
      showToast({ message: `Move undone: EUR ${move.amount.toFixed(2)} back to ${move.from}`, type: 'info' })
      await Promise.all([fetchData(month), fetchMoves(month)])
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to undo', type: 'error' })
    } finally {
      setUndoing(false)
    }
  }

  async function handleRedo() {
    if (undoneStack.length === 0) return
    const move = undoneStack[0]
    setRedoing(true)
    try {
      // Re-apply the move: original from→to direction
      await post('/budget/move', {
        month,
        fromCategoryId: move.fromCategoryId,
        toCategoryId: move.toCategoryId,
        amount: move.amount,
      })
      setUndoneStack(prev => prev.slice(1))
      showToast({ message: `Move re-applied: EUR ${move.amount.toFixed(2)} to ${move.to}`, type: 'success' })
      await Promise.all([fetchData(month), fetchMoves(month)])
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to redo', type: 'error' })
    } finally {
      setRedoing(false)
    }
  }

  const handleAssign = useCallback(async (categoryId: number, m: string, assigned: number) => {
    const prevBudget = budgetRef.current
    if (!prevBudget) return

    // Find old assigned value for computing delta and optimistic update
    let oldAssigned = 0
    let catName = ''
    for (const g of prevBudget.groups) {
      const cat = g.categories.find(c => c.id === categoryId)
      if (cat) { oldAssigned = cat.assigned; catName = cat.name; break }
    }
    const delta = +(assigned - oldAssigned).toFixed(2)
    if (Math.abs(delta) < 0.01) return // no-op — less than 1 cent change

    // ── Optimistic update ────────────────────────────────────────────────────
    setBudget(prev => {
      if (!prev) return prev
      return {
        ...prev,
        readyToAssign: +(prev.readyToAssign - delta).toFixed(2),
        groups: prev.groups.map(g => {
          if (!g.categories.some(c => c.id === categoryId)) return g
          return {
            ...g,
            categories: g.categories.map(c =>
              c.id === categoryId
                ? { ...c, assigned, available: +(c.available + delta).toFixed(2) }
                : c
            ),
            totals: {
              ...g.totals,
              assigned: +(g.totals.assigned + delta).toFixed(2),
              available: +(g.totals.available + delta).toFixed(2),
            },
          }
        }),
      }
    })

    try {
      // POST /budget/move handles both the monthly_budgets update (delta-add) AND
      // logging in budget_moves. A separate /budget/assign call must NOT be made —
      // doing so would write the absolute value before move adds the delta again,
      // causing a double-write (e.g. +100 from 0 → assign sets 100, move adds 100 → 200).
      // Zero-delta moves are already excluded by the early-return above (|delta| < 0.01).
      // This call is now the sole write path, so failure IS critical — it propagates
      // to the catch block which reverts the optimistic update and shows an error.
      const movePayload = delta > 0
        ? { month: m, fromCategoryId: null, toCategoryId: categoryId, amount: +delta.toFixed(2) }
        : { month: m, fromCategoryId: categoryId, toCategoryId: null, amount: +(-delta).toFixed(2) }
      await post('/budget/move', movePayload)

      showToast({ message: `EUR ${assigned.toFixed(2)} assigned to ${catName}`, type: 'success' })
      // Silent background refresh — no loading indicator
      silentRefetch(m)
      fetchMoves(m)
    } catch (err) {
      // Revert optimistic update
      setBudget(prevBudget)
      showToast({ message: err instanceof Error ? err.message : 'Failed to assign', type: 'error' })
    }
  }, [silentRefetch, fetchMoves, showToast])

  const handleRecentMovesDataChange = useCallback(() => {
    fetchData(month)
    fetchMoves(month)
  }, [month, fetchData, fetchMoves])

  function openMoveModal(fromId?: number | null, toId?: number | null) {
    setMoveMoneyFromId(fromId)
    setMoveMoneyToId(toId)
    setShowMoveModal(true)
  }

  async function handleMoveComplete(fromId: number | null, toId: number | null, amount: number) {
    // Optimistic update — immediately adjust available balances before background refresh
    setBudget(prev => {
      if (!prev) return prev

      function updateCategory(
        groups: BudgetGroup[],
        id: number,
        delta: number,
      ): BudgetGroup[] {
        return groups.map(g => {
          if (!g.categories.some(c => c.id === id)) return g
          return {
            ...g,
            categories: g.categories.map(c =>
              c.id === id
                ? { ...c, available: Math.round((c.available + delta) * 100) / 100 }
                : c
            ),
            totals: {
              ...g.totals,
              available: Math.round((g.totals.available + delta) * 100) / 100,
            },
          }
        })
      }

      let groups = prev.groups
      let rta = prev.readyToAssign

      // Subtract from source
      if (fromId === null) {
        rta = Math.round((rta - amount) * 100) / 100
      } else {
        groups = updateCategory(groups, fromId, -amount)
      }

      // Add to destination
      if (toId === null) {
        rta = Math.round((rta + amount) * 100) / 100
      } else {
        groups = updateCategory(groups, toId, amount)
      }

      return { ...prev, readyToAssign: rta, groups }
    })

    setShowMoveModal(false)
    setSelectedIds(new Set())
    await Promise.all([fetchData(month), fetchMoves(month)])
  }

  const handleSelect = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSelectGroup = useCallback((groupId: number, checked: boolean) => {
    const group = filteredGroups.find(g => g.id === groupId)
    if (!group) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      group.categories.forEach(c => {
        if (checked) next.add(c.id)
        else next.delete(c.id)
      })
      return next
    })
  }, [filteredGroups])

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)

    // Optimistic update: remove categories from UI immediately
    const prevBudget = budgetRef.current
    setBudget(prev => {
      if (!prev) return prev
      return {
        ...prev,
        groups: prev.groups.map(g => ({
          ...g,
          categories: g.categories.filter(c => !selectedIds.has(c.id)),
        })).filter(g => g.categories.length > 0 || true),
      }
    })
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)

    try {
      const result = await delWithBody<{ deleted: number }>('/categories/bulk', { ids })
      showToast({ message: `${result.deleted} ${result.deleted === 1 ? 'category' : 'categories'} deleted`, type: 'success' })
      await fetchData(month)
    } catch (err) {
      // Revert optimistic update on failure
      if (prevBudget) setBudget(prevBudget)
      setSelectedIds(new Set(ids))
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete categories', type: 'error' })
    }
  }

  async function handleBulkSnooze() {
    try {
      await Promise.all(Array.from(selectedIds).map(id => patch(`/categories/${id}/snooze`, { snoozed: true })))
      await fetchData(month)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Failed to snooze categories:', err)
    }
  }

  async function handleBulkHide() {
    try {
      await Promise.all(Array.from(selectedIds).map(id => put(`/categories/${id}`, { hidden: true })))
      await fetchData(month)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Failed to hide categories:', err)
    }
  }

  // ── Single category delete ──────────────────────────────────────────────────

  const handleDeleteCategory = useCallback(async (categoryId: number) => {
    const prevBudget = budgetRef.current
    // Optimistic update: remove the category from UI
    setBudget(prev => {
      if (!prev) return prev
      return {
        ...prev,
        groups: prev.groups.map(g => ({
          ...g,
          categories: g.categories.filter(c => c.id !== categoryId),
        })),
      }
    })

    try {
      await del(`/categories/${categoryId}`)
      showToast({ message: 'Category deleted', type: 'success' })
      await fetchData(month)
    } catch (err) {
      if (prevBudget) setBudget(prevBudget)
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete category', type: 'error' })
    }
  }, [month, fetchData, showToast])

  // ── Group delete ────────────────────────────────────────────────────────────

  const [groupDeleteConfirm, setGroupDeleteConfirm] = useState<{ id: number; name: string; count: number } | null>(null)

  const handleDeleteGroup = useCallback(async (groupId: number) => {
    const prevBudget = budgetRef.current
    // Optimistic update: remove the group from UI
    setBudget(prev => {
      if (!prev) return prev
      return {
        ...prev,
        groups: prev.groups.filter(g => g.id !== groupId),
      }
    })
    setGroupDeleteConfirm(null)

    try {
      await del<{ deleted: boolean; categoriesRemoved: number }>(`/groups/${groupId}`)
      showToast({ message: 'Group deleted', type: 'success' })
      await fetchData(month)
    } catch (err) {
      if (prevBudget) setBudget(prevBudget)
      showToast({ message: err instanceof Error ? err.message : 'Failed to delete group', type: 'error' })
    }
  }, [month, fetchData, showToast])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !budget) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 text-sm">Loading budget…</div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !budget) {
    return (
      <div className="p-4">
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
          <p className="text-red-400 text-sm font-medium">Failed to load budget</p>
          <p className="text-red-600 text-xs mt-1">{error}</p>
        </div>
      </div>
    )
  }

  const hasCategories = budget.groups.some(g => g.categories.length > 0)
  const isFiltered = filter !== 'all'

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* ── Main budget content ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Month selector + Ready to Assign */}
        <MonthSelector
          month={month}
          readyToAssign={budget.readyToAssign}
          onMonthChange={handleMonthChange}
        />

        {/* Undo / Redo / Recent Moves toolbar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-800 bg-gray-900/40 shrink-0">
          <button
            onClick={handleUndo}
            disabled={!canUndo || undoing}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors
              ${canUndo && !undoing
                ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                : 'text-gray-600 opacity-50 cursor-not-allowed'}`}
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={undoneStack.length === 0 || redoing}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors
              ${undoneStack.length > 0 && !redoing
                ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                : 'text-gray-600 opacity-50 cursor-not-allowed'}`}
          >
            ↪ Redo
          </button>
          <button
            onClick={() => setShowRecentMoves(true)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-300
              hover:bg-gray-800 hover:text-gray-100 transition-colors"
          >
            ⏱ Recent Moves
          </button>
        </div>

        {/* Filter chips */}
        {hasCategories && (
          <FilterChips active={filter} onChange={setFilter} />
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="bg-[#2a2a4a] border border-[#3a3a5a] rounded-lg px-4 py-2 flex items-center gap-4 text-sm mb-2 mx-3 sm:mx-4">
            <span className="text-gray-300">{selectedIds.size} selected</span>
            <button
              onClick={() => {
                const ids = Array.from(selectedIds)
                // Single selection: pre-select as source only; user picks dest themselves
                openMoveModal(ids[0], ids.length > 1 ? ids[ids.length - 1] : undefined)
              }}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Move Money
            </button>
            <button
              onClick={handleBulkSnooze}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Snooze
            </button>
            <button
              onClick={handleBulkHide}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Hide
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              🗑️ Delete ({selectedIds.size})
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[20px_1fr_80px_80px_80px_24px] sm:grid-cols-[20px_1fr_100px_100px_100px_24px] gap-1 px-3 sm:px-4 py-2
          border-b border-gray-800 bg-gray-900/40 text-xs text-gray-500 uppercase tracking-wider font-medium">
          <div></div>
          <div>Category</div>
          <div className="text-right"><span className="hidden sm:inline">Assigned</span><span className="sm:hidden">Asgn</span></div>
          <div className="text-right"><span className="hidden sm:inline">Activity</span><span className="sm:hidden">Act</span></div>
          <div className="text-right"><span className="hidden sm:inline">Available</span><span className="sm:hidden">Avail</span></div>
          <div></div>
        </div>

        {/* Category groups */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center py-4 text-gray-600 text-xs">Refreshing…</div>
          )}

          {!hasCategories && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No categories set up yet.</p>
              <p className="text-gray-600 text-xs mt-1">
                Go to Settings or re-run the setup wizard to add category groups and categories.
              </p>
            </div>
          )}

          {filteredGroups.map(group => (
            <CollapsibleGroup
              key={group.id}
              group={group}
              month={month}
              onAssign={handleAssign}
              onInspect={handleInspect}
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectGroup={handleSelectGroup}
              onDeleteCategory={handleDeleteCategory}
              onDeleteGroupConfirm={(id, name, count) => setGroupDeleteConfirm({ id, name, count })}
            />
          ))}

          {/* Hidden categories message */}
          {isFiltered && (
            <div className="text-center py-4 px-3">
              <p className="text-gray-500 text-sm">
                Some categories are hidden by your current view.
              </p>
              <button
                onClick={() => setFilter('all')}
                className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View All
              </button>
            </div>
          )}

          {/* Move money button */}
          {hasCategories && (
            <div className="px-4 py-3">
              <button
                onClick={() => openMoveModal()}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ↔ Move money between categories
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar: Category Inspector OR Monthly Summary (desktop) ─── */}
      {(() => {
        const inspected = inspectedCategoryId !== null
          ? budget.groups.flatMap(g => g.categories).find(c => c.id === inspectedCategoryId)
          : undefined
        return inspected
          ? (
            <CategoryInspector
              category={inspected}
              month={month}
              onClose={() => setInspectedCategoryId(null)}
              onAssign={handleAssign}
              onOpenMoveModal={(fromId) => openMoveModal(fromId)}
            />
          )
          : summary && (
            <aside className="hidden lg:block w-[260px] shrink-0 border-l border-gray-800 bg-gray-900/40 p-4 overflow-y-auto">
              <MonthlySummary data={summary} />
            </aside>
          )
      })()}

      {/* ── Right sidebar: Monthly Summary (mobile — below budget) ─────── */}
      {summary && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-900/40 p-4">
          <MonthlySummary data={summary} />
        </div>
      )}

      {/* ── Bulk Delete Confirmation Modal ───────────────────────────────── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkDeleteConfirm(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-100 mb-2">
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'category' : 'categories'}?
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              All assigned amounts will be removed. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500
                  text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group Delete Confirmation Modal ────────────────────────────── */}
      {groupDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setGroupDeleteConfirm(null)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-100 mb-2">
              Delete group "{groupDeleteConfirm.name}" and all {groupDeleteConfirm.count} {groupDeleteConfirm.count === 1 ? 'category' : 'categories'}?
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGroupDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGroup(groupDeleteConfirm.id)}
                className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-500
                  text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move Money Modal ──────────────────────────────────────────────── */}
      {showMoveModal && (
        <MoveMoneyModal
          month={month}
          groups={budget.groups}
          readyToAssign={budget.readyToAssign}
          initialFromId={moveMoneyFromId}
          initialToId={moveMoneyToId}
          onComplete={handleMoveComplete}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {/* ── Recent Moves Panel ─────────────────────────────────────────────── */}
      {showRecentMoves && (
        <RecentMovesPanel
          month={month}
          monthLabel={monthLabel}
          onClose={() => setShowRecentMoves(false)}
          onDataChange={handleRecentMovesDataChange}
          showToast={showToast}
        />
      )}
    </div>
  )
}
