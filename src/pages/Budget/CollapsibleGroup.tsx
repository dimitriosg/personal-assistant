import { useState } from 'react'
import type { BudgetGroup } from './types'
import CategoryRow from './CategoryRow'
import AmountCell from './AmountCell'

interface Props {
  group: BudgetGroup
  month: string
  onAssign: (categoryId: number, month: string, assigned: number) => void
}

export default function CollapsibleGroup({ group, month, onAssign }: Props) {
  const [collapsed, setCollapsed] = useState(group.is_collapsed)

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full grid grid-cols-[1fr_80px_80px_80px] sm:grid-cols-[1fr_100px_100px_100px] gap-1 items-center px-3 sm:px-4 py-2
          bg-gray-900/60 hover:bg-gray-800/60 transition-colors border-b border-gray-800
          text-left group"
      >
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
      </button>

      {/* Category rows */}
      {!collapsed && (
        <div>
          {group.categories.map(cat => (
            <CategoryRow
              key={cat.id}
              category={cat}
              month={month}
              onAssign={onAssign}
            />
          ))}
        </div>
      )}
    </div>
  )
}
