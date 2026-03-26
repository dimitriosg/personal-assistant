import { memo } from 'react'
import type { SummaryData } from './types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  data: SummaryData
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs tabular-nums font-medium ${color ?? 'text-gray-300'}`}>{value}</span>
    </div>
  )
}

export default memo(function MonthlySummary({ data }: Props) {
  const monthName = MONTHS[parseInt(data.month.split('-')[1], 10) - 1]

  return (
    <div className="space-y-4">
      {/* Month header */}
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {monthName}'s Summary
      </h3>

      {/* Main figures */}
      <div className="space-y-0 border-b border-gray-800 pb-3">
        <Row
          label="Left Over from Last Month"
          value={fmt(data.leftOverFromLastMonth)}
          color={data.leftOverFromLastMonth >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <Row
          label={`Assigned in ${monthName}`}
          value={fmt(data.assignedThisMonth)}
        />
        <Row
          label="Activity"
          value={fmt(data.activityThisMonth)}
          color={data.activityThisMonth < 0 ? 'text-red-400' : 'text-gray-300'}
        />
        <Row
          label="Available"
          value={fmt(data.available)}
          color={data.available > 0 ? 'text-green-400' : data.available < 0 ? 'text-red-400' : 'text-gray-500'}
        />
      </div>

      {/* Cost to Be Me */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Cost to Be Me
        </h4>
        <div className="space-y-0 border-b border-gray-800 pb-3">
          <Row
            label={`${monthName}'s Targets`}
            value={fmt(data.targetsThisMonth)}
          />
          <Row
            label="Expected Income"
            value={fmt(data.expectedIncome)}
          />
        </div>
      </div>

      {/* Auto-Assign info */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
          Auto-Assign
        </h4>
        <div className="space-y-0 border-b border-gray-800 pb-3">
          <Row
            label="Underfunded"
            value={fmt(data.underfunded)}
            color={data.underfunded > 0 ? 'text-yellow-400' : 'text-gray-600'}
          />
          <Row label="Assigned Last Month" value={fmt(data.assignedLastMonth)} />
          <Row label="Spent Last Month" value={fmt(data.spentLastMonth)} />
          <Row label="Average Assigned" value={fmt(data.averageAssigned)} />
          <Row label="Average Spent" value={fmt(data.averageSpent)} />
        </div>
      </div>
    </div>
  )
})
