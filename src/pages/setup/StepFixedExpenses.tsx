import { useState } from 'react'
import { MONTHS, type FixedExpenseEntry, type Recurrence } from './types'

interface Props {
  data: FixedExpenseEntry[]
  globalSplitPercent: number
  onChange: (data: FixedExpenseEntry[]) => void
}

const SUGGESTIONS = [
  'Rent / Mortgage', 'Utilities', 'Phone', 'Internet',
  'Car installment', 'Gym', 'Streaming', 'Insurance',
]

const BLANK = {
  name: '', amount: '', isShared: true, customSplitStr: '',
  recurrence: 'monthly' as Recurrence,
  dueDay: '', dueMonth: 1,
}

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const label = 'block text-xs text-gray-400 mb-1'

export default function StepFixedExpenses({ data, globalSplitPercent, onChange }: Props) {
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState<string[]>([])

  function validate() {
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Name is required')
    if (!form.amount || parseFloat(form.amount) <= 0) errs.push('Amount must be > 0')
    if ((form.recurrence === 'annual' || form.recurrence === 'specific_month') && !form.dueMonth) {
      errs.push('Due month is required for this recurrence')
    }
    if (form.customSplitStr) {
      const v = parseFloat(form.customSplitStr)
      if (isNaN(v) || v <= 0 || v > 100) errs.push('Custom split must be 1–100')
    }
    setErrors(errs)
    return errs.length === 0
  }

  function addExpense() {
    if (!validate()) return
    const customSplitDecimal = form.isShared && form.customSplitStr && parseFloat(form.customSplitStr) > 0
      ? parseFloat(form.customSplitStr) / 100
      : null
    const entry: FixedExpenseEntry = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      isShared: form.isShared,
      customSplit: customSplitDecimal,
      recurrence: form.recurrence,
      dueDay: form.dueDay ? Math.min(31, Math.max(1, parseInt(form.dueDay, 10))) : null,
      dueMonth: (form.recurrence === 'annual' || form.recurrence === 'specific_month')
        ? form.dueMonth
        : null,
    }
    onChange([...data, entry])
    setForm(BLANK)
    setErrors([])
  }

  function removeExpense(id: string) {
    onChange(data.filter(e => e.id !== id))
  }

  const needsMonth = form.recurrence === 'annual' || form.recurrence === 'specific_month'
  const effectiveSplitPct = form.customSplitStr && parseFloat(form.customSplitStr) > 0
    ? parseFloat(form.customSplitStr)
    : globalSplitPercent

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Fixed expenses</h2>
        <p className="text-sm text-gray-500">Regular bills and obligations. You can add more later.</p>
      </div>

      {/* Suggestion chips */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Quick add:</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} type="button" onClick={() => setForm(f => ({ ...f, name: s }))}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600
                text-gray-400 hover:text-gray-200 text-xs rounded-full transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Existing items */}
      {data.length > 0 && (
        <div className="space-y-2">
          {data.map(e => {
            const splitPct = e.customSplit != null ? Math.round(e.customSplit * 100) : globalSplitPercent
            return (
              <div key={e.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">{e.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {e.recurrence} · {e.isShared ? `shared (${splitPct}%)` : 'personal'}
                    {e.isShared && e.customSplit != null && <span className="text-indigo-400 ml-1">custom split</span>}
                    {e.dueDay ? ` · day ${e.dueDay}` : ''}
                    {e.dueMonth ? ` · ${MONTHS[e.dueMonth - 1]}` : ''}
                  </div>
                </div>
                <div className="text-sm text-gray-300 font-medium">€{e.amount.toFixed(2)}</div>
                <button type="button" onClick={() => removeExpense(e.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs px-1.5 py-0.5 rounded ml-1">
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">
          {data.length === 0 ? 'Add your first fixed expense' : 'Add another'}
        </h3>

        {/* Name + Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Name</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={input} placeholder="e.g., Rent" />
          </div>
          <div>
            <label className={label}>Amount (EUR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
              <input type="number" min={0} step={10} value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={`${input} pl-7`} placeholder="800" />
            </div>
          </div>
        </div>

        {/* Shared + Recurrence */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Who pays?</label>
            <div className="flex gap-2">
              {[{ label: 'Shared', value: true }, { label: 'Personal', value: false }].map(opt => (
                <button key={String(opt.value)} type="button"
                  onClick={() => setForm(f => ({ ...f, isShared: opt.value, customSplitStr: '' }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                    ${form.isShared === opt.value
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Recurrence</label>
            <select value={form.recurrence}
              onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as Recurrence }))}
              className={input}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="specific_month">Specific month</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
        </div>

        {/* Custom split (only when shared) */}
        {form.isShared && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 shrink-0">Split % (your share):</label>
            <div className="relative w-24">
              <input type="number" min={1} max={100} step={1}
                value={form.customSplitStr}
                onChange={e => setForm(f => ({ ...f, customSplitStr: e.target.value }))}
                placeholder={String(globalSplitPercent)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-600"
              />
            </div>
            <span className="text-xs text-gray-600">
              {form.customSplitStr ? `${effectiveSplitPct}% (custom)` : `${globalSplitPercent}% (global)`}
            </span>
          </div>
        )}

        {/* Due day + month */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Due day (optional)</label>
            <input type="number" min={1} max={31} value={form.dueDay}
              onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))}
              className={input} placeholder="1" />
          </div>
          {needsMonth && (
            <div>
              <label className={label}>Due month <span className="text-red-400">*</span></label>
              <select value={form.dueMonth}
                onChange={e => setForm(f => ({ ...f, dueMonth: parseInt(e.target.value, 10) }))}
                className={input}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div className="text-xs text-red-400 space-y-0.5">
            {errors.map(e => <div key={e}>· {e}</div>)}
          </div>
        )}

        <button type="button" onClick={addExpense}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          + Add expense
        </button>
      </div>

      {data.length === 0 && (
        <p className="text-xs text-gray-600 text-center">
          No fixed expenses yet. You can skip this step and add them later.
        </p>
      )}
    </div>
  )
}
