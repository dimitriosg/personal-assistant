// ── Format helpers ────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  month: string          // "2026-03"
  readyToAssign: number
  onMonthChange: (month: string) => void
}

export default function MonthSelector({ month, readyToAssign, onMonthChange }: Props) {
  const [year, mon] = month.split('-').map(Number)
  const label = `${MONTHS[mon - 1]} ${year}`

  function prev() {
    const d = new Date(year, mon - 2, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function next() {
    const d = new Date(year, mon, 1)
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const rtaColor = readyToAssign > 0
    ? 'text-green-400'
    : readyToAssign < 0
      ? 'text-red-400'
      : 'text-gray-400'

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
      {/* Month navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-semibold text-gray-100 min-w-[140px] text-center select-none">
          {label}
        </span>

        <button
          onClick={next}
          className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Ready to Assign */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 hidden sm:inline">Ready to Assign</span>
        <span
          className={`text-sm font-bold tabular-nums cursor-default ${rtaColor}`}
          title="Ready to Assign — unassigned money available for budgeting"
        >
          {fmt(readyToAssign)}
        </span>
      </div>
    </div>
  )
}
