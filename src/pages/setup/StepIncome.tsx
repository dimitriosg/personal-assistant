import { useState } from 'react'
import { MONTHS, type BonusEntry, type IncomeData, type OtherIncomeEntry } from './types'

interface Props {
  data: IncomeData
  onChange: (data: IncomeData) => void
}

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const label = 'block text-sm text-gray-400 mb-1.5'
const addBtn = 'px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors'
const removeBtn = 'text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-0.5 rounded'

const BLANK_BONUS = { name: '', amount: '', expectedMonth: 1 }
const BLANK_OTHER = { name: '', amount: '', type: 'one-off' as const, isRecurring: false, expectedMonth: 1 }

export default function StepIncome({ data, onChange }: Props) {
  const [bonusForm, setBonusForm] = useState(BLANK_BONUS)
  const [otherForm, setOtherForm] = useState(BLANK_OTHER)
  const [showOtherSection, setShowOtherSection] = useState(false)

  const set = <K extends keyof IncomeData>(key: K, value: IncomeData[K]) =>
    onChange({ ...data, [key]: value })

  // ── Bonuses ─────────────────────────────────────────────────────────────────

  function addBonus() {
    if (!bonusForm.name.trim() || !bonusForm.amount) return
    const entry: BonusEntry = {
      id: crypto.randomUUID(),
      name: bonusForm.name.trim(),
      amount: parseFloat(bonusForm.amount),
      expectedMonth: bonusForm.expectedMonth,
    }
    onChange({ ...data, bonuses: [...data.bonuses, entry] })
    setBonusForm(BLANK_BONUS)
  }

  function removeBonus(id: string) {
    onChange({ ...data, bonuses: data.bonuses.filter(b => b.id !== id) })
  }

  // ── Other income ─────────────────────────────────────────────────────────────

  function addOther() {
    if (!otherForm.name.trim() || !otherForm.amount) return
    const entry: OtherIncomeEntry = {
      id: crypto.randomUUID(),
      name: otherForm.name.trim(),
      amount: parseFloat(otherForm.amount),
      type: otherForm.type,
      isRecurring: otherForm.isRecurring,
      expectedMonth: otherForm.isRecurring ? null : otherForm.expectedMonth,
    }
    onChange({ ...data, otherIncome: [...data.otherIncome, entry] })
    setOtherForm(BLANK_OTHER)
  }

  function removeOther(id: string) {
    onChange({ ...data, otherIncome: data.otherIncome.filter(o => o.id !== id) })
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Income</h2>
        <p className="text-sm text-gray-500">Your regular and expected income sources.</p>
      </div>

      {/* Salary */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">Base salary</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Monthly amount (EUR) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
              <input
                type="number"
                min={0}
                step={100}
                value={data.salary.amount || ''}
                onChange={e => set('salary', { ...data.salary, amount: parseFloat(e.target.value) || 0 })}
                className={`${input} pl-7`}
                placeholder="2500"
              />
            </div>
          </div>
          <div>
            <label className={label}>Payment day (optional)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={data.salary.paymentDay ?? ''}
              onChange={e => {
                const v = e.target.value
                set('salary', { ...data.salary, paymentDay: v ? Math.min(31, Math.max(1, parseInt(v, 10))) : null })
              }}
              className={input}
              placeholder="25"
            />
          </div>
        </div>
        {data.salary.amount <= 0 && (
          <p className="text-xs text-amber-500">Enter your monthly salary to continue.</p>
        )}
      </div>

      {/* Bonuses */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Bonuses</h3>
          <div className="flex gap-2">
            {([true, false] as const).map(val => (
              <button
                key={String(val)}
                type="button"
                onClick={() => set('hasBonus', val)}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors
                  ${data.hasBonus === val
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'}`}
              >
                {val ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {data.hasBonus && (
          <div className="space-y-3">
            {/* Existing bonuses */}
            {data.bonuses.map(b => (
              <div key={b.id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="flex-1 text-sm text-gray-200">{b.name}</div>
                <div className="text-sm text-gray-400">€{b.amount.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{MONTHS[b.expectedMonth - 1]}</div>
                <button type="button" onClick={() => removeBonus(b.id)} className={removeBtn}>✕</button>
              </div>
            ))}

            {/* Add bonus form */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={bonusForm.name}
                onChange={e => setBonusForm(f => ({ ...f, name: e.target.value }))}
                className={input}
                placeholder="e.g., Easter bonus"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                <input
                  type="number"
                  min={0}
                  value={bonusForm.amount}
                  onChange={e => setBonusForm(f => ({ ...f, amount: e.target.value }))}
                  className={`${input} pl-7`}
                  placeholder="500"
                />
              </div>
              <select
                value={bonusForm.expectedMonth}
                onChange={e => setBonusForm(f => ({ ...f, expectedMonth: parseInt(e.target.value, 10) }))}
                className={input}
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <button type="button" onClick={addBonus} className={addBtn}>+ Add bonus</button>
          </div>
        )}
      </div>

      {/* Other income */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Other income</h3>
          {!showOtherSection && (
            <button
              type="button"
              onClick={() => setShowOtherSection(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + Add
            </button>
          )}
        </div>

        {!showOtherSection && data.otherIncome.length === 0 && (
          <p className="text-xs text-gray-600">Freelance work, side income, rental income, etc. Optional.</p>
        )}

        {(showOtherSection || data.otherIncome.length > 0) && (
          <div className="space-y-3">
            {data.otherIncome.map(o => (
              <div key={o.id} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="flex-1 text-sm text-gray-200">{o.name}</div>
                <div className="text-sm text-gray-400">€{o.amount.toFixed(2)}</div>
                <div className="text-xs text-gray-500">
                  {o.isRecurring ? 'monthly' : MONTHS[(o.expectedMonth ?? 1) - 1]}
                </div>
                <button type="button" onClick={() => removeOther(o.id)} className={removeBtn}>✕</button>
              </div>
            ))}

            {showOtherSection && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={otherForm.name}
                    onChange={e => setOtherForm(f => ({ ...f, name: e.target.value }))}
                    className={input}
                    placeholder="Name"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                    <input
                      type="number"
                      min={0}
                      value={otherForm.amount}
                      onChange={e => setOtherForm(f => ({ ...f, amount: e.target.value }))}
                      className={`${input} pl-7`}
                      placeholder="Amount"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={otherForm.isRecurring}
                      onChange={e => setOtherForm(f => ({ ...f, isRecurring: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                    Recurring monthly
                  </label>
                  {!otherForm.isRecurring && (
                    <select
                      value={otherForm.expectedMonth}
                      onChange={e => setOtherForm(f => ({ ...f, expectedMonth: parseInt(e.target.value, 10) }))}
                      className={`${input} flex-1`}
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addOther} className={addBtn}>+ Add</button>
                  <button
                    type="button"
                    onClick={() => setShowOtherSection(false)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showOtherSection && (
              <button
                type="button"
                onClick={() => setShowOtherSection(true)}
                className={addBtn}
              >
                + Add another
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
