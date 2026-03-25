import { useEffect, useState, useCallback } from 'react'
import { get, post, put } from '../../lib/api'
import IncomeForm from './IncomeForm'
import { TYPE_LABELS, TYPE_STYLES, MONTHS_SHORT, type IncomeEntry, type IncomeApiResponse } from './types'

async function deleteIncome(id: number) {
  const r = await fetch(`/api/income/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(await r.text())
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

// ── Forecast card ─────────────────────────────────────────────────────────────

function ForecastCard({ months, total, bonusMonths }: {
  months: number
  total: number
  bonusMonths: { month: number; label: string; amount: number }[]
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">Next {months} months</div>
      <div className="text-xl font-bold text-gray-100 tabular-nums">{fmt(total)}</div>
      {bonusMonths.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {bonusMonths.map(bm => (
            <span key={bm.month}
              className="text-xs px-1.5 py-0.5 rounded border bg-amber-950/60 text-amber-400 border-amber-900">
              {bm.label} +{fmt(bm.amount)}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-700 mt-2">No bonuses</p>
      )}
    </div>
  )
}

// ── Single income row ─────────────────────────────────────────────────────────

function IncomeRow({ entry, onEdit, onDelete }: {
  entry: IncomeEntry
  onEdit: (e: IncomeEntry) => void
  onDelete: (e: IncomeEntry) => void
}) {
  const typeStyle = TYPE_STYLES[entry.type] ?? TYPE_STYLES['one-off']
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 font-medium">{entry.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${typeStyle}`}>
            {TYPE_LABELS[entry.type] ?? entry.type}
          </span>
          {!entry.isRecurring && entry.expected_month && (
            <span className="text-xs text-gray-500">
              {MONTHS_SHORT[entry.expected_month - 1]}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {entry.isRecurring ? 'Every month' : 'One-time'}
          {entry.due_day ? ` · day ${entry.due_day}` : ''}
          {entry.notes ? ` · ${entry.notes}` : ''}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-gray-100 tabular-nums">{fmt(entry.amount)}</div>
        <div className="text-xs text-gray-600">{entry.isRecurring ? '/mo' : 'once'}</div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button type="button" onClick={() => onEdit(entry)}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors">
          Edit
        </button>
        <button type="button" onClick={() => onDelete(entry)}
          className="px-2 py-1 text-xs text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Income() {
  const [data, setData]       = useState<IncomeApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<IncomeEntry | undefined>(undefined)

  const load = useCallback(() => {
    get<IncomeApiResponse>('/income')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd()              { setEditing(undefined); setModalOpen(true) }
  function openEdit(e: IncomeEntry) { setEditing(e); setModalOpen(true) }
  function closeModal()            { setModalOpen(false); setEditing(undefined) }

  async function handleSave(form: {
    name: string; amount: string; type: string; isRecurring: boolean
    expectedMonth: string; dueDay: string; notes: string
  }) {
    const payload = {
      name:           form.name,
      amount:         parseFloat(form.amount),
      type:           form.type,
      is_recurring:   form.isRecurring,
      expected_month: form.expectedMonth ? parseInt(form.expectedMonth, 10) : null,
      due_day:        form.dueDay ? parseInt(form.dueDay, 10) : null,
      notes:          form.notes || null,
    }
    if (editing) await put(`/income/${editing.id}`, payload)
    else await post('/income', payload)
    closeModal()
    load()
  }

  async function handleDelete(e: IncomeEntry) {
    if (!window.confirm(`Delete "${e.name}"? This cannot be undone.`)) return
    await deleteIncome(e.id)
    load()
  }

  if (loading) return <div className="text-gray-600 text-sm py-8 text-center">Loading…</div>
  if (error || !data) return <div className="text-red-400 text-sm">{error}</div>

  const { income, summary, forecast, nextBonus } = data

  // Group by type in display order
  const groups = [
    { key: 'salary',   label: 'Salary',         items: income.filter(i => i.type === 'salary') },
    { key: 'bonus',    label: 'Bonuses',         items: income.filter(i => i.type === 'bonus') },
    { key: 'one-off',  label: 'Other / One-off', items: income.filter(i => i.type === 'one-off') },
  ].filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Income</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmt(summary.monthlyBase)}/mo base
            {summary.annualExtras > 0 ? ` · +${fmt(summary.annualExtras)} expected extras` : ''}
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
          + Add
        </button>
      </div>

      {/* Next bonus alert */}
      {nextBonus && (
        <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-900 rounded-xl px-4 py-3">
          <span className="text-amber-400 text-lg">★</span>
          <div>
            <p className="text-sm text-amber-300 font-medium">
              Bonus coming in {nextBonus.label}
              {nextBonus.monthsAway === 1 ? ' (next month!)' : ` (${nextBonus.monthsAway} months away)`}
            </p>
            <p className="text-xs text-amber-600">
              {nextBonus.name} · {fmt(nextBonus.amount)}
            </p>
          </div>
        </div>
      )}

      {/* Forecast */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Income forecast</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {forecast.map(p => (
            <ForecastCard key={p.months} months={p.months} total={p.total} bonusMonths={p.bonusMonths} />
          ))}
        </div>
      </section>

      {/* Income list */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg mb-2">No income sources yet</p>
          <p className="text-sm">Click <strong className="text-gray-500">+ Add</strong> to start.</p>
        </div>
      ) : (
        groups.map(({ key, label, items }) => (
          <section key={key} className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold text-gray-300">{label}</span>
              <span className="text-xs text-gray-500">
                {fmt(items.reduce((s, i) => s + i.amount, 0))}
                {items.some(i => i.isRecurring) ? '/mo' : ''}
              </span>
            </div>
            <div className="px-4">
              {items.map(e => (
                <IncomeRow key={e.id} entry={e} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <IncomeForm initial={editing} onSave={handleSave} onCancel={closeModal} />
          </div>
        </div>
      )}
    </div>
  )
}
