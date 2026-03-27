import { useState, useRef, useEffect } from 'react'
import type { BudgetGroup } from './types'
import CategoryRow from './CategoryRow'
import AmountCell from './AmountCell'

interface Props {
  group: BudgetGroup
  month: string
  onAssign: (categoryId: number, month: string, assigned: number) => void
  onInspect: (categoryId: number) => void
  onEditStart: (categoryId: number) => void
  onEditEnd: () => void
  openPickerId: number | null
  setOpenPickerId: (id: number | null) => void
  selectedIds: Set<number>
  onSelect: (id: number, checked: boolean) => void
  onSelectGroup: (groupId: number, checked: boolean) => void
}

export default function CollapsibleGroup({ group, month, onAssign, onInspect, onEditStart, onEditEnd, openPickerId, setOpenPickerId, selectedIds, onSelect, onSelectGroup }: Props) {
  const [collapsed, setCollapsed] = useState(group.is_collapsed)

  const groupCategoryIds = group.categories.map(c => c.id)
  const selectedInGroup = groupCategoryIds.filter(id => selectedIds.has(id))
  const someSelected = selectedInGroup.length > 0
  const allSelected = groupCategoryIds.length > 0 && selectedInGroup.length === groupCategoryIds.length

  const groupCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (groupCheckboxRef.current) {
      groupCheckboxRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  return (
    <div className="mb-1">
      {/* Group header */}
      <div
        className="group w-full grid grid-cols-[20px_1fr_80px_80px_80px_24px] sm:grid-cols-[20px_1fr_100px_100px_100px_24px] gap-1 items-center px-3 sm:px-4 py-2
          bg-gray-900/60 hover:bg-gray-800/60 transition-colors border-b border-gray-800
          cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(c => !c) } }}
      >
        {/* Group select-all checkbox */}
        <div
          className="flex items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={groupCheckboxRef}
            type="checkbox"
            checked={allSelected}
            onChange={e => onSelectGroup(group.id, e.target.checked)}
            className={`accent-indigo-500 w-4 h-4 cursor-pointer transition-opacity ${someSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform shrink-0 ${
              collapsed ? '' : 'rotate-90'
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-200 truncate">
            {group.name}
          </span>
          <span className="text-xs text-gray-600">
            {group.categories.length}
          </span>
        </div>

        <div className="text-right">
          <AmountCell value={group.totals.assigned} bold />
        </div>
        <div className="text-right">
          <AmountCell value={group.totals.activity} variant="activity" bold />
        </div>
        <div className="text-right">
          <AmountCell value={group.totals.available} variant="available" bold />
        </div>
        {/* Spacer for the [ℹ] inspect button column */}
        <div />
      </div>

      {/* Category rows */}
      {!collapsed && (
        <div>
          {group.categories.map(cat => (
            <CategoryRow
              key={cat.id}
              category={cat}
              month={month}
              onAssign={onAssign}
              onInspect={onInspect}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              openPickerId={openPickerId}
              setOpenPickerId={setOpenPickerId}
              selectedIds={selectedIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
