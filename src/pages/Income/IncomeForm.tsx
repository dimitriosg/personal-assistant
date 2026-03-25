import { useState, useEffect } from 'react'
import { MONTHS, type IncomeEntry } from './types'

interface FormState {
  name: string; amount: string; type: string
  isRecurring: boolean; expectedMonth: string
  dueDay: string; notes: string
}

interface Props {
  initial?: IncomeEntry
  onSave: (data: FormState) => Promise<void>
  onCancel: () => void
}

const BLANK: FormState = {
  name: '', amount: '', type: 'salary',
  isRecurring: true, expectedMonth: '1',
  dueDay: '', notes: '',
}

const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-600'
const lbl = 'block text-xs text-gray-400 mb-1.5'

export default function IncomeForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        name:          initial.name,
        amount:        String(initial.amount),
        type:          initial.type,
        isRecurring:   initial.isRecurring,
        expectedMonth: initial.expected_month != null ? String(initial.expected_month) : '1',
        dueDay:        initial.due_day != null ? String(initial.due_day) : '',
        notes:         initial.notes ?? '',
      })
    } else {
      setForm(BLANK)
    }
  }, [initial])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  function handleTypeChange(type: string) {
    setForm(f => ({
      ...f,
      type,
      isRecurring: type === 'salary' ? true : type === 'bonus' ? false : f.isRecurring,
    }))
  }

  // Salary is always recurring, so no expected month needed
  // Bonus always has expected month, never recurring
  // One-off: user chooses; expected month shows if not recurring
  const isSalary   = form.type === 'salary'
  const isBonus    = form.type === 'bonus'
  const showExpectedMonth = isBonus || (!isSalary && !form.isRecurring)
  const showPaymentDay    = isSalary

  function validate(): boolean {
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Name is required')
    if (!form.amount || parseFloat(form.amount) <= 0) errs.push('Amount must be > 0')
    if ((isBonus || showExpectedMonth) && !form.expectedMonth) errs.push('Expected month is required')
    setErrors(errs)
    return errs.length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">
          {initial ? 'Edit income' : 'Add income'}
        </h2>
        <button type="button" onClick={onCancel}
          className="text-gray-600 hover:text-gray-300 transition-colors text-lg">✕</button>
      </div>

      {/* Name + Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Name <span className="text-red-400">*</span></label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            className={inp} placeholder="e.g., Salary" autoFocus />
        </div>
        <div>
          <label className={lbl}>Amount (EUR) <span className="text-red-400">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
            <input type="number" min={0} step={1} value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className={`${inp} pl-7`} placeholder="0.00" />
          </div>
        </div>
      </div>

      {/* Type */}
      <div>
        <label className={lbl}>Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['salary', 'bonus', 'one-off'] as const).map(t => (
            <button key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                form.type === t
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Is recurring — only for one-off type */}
      {!isSalary && !isBonus && (
        <label className="flex items-center gap-3 cursor-pointer group">
          <input type="checkbox" checked={form.isRecurring}
            onChange={e => set('isRecurring', e.target.checked)}
            className="w-4 h-4 accent-indigo-500" />
          <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
            Recurring monthly
          </span>
        </label>
      )}

      {/* Salary: always recurring label */}
      {isSalary && (
        <p className="text-xs text-gray-600">Salary is counted every month automatically.</p>
      )}

      {/* Expected month */}
      {showExpectedMonth && (
        <div>
          <label className={lbl}>
            Expected month <span className="text-red-400">*</span>
          </label>
          <select value={form.expectedMonth} onChange={e => set('expectedMonth', e.target.value)}
            className={inp}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Payment day — salary only */}
      {showPaymentDay && (
        <div>
          <label className={lbl}>Payment day (optional)</label>
          <input type="number" min={1} max={31} value={form.dueDay}
            onChange={e => set('dueDay', e.target.value)}
            className={inp} placeholder="e.g., 25" />
          <p className="text-xs text-gray-600 mt-1">Day of month salary usually arrives.</p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className={lbl}>Notes (optional)</label>
        <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
          className={`${inp} resize-none`} placeholder="Any details…" />
      </div>

      {errors.length > 0 && (
        <div className="text-xs text-red-400 space-y-0.5 bg-red-950/30 border border-red-900 rounded-lg p-3">
          {errors.map(e => <div key={e}>· {e}</div>)}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={handleSubmit} disabled={saving}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600
            text-white text-sm font-medium rounded-lg transition-colors">
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add income'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
