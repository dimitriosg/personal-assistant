import { useState, useEffect } from 'react'
import { MONTHS, CATEGORY_LABELS, RECURRENCE_LABELS, defaultIsShared, type Expense } from './types'

interface FormState {
  name: string; amount: string; category: string; isShared: boolean
  customSplitStr: string   // '' = use global; '60' = 60% override
  recurrence: string; dueDay: string; dueMonth: string; status: string; notes: string
}

interface Props {
  initial?: Expense
  splitPercent: number
  onSave: (data: FormState) => Promise<void>
  onCancel: () => void
}

const BLANK: FormState = {
  name: '', amount: '', category: 'fixed_shared', isShared: true,
  customSplitStr: '',
  recurrence: 'monthly', dueDay: '', dueMonth: '1', status: 'active', notes: '',
}

const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-600'
const lbl = 'block text-xs text-gray-400 mb-1.5'

export default function ExpenseForm({ initial, splitPercent, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        name:           initial.name,
        amount:         String(initial.amount),
        category:       initial.category,
        isShared:       initial.isShared,
        customSplitStr: initial.custom_split != null ? String(Math.round(initial.custom_split * 100)) : '',
        recurrence:     initial.recurrence,
        dueDay:         initial.due_day != null ? String(initial.due_day) : '',
        dueMonth:       initial.due_month != null ? String(initial.due_month) : '1',
        status:         initial.status,
        notes:          initial.notes ?? '',
      })
    } else {
      setForm(BLANK)
    }
  }, [initial])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  function handleCategoryChange(cat: string) {
    setForm(f => ({ ...f, category: cat, isShared: defaultIsShared(cat) }))
  }

  const needsMonth = form.recurrence === 'annual' || form.recurrence === 'specific_month'

  // Effective split: custom if set, else global
  const effectiveSplitPct = form.customSplitStr && parseFloat(form.customSplitStr) > 0
    ? parseFloat(form.customSplitStr)
    : splitPercent
  const isCustomSplit = form.customSplitStr !== '' && parseFloat(form.customSplitStr) !== splitPercent

  const previewShare = form.amount && form.isShared
    ? `€${(parseFloat(form.amount) * effectiveSplitPct / 100).toFixed(2)} your share (${effectiveSplitPct}%${isCustomSplit ? ' custom' : ''})`
    : null

  function validate(): boolean {
    const errs: string[] = []
    if (!form.name.trim())                            errs.push('Name is required')
    if (!form.amount || parseFloat(form.amount) <= 0) errs.push('Amount must be greater than 0')
    if (needsMonth && !form.dueMonth)                 errs.push('Due month is required for this recurrence')
    if (form.customSplitStr) {
      const v = parseFloat(form.customSplitStr)
      if (isNaN(v) || v <= 0 || v > 100)             errs.push('Custom split must be 1–100')
    }
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
          {initial ? 'Edit expense' : 'Add expense'}
        </h2>
        <button type="button" onClick={onCancel}
          className="text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none">✕</button>
      </div>

      {/* Name + Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Name <span className="text-red-400">*</span></label>
          <input type="text" value={form.name}
            onChange={e => set('name', e.target.value)}
            className={inp} placeholder="e.g., Rent" autoFocus />
        </div>
        <div>
          <label className={lbl}>Amount (EUR) <span className="text-red-400">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
            <input type="number" min={0} step={1} value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className={`${inp} pl-7`} placeholder="0.00" />
          </div>
          {previewShare && <p className="text-xs text-indigo-400 mt-1">{previewShare}</p>}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className={lbl}>Category</label>
        <select value={form.category} onChange={e => handleCategoryChange(e.target.value)} className={inp}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Is shared + custom split */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input type="checkbox" checked={form.isShared}
            onChange={e => set('isShared', e.target.checked)}
            className="w-4 h-4 accent-indigo-500" />
          <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
            Shared expense
          </span>
        </label>

        {form.isShared && (
          <div className="ml-7 flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Split %:</label>
            <div className="relative w-24">
              <input
                type="number" min={1} max={100} step={1}
                value={form.customSplitStr}
                onChange={e => set('customSplitStr', e.target.value)}
                placeholder={String(splitPercent)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 transition-colors placeholder-gray-600"
              />
            </div>
            <span className="text-xs text-gray-600">
              {form.customSplitStr ? 'custom' : `global (${splitPercent}%)`}
            </span>
            {form.customSplitStr && (
              <button type="button" onClick={() => set('customSplitStr', '')}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recurrence + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Recurrence</label>
          <select value={form.recurrence} onChange={e => set('recurrence', e.target.value)} className={inp}>
            {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="paused">Paused</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Due day + Due month */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Due day (optional)</label>
          <input type="number" min={1} max={31} value={form.dueDay}
            onChange={e => set('dueDay', e.target.value)}
            className={inp} placeholder="e.g., 1" />
        </div>
        {needsMonth && (
          <div>
            <label className={lbl}>Due month <span className="text-red-400">*</span></label>
            <select value={form.dueMonth} onChange={e => set('dueMonth', e.target.value)} className={inp}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className={lbl}>Notes (optional)</label>
        <textarea rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)}
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
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add expense'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
