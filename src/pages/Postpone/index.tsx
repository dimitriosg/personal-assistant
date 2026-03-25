import { useEffect, useState, useCallback } from 'react'
import { get, post } from '../../lib/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

type Priority = 'must_fund' | 'should_fund' | 'can_postpone' | 'should_postpone'

interface PostponeItem {
  category_id:    number
  category_name:  string
  group_id:       number
  group_name:     string
  assigned:       number
  activity:       number
  available:      number
  target_amount:  number
  target_type:    string
  underfunded:    number
  priority:       Priority
  priority_label: string
}

interface PostponeData {
  month: string
  items: PostponeItem[]
  summary: {
    totalUnderfunded: number
    postponableAmount: number
    categoryCount: number
  }
}

const PRIORITY_STYLES: Record<Priority, { bg: string; border: string; text: string; badge: string }> = {
  must_fund:        { bg: 'bg-red-950/40',    border: 'border-red-800',    text: 'text-red-400',    badge: '🔴' },
  should_fund:      { bg: 'bg-amber-950/40',  border: 'border-amber-800',  text: 'text-amber-400',  badge: '🟡' },
  can_postpone:     { bg: 'bg-green-950/40',  border: 'border-green-800',  text: 'text-green-400',  badge: '🟢' },
  should_postpone:  { bg: 'bg-blue-950/40',   border: 'border-blue-800',   text: 'text-blue-400',   badge: '🔵' },
}

export default function Postpone() {
  const [data, setData]         = useState<PostponeData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [moving, setMoving]     = useState<number | null>(null)
  const [moveTo, setMoveTo]     = useState<number | null>(null)
  const [moveAmount, setMoveAmount] = useState('')

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const loadData = useCallback(() => {
    setLoading(true)
    get<PostponeData>(`/postpone?month=${month}`)
      .then(d => { setData(d); setError(null) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [month])

  useEffect(() => { loadData() }, [loadData])

  async function handleMove() {
    if (!moving || !moveTo || !moveAmount || parseFloat(moveAmount) <= 0) return
    try {
      await post('/budget/move', {
        from_category_id: moving,
        to_category_id: moveTo,
        month,
        amount: parseFloat(moveAmount),
      })
      setMoving(null)
      setMoveTo(null)
      setMoveAmount('')
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed')
    }
  }

  if (loading) {
    return <div className="text-gray-600 text-sm py-12 text-center">Loading…</div>
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
        {error}
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Postpone Analysis</h1>
          <p className="text-xs text-gray-500 mt-0.5">Identify what to postpone and free up money for priorities.</p>
        </div>
        <div className="text-center py-12 text-gray-700">
          <p className="text-sm">All categories are fully funded. Nothing to postpone! 🎉</p>
        </div>
      </div>
    )
  }

  // Group items by priority
  const grouped = new Map<Priority, PostponeItem[]>()
  for (const item of data.items) {
    const list = grouped.get(item.priority) ?? []
    list.push(item)
    grouped.set(item.priority, list)
  }

  const mustFund = data.items.filter(i => i.priority === 'must_fund' || i.priority === 'should_fund')
  const canPostpone = data.items.filter(i => i.priority === 'can_postpone' || i.priority === 'should_postpone')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Postpone Analysis</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Identify what to postpone and free up money for priorities.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Underfunded</div>
          <div className="text-lg font-bold text-red-400">{fmt(data.summary.totalUnderfunded)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Postponable</div>
          <div className="text-lg font-bold text-green-400">{fmt(data.summary.postponableAmount)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Categories</div>
          <div className="text-lg font-bold text-gray-200">{data.summary.categoryCount}</div>
        </div>
      </div>

      {/* Priority groups */}
      {(['must_fund', 'should_fund', 'can_postpone', 'should_postpone'] as Priority[]).map(priority => {
        const items = grouped.get(priority)
        if (!items || items.length === 0) return null
        const style = PRIORITY_STYLES[priority]
        const label = items[0].priority_label
        const total = items.reduce((s, i) => s + i.underfunded, 0)

        return (
          <section key={priority}>
            <div className="flex items-center gap-2 mb-3">
              <span>{style.badge}</span>
              <h2 className="text-sm font-semibold text-gray-300">{label}</h2>
              <span className={`text-xs ${style.text}`}>{fmt(total)}</span>
            </div>
            <div className={`rounded-xl border ${style.border} overflow-hidden`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${style.bg} text-xs text-gray-500`}>
                    <th className="text-left px-4 py-2 font-medium">Category</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Group</th>
                    <th className="text-right px-4 py-2 font-medium">Target</th>
                    <th className="text-right px-4 py-2 font-medium">Available</th>
                    <th className="text-right px-4 py-2 font-medium">Gap</th>
                    <th className="px-4 py-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.category_id} className="border-t border-gray-800/50 hover:bg-gray-900/50">
                      <td className="px-4 py-2.5 text-gray-200">{item.category_name}</td>
                      <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{item.group_name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{fmt(item.target_amount)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${item.available < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                        {fmt(item.available)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-400 tabular-nums font-medium">{fmt(item.underfunded)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {(priority === 'can_postpone' || priority === 'should_postpone') && (
                          <button
                            type="button"
                            onClick={() => { setMoving(item.category_id); setMoveAmount(String(item.underfunded)) }}
                            className="text-xs px-2 py-1 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 rounded transition-colors"
                          >
                            Move
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {/* Move Money Modal */}
      {moving && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-md space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Move Money</h3>
            <p className="text-xs text-gray-500">
              Move from{' '}
              <span className="text-gray-300">
                {data.items.find(i => i.category_id === moving)?.category_name}
              </span>{' '}
              to a priority category.
            </p>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount (EUR)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={moveAmount}
                onChange={e => setMoveAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Move to</label>
              <select
                value={moveTo ?? ''}
                onChange={e => setMoveTo(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select category…</option>
                {mustFund.map(i => (
                  <option key={i.category_id} value={i.category_id}>
                    {i.group_name}: {i.category_name} (needs {fmt(i.underfunded)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleMove}
                disabled={!moveTo || !moveAmount || parseFloat(moveAmount) <= 0}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Move Money
              </button>
              <button
                type="button"
                onClick={() => { setMoving(null); setMoveTo(null); setMoveAmount('') }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
