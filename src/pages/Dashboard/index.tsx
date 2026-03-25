import { useEffect, useState } from 'react'
import { get } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  id: number; name: string; amount: number; myShare: number
  daysAway: number; dueMonth: number; isShared: boolean
}

interface UpcomingBucket {
  label: string; from: number; to: number
  items: UpcomingItem[]; myShareTotal: number
}

interface DashboardData {
  month: string
  splitPercent: number
  savingsTarget: number
  income: {
    salary: number
    extras: { id: number; name: string; amount: number; type: string }[]
    total: number
  }
  fixed: {
    items: { id: number; name: string; amount: number; myShare: number; isShared: boolean; recurrence: string }[]
    total: number; myShare: number
  }
  alreadySpent: number
  remaining: number
  remainingSafe: number
  upcoming: UpcomingBucket[]
  verdict: 'green' | 'yellow' | 'red'
  verdictReason: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

const VERDICT_STYLES = {
  green:  { bar: 'bg-green-500',  badge: 'bg-green-950/60 border-green-900 text-green-400',  dot: 'bg-green-500'  },
  yellow: { bar: 'bg-yellow-500', badge: 'bg-yellow-950/60 border-yellow-900 text-yellow-400', dot: 'bg-yellow-500' },
  red:    { bar: 'bg-red-500',    badge: 'bg-red-950/60 border-red-900 text-red-400',         dot: 'bg-red-500'    },
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight = false,
}: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight ? 'bg-indigo-950/40 border-indigo-800' : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? 'text-indigo-300' : 'text-gray-100'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData]     = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    get<DashboardData>('/dashboard')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 text-sm">Loading dashboard…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
        <p className="text-red-400 text-sm font-medium">Failed to load dashboard</p>
        <p className="text-red-600 text-xs mt-1">{error}</p>
      </div>
    )
  }

  const { verdict } = data
  const vs = VERDICT_STYLES[verdict]
  const hasUpcoming = data.upcoming.some(b => b.items.length > 0)
  const bufferOk = data.remaining >= data.savingsTarget

  return (
    <div className="space-y-6">

      {/* ── Header + verdict banner ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-100">{data.month}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{data.splitPercent}% share · €{data.savingsTarget.toFixed(0)} buffer target</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${vs.badge}`}>
            <span className={`w-2 h-2 rounded-full ${vs.dot}`} />
            {verdict === 'green' ? 'Comfortable' : verdict === 'yellow' ? 'Tight' : 'Danger'}
          </div>
        </div>

        {/* Colored verdict bar */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className={`h-2 rounded-full w-full bg-gray-800 overflow-hidden`}>
            {data.remaining > 0 && data.income.total > 0 && (
              <div
                className={`h-full rounded-full transition-all ${vs.bar}`}
                style={{ width: `${Math.min(100, (data.remaining / data.income.total) * 100).toFixed(1)}%` }}
              />
            )}
          </div>
          <p className="text-sm text-gray-400 mt-2">{data.verdictReason}</p>
        </div>
      </div>

      {/* ── 4 stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Income this month"
          value={fmt(data.income.total)}
          sub={data.income.extras.length > 0
            ? `salary + ${data.income.extras.length} extra${data.income.extras.length > 1 ? 's' : ''}`
            : 'salary only'}
        />
        <StatCard
          label={`Fixed expenses (${data.splitPercent}% share)`}
          value={fmt(data.fixed.myShare)}
          sub={data.fixed.total !== data.fixed.myShare ? `total €${data.fixed.total.toFixed(2)}` : undefined}
        />
        <StatCard
          label="Already spent"
          value={fmt(data.alreadySpent)}
          sub="tracked transactions"
        />
        <StatCard
          label="Remaining safe to spend"
          value={fmt(data.remaining)}
          sub={data.remainingSafe >= 0
            ? `€${data.remainingSafe.toFixed(2)} after buffer`
            : `€${Math.abs(data.remainingSafe).toFixed(2)} below buffer`}
          highlight={bufferOk}
        />
      </div>

      {/* ── Income breakdown (if extras) ── */}
      {data.income.extras.length > 0 && (
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Income breakdown</h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-800">
              <span className="text-sm text-gray-300">Salary</span>
              <span className="text-sm font-medium text-gray-200 tabular-nums">{fmt(data.income.salary)}</span>
            </div>
            {data.income.extras.map(e => (
              <div key={e.id} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-300">{e.name}</span>
                <span className="text-sm font-medium text-gray-200 tabular-nums">{fmt(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-semibold text-gray-200">Total</span>
              <span className="text-sm font-semibold text-gray-100 tabular-nums">{fmt(data.income.total)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Fixed expenses breakdown ── */}
      {data.fixed.items.length > 0 && (
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fixed expenses this month</h2>
          <div className="space-y-0">
            {data.fixed.items.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-300 truncate block">{e.name}</span>
                  <span className="text-xs text-gray-600">
                    {e.isShared ? `shared · your ${data.splitPercent}%` : 'personal'} · {e.recurrence}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium text-gray-200 tabular-nums">{fmt(e.myShare)}</div>
                  {e.isShared && (
                    <div className="text-xs text-gray-600 tabular-nums">of {fmt(e.amount)}</div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3">
              <span className="text-sm font-semibold text-gray-200">Your share total</span>
              <span className="text-sm font-semibold text-gray-100 tabular-nums">{fmt(data.fixed.myShare)}</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Upcoming pressure ── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming pressure</h2>

        {!hasUpcoming ? (
          <p className="text-sm text-gray-600">No upcoming irregular expenses in the next 180 days.</p>
        ) : (
          <div className="space-y-1">
            {data.upcoming.map(bucket => (
              <div key={bucket.label}>
                {/* Always show bucket header; items only if non-empty */}
                {bucket.items.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-xs font-medium text-gray-400">{bucket.label}</span>
                      <span className="text-xs font-medium text-amber-400 tabular-nums">{fmt(bucket.myShareTotal)}</span>
                    </div>
                    {bucket.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 pl-3 py-2 border-b border-gray-800/60 last:border-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-300">{item.name}</span>
                          <span className="text-xs text-gray-600 ml-2">
                            {MONTHS_SHORT[item.dueMonth - 1]}
                            {item.isShared ? ' · shared' : ''}
                            {' · '}{item.daysAway}d away
                          </span>
                        </div>
                        <span className="text-sm text-gray-300 tabular-nums shrink-0">{fmt(item.myShare)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <span className="text-xs text-gray-700">{bucket.label}</span>
                    <span className="text-xs text-gray-700">—</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Savings status ── */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Savings buffer</h2>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500">Current buffer</div>
            <div className={`text-2xl font-bold tabular-nums ${bufferOk ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(data.remaining)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Target</div>
            <div className="text-lg font-semibold text-gray-400 tabular-nums">{fmt(data.savingsTarget)}</div>
          </div>
        </div>

        {/* Buffer progress bar */}
        {data.savingsTarget > 0 && (
          <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                data.remaining >= data.savingsTarget ? 'bg-green-500' :
                data.remaining >= data.savingsTarget * 0.5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, (data.remaining / (data.savingsTarget * 2)) * 100)).toFixed(1)}%`
              }}
            />
          </div>
        )}

        <p className="text-xs text-gray-600 mt-2">
          {bufferOk
            ? `${fmt(data.remainingSafe)} available after maintaining target`
            : `${fmt(Math.abs(data.remainingSafe))} short of target`}
        </p>
      </section>

    </div>
  )
}
