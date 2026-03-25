import { useEffect, useState, useCallback } from 'react'
import { get, post } from '../../lib/api'
import VerdictCard from './VerdictCard'
import {
  type StressTestResult, type CategoryGroup, type Category, type Urgency, type Verdict,
  CATEGORY_LABELS, URGENCY_LABELS, VERDICT_STYLES,
} from './types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-600'

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ r, onDelete }: { r: StressTestResult; onDelete: (id: number) => void }) {
  const style = VERDICT_STYLES[r.verdict]
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 font-medium">{r.item}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${style.bg} ${style.border} ${style.text}`}>
            {style.label}
          </span>
          <span className="text-xs text-gray-600">{CATEGORY_LABELS[r.category as Category] ?? r.category}</span>
          <span className="text-xs text-gray-600">{URGENCY_LABELS[r.urgency as Urgency] ?? r.urgency}</span>
          {r.budgetCategoryName && (
            <span className="text-xs text-indigo-400">📁 {r.budgetCategoryName}</span>
          )}
        </div>
        {r.why && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.why}</p>}
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-gray-100 tabular-nums">{fmt(r.price)}</div>
        <div className="text-xs text-gray-600">{r.date}</div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(r.id)}
        className="px-2 py-1 text-xs text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors shrink-0"
      >✕</button>
    </div>
  )
}

// ── Toggle button group ───────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options, value, onChange, labelMap,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labelMap: Record<T, string>
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value === opt
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
          }`}>
          {labelMap[opt]}
        </button>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = ['need', 'useful', 'comfort', 'impulse']
const URGENCIES: Urgency[]   = ['high', 'medium', 'low']

export default function StressTest() {
  const [item,       setItem]       = useState('')
  const [price,      setPrice]      = useState('')
  const [category,   setCategory]   = useState<Category>('useful')
  const [urgency,    setUrgency]    = useState<Urgency>('medium')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [result,     setResult]     = useState<StressTestResult | null>(null)
  const [history,    setHistory]    = useState<StressTestResult[]>([])
  const [groups,     setGroups]     = useState<CategoryGroup[]>([])

  const loadHistory = useCallback(() => {
    fetch('/api/stress-test')
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {})
  }, [])

  const loadGroups = useCallback(() => {
    get<CategoryGroup[]>('/categories')
      .then(setGroups)
      .catch(() => {})
  }, [])

  useEffect(() => { loadHistory(); loadGroups() }, [loadHistory, loadGroups])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item.trim()) { setError('Item name is required'); return }
    if (!price || parseFloat(price) <= 0) { setError('Price must be > 0'); return }
    if (!categoryId) { setError('Select a budget category'); return }
    setError(null)
    setSubmitting(true)
    try {
      const data = await post<StressTestResult>('/stress-test', {
        item: item.trim(),
        price: parseFloat(price),
        category,
        urgency,
        category_id: categoryId,
      })
      setResult(data)
      loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/stress-test/${id}`, { method: 'DELETE' })
    setHistory(h => h.filter(r => r.id !== id))
    if (result?.id === id) setResult(null)
  }

  function handleReset() {
    setItem('')
    setPrice('')
    setCategory('useful')
    setUrgency('medium')
    setCategoryId('')
    setResult(null)
    setError(null)
  }

  const verdictCounts = history.reduce((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1
    return acc
  }, {} as Record<Verdict, number>)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-100">Purchase Stress Test</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Should you buy it? Tests against your actual category balances.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">

        {/* Item + Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              What do you want to buy? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={item}
              onChange={e => setItem(e.target.value)}
              className={inp}
              placeholder="e.g., New headphones"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Price (EUR) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`${inp} pl-7`}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Budget Category — which category would this come from? */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Budget category <span className="text-red-400">*</span>
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            className={inp}
          >
            <option value="">Select a category…</option>
            {groups.map(g => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-gray-700 mt-1">Which budget category would this purchase come from?</p>
        </div>

        {/* Category (purchase type) */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Purchase type</label>
          <ToggleGroup
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            labelMap={CATEGORY_LABELS}
          />
          <p className="text-xs text-gray-700 mt-1.5">
            {category === 'need'    && 'Essential — without it something breaks or you suffer.'}
            {category === 'useful'  && 'Makes your life/work meaningfully better.'}
            {category === 'comfort' && 'Nice to have, improves comfort or enjoyment.'}
            {category === 'impulse' && 'You want it right now, no real plan behind it.'}
          </p>
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Urgency</label>
          <ToggleGroup
            options={URGENCIES}
            value={urgency}
            onChange={setUrgency}
            labelMap={URGENCY_LABELS}
          />
          <p className="text-xs text-gray-700 mt-1.5">
            {urgency === 'high'   && 'Needed now or very soon — waiting has real cost.'}
            {urgency === 'medium' && 'Could wait a week or two without major issue.'}
            {urgency === 'low'    && 'No rush — could easily wait a month or more.'}
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? 'Analysing…' : 'Should I buy it?'}
          </button>
          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Result */}
      {result && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Verdict — {result.item}
          </h2>
          <VerdictCard result={result} />
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              History ({history.length})
            </h2>
            <div className="flex gap-2">
              {(['buy', 'wait', 'reject'] as Verdict[]).map(v => {
                const count = verdictCounts[v]
                if (!count) return null
                const s = VERDICT_STYLES[v]
                return (
                  <span key={v} className={`text-xs px-1.5 py-0.5 rounded border ${s.bg} ${s.border} ${s.text}`}>
                    {s.label} {count}
                  </span>
                )
              })}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4">
            {history.map(r => (
              <HistoryRow key={r.id} r={r} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {history.length === 0 && !result && (
        <div className="text-center py-12 text-gray-700">
          <p className="text-sm">No tests yet. Fill in the form above to get your first verdict.</p>
        </div>
      )}
    </div>
  )
}
