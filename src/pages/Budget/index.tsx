import { useEffect, useState, useCallback, useMemo } from 'react'
import { get, post, patch, put } from '../../lib/api'
import type { BudgetData, BudgetCategory, BudgetGroup, SummaryData } from './types'
import MonthSelector from './MonthSelector'
import CollapsibleGroup from './CollapsibleGroup'
import MonthlySummary from './MonthlySummary'
import MoveMoneyModal from './MoveMoneyModal'
import FilterChips, { type BudgetFilter } from '../../components/budget/FilterChips'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

  useEffect(() => {
    fetchData(month)
  }, [month, fetchData])

  function handleMonthChange(m: string) {
    setMonth(m)
  }

  const handleAssign = useCallback(async (categoryId: number, m: string, assigned: number) => {
    try {
      await post('/budget/assign', { category_id: categoryId, month: m, assigned })
      await fetchData(m)
    } catch (err) {
      console.error('Failed to assign:', err)
    }
  }, [fetchData])

  async function handleMoveComplete() {
    setShowMoveModal(false)
    await fetchData(month)
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
    </div>
  )
}
