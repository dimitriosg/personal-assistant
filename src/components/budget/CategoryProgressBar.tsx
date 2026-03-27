// ── Category progress bar ─────────────────────────────────────────────────────
//
// Displays a slim progress bar and label beneath the category name when a
// budget target is set. Spans the full width of the category name cell.

export interface CategoryProgressBarProps {
  /** Amount assigned this month */
  assigned: number
  /** Target amount for this category */
  targetAmount: number
  /** Amount available (assigned + carry-over + activity) */
  available: number
}

export default function CategoryProgressBar({
  assigned,
  targetAmount,
  available,
}: CategoryProgressBarProps) {
  if (targetAmount <= 0) return null

  const pct = Math.min(100, (assigned / targetAmount) * 100)
  const isOverspent = available < 0

  // Bar fill color
  const barColor = isOverspent
    ? 'bg-red-500'
    : pct >= 100
    ? 'bg-green-500'
    : pct >= 50
    ? 'bg-blue-500'
    : pct > 0
    ? 'bg-yellow-500'
    : 'bg-gray-600'

  // Text label
  let label: string
  if (isOverspent) {
    label = `Overspent -EUR ${Math.abs(available).toFixed(2)}`
  } else if (pct >= 100) {
    label = 'Fully funded ✓'
  } else {
    const remaining = targetAmount - assigned
    label = `EUR ${remaining.toFixed(2)} more needed`
  }

  return (
    <div className="mt-0.5">
      {/* Progress bar — full width of the name cell */}
      <div
        className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Text label */}
      <span className="text-[10px] text-gray-400">
        {label}
      </span>
    </div>
  )
}
