import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { get, post, patch, put } from '../../lib/api'
import type { BudgetData, BudgetCategory, BudgetGroup, SummaryData } from './types'
import MonthSelector from './MonthSelector'
import CollapsibleGroup from './CollapsibleGroup'
import MonthlySummary from './MonthlySummary'
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
  const [filter, setFilter] = useState<BudgetFilter>('all')
  const [openPickerId, setOpenPickerId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showRecentMoves, setShowRecentMoves] = useState(false)
  const [undoneStack, setUndoneStack] = useState<BudgetMove[]>([])
  const [lastMoves, setLastMoves] = useState<BudgetMove[]>([])
  const [undoing, setUndoing] = useState(false)
  const [redoing, setRedoing] = useState(false)
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

  function handleMonthChange(m: string) {
    setMonth(m)
    setUndoneStack([])
  }

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
      await post('/budget/assign', { category_id: categoryId, month: m, assigned })

      // Log the delta as a budget_move so it appears in Recent Moves and can be undone
      try {
        if (Math.abs(delta) >= 0.01) {
          const movePayload = delta > 0
            ? { month: m, fromCategoryId: null, toCategoryId: categoryId, amount: +delta.toFixed(2) }
            : { month: m, fromCategoryId: categoryId, toCategoryId: null, amount: +(-delta).toFixed(2) }
          await post('/budget/move', movePayload)
        }
      } catch {
        // Move logging is non-critical — assign succeeded, history just won't reflect it
      }

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

  async function handleMoveComplete() {
    setShowMoveModal(false)
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
              onClick={() => window.alert('Move Money coming in Step 12')}
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
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[20px_1fr_80px_80px_80px] sm:grid-cols-[20px_1fr_100px_100px_100px] gap-1 px-3 sm:px-4 py-2
          border-b border-gray-800 bg-gray-900/40 text-xs text-gray-500 uppercase tracking-wider font-medium">
          <div></div>
          <div>Category</div>
          <div className="text-right"><span className="hidden sm:inline">Assigned</span><span className="sm:hidden">Asgn</span></div>
          <div className="text-right"><span className="hidden sm:inline">Activity</span><span className="sm:hidden">Act</span></div>
          <div className="text-right"><span className="hidden sm:inline">Available</span><span className="sm:hidden">Avail</span></div>
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
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectGroup={handleSelectGroup}
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
                onClick={() => setShowMoveModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ↔ Move money between categories
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar: Monthly Summary (desktop) ──────────────────────── */}
      {summary && (
        <aside className="hidden lg:block w-[260px] shrink-0 border-l border-gray-800 bg-gray-900/40 p-4 overflow-y-auto">
          <MonthlySummary data={summary} />
        </aside>
      )}

      {/* ── Right sidebar: Monthly Summary (mobile — below budget) ─────── */}
      {summary && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-900/40 p-4">
          <MonthlySummary data={summary} />
        </div>
      )}

      {/* ── Move Money Modal ──────────────────────────────────────────────── */}
      {showMoveModal && (
        <MoveMoneyModal
          month={month}
          groups={budget.groups}
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
