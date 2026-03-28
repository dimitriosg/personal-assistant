import { useState, useRef, useEffect } from 'react'
import type { BudgetGroup } from './types'
import CategoryRow from './CategoryRow'
import AmountCell from './AmountCell'

interface Props {
  group: BudgetGroup
  month: string
  onAssign: (categoryId: number, month: string, assigned: number) => void
  onInspect: (categoryId: number) => void
  openPickerId: number | null
  setOpenPickerId: (id: number | null) => void
  selectedIds: Set<number>
  onSelect: (id: number, checked: boolean) => void
  onSelectGroup: (groupId: number, checked: boolean) => void
  onDeleteGroup: (groupId: number, groupName: string) => void
}

export default function CollapsibleGroup({ group, month, onAssign, onInspect, openPickerId, setOpenPickerId, selectedIds, onSelect, onSelectGroup, onDeleteGroup }: Props) {
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
        {/* Delete group button */}
        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onDeleteGroup(group.id, group.name)}
            title="Delete group"
            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-0.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.78.72l.5 6a.75.75 0 01-1.49.12l-.5-6a.75.75 0 01.71-.84zm2.84 0a.75.75 0 01.71.84l-.5 6a.75.75 0 11-1.49-.12l.5-6a.75.75 0 01.78-.72z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
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
