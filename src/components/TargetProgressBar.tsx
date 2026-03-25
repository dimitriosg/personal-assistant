// ── Target progress bar ───────────────────────────────────────────────────────
//
// A slim progress indicator that shows how much of a category target has been
// funded. Displayed beneath the category name in the budget view.

interface Props {
  /** Amount assigned this month */
  assigned: number
  /** Target amount for this category */
  targetAmount: number
  /** Target type label (monthly, by_date, savings_goal) */
  targetType: 'monthly' | 'by_date' | 'savings_goal'
  /** Target date (for by_date type) */
  targetDate?: string | null
}

export default function TargetProgressBar({ assigned, targetAmount, targetType, targetDate }: Props) {
  if (targetAmount <= 0) return null

  const pct = Math.min((assigned / targetAmount) * 100, 100)
  const remaining = Math.max(targetAmount - assigned, 0)

  // Color based on progress
  const barColor =
    pct >= 100 ? 'bg-green-500'
    : pct >= 50 ? 'bg-yellow-500'
    : 'bg-red-500'

  // Type label
  const typeLabel =
    targetType === 'monthly' ? 'Monthly target'
    : targetType === 'by_date' ? `Target by ${targetDate ?? '—'}`
    : 'Savings goal'

  return (
    <div className="flex items-center gap-2 mt-0.5">
      {/* Progress bar */}
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden max-w-[80px]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Label */}
      <span className="text-[10px] text-gray-600 tabular-nums whitespace-nowrap">
        {pct >= 100 ? (
          <span className="text-green-600">✓ {typeLabel}</span>
        ) : (
          <>€{remaining.toFixed(0)} more · {typeLabel}</>
        )}
      </span>
    </div>
  )
}
