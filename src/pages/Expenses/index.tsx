import { useEffect, useState, useCallback } from 'react'
import { get, post, put, patch, } from '../../lib/api'
import ExpenseForm from './ExpenseForm'
import {
  CATEGORY_LABELS, CATEGORY_ORDER, RECURRENCE_LABELS,
  STATUS_STYLES, MONTHS_SHORT, type Expense,
} from './types'

// Re-export delete separately to avoid naming conflict
async function deleteExpense(id: number) {
  const r = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(await r.text())
}

interface ApiResponse { splitPercent: number; expenses: Expense[] }

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

// ── Due date display ──────────────────────────────────────────────────────────

function dueLabel(e: Expense): string {
  const parts: string[] = []
  if (e.due_day) parts.push(`day ${e.due_day}`)
  if (e.due_month) parts.push(MONTHS_SHORT[e.due_month - 1])
  return parts.join(' · ')
}

// ── Single row ────────────────────────────────────────────────────────────────

function ExpenseRow({
  expense, splitPercent, onEdit, onDelete, onToggle,
}: {
  expense: Expense; splitPercent: number
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
  onToggle: (e: Expense) => void
}) {
  const due = dueLabel(expense)
  const statusStyle = STATUS_STYLES[expense.status] ?? STATUS_STYLES.active

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-800 last:border-0 ${
      expense.status === 'paused' ? 'opacity-50' : ''
    }`}>
      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 font-medium truncate">{expense.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${statusStyle}`}>
            {expense.status}
          </span>
          {expense.notes && (
            <span className="text-xs text-gray-600" title={expense.notes}>note</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
          <span>{RECURRENCE_LABELS[expense.recurrence] ?? expense.recurrence}</span>
          {due && <span>· {due}</span>}
          {expense.isShared && (
            <span>· shared ({expense.custom_split != null
              ? <><span className="text-indigo-400">{Math.round(expense.custom_split * 100)}%</span> custom</>
              : `${splitPercent}%`
            })</span>
          )}
        </div>
      </div>

      {/* Amounts */}
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-gray-100 tabular-nums">{fmt(expense.myShare)}</div>
        {expense.isShared && (
          <div className="text-xs text-gray-600 tabular-nums">of {fmt(expense.amount)}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button type="button" onClick={() => onEdit(expense)}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors">
          Edit
        </button>
        <button type="button" onClick={() => onToggle(expense)}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          title={expense.status === 'paused' ? 'Activate' : 'Pause'}>
          {expense.status === 'paused' ? '▶' : '⏸'}
        </button>
        <button type="button" onClick={() => onDelete(expense)}
          className="px-2 py-1 text-xs text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors">
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Expenses() {
  const [expenses, setExpenses]       = useState<Expense[]>([])
  const [splitPercent, setSplitPercent] = useState(50)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Expense | undefined>(undefined)

  const load = useCallback(() => {
    get<ApiResponse>('/expenses')
      .then(data => { setExpenses(data.expenses); setSplitPercent(data.splitPercent) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openAdd() { setEditing(undefined); setModalOpen(true) }
  function openEdit(e: Expense) { setEditing(e); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(undefined) }

  async function handleSave(form: {
    name: string; amount: string; category: string; isShared: boolean
    customSplitStr: string
    recurrence: string; dueDay: string; dueMonth: string; status: string; notes: string
  }) {
    const customSplitVal = form.customSplitStr && parseFloat(form.customSplitStr) > 0
      ? parseFloat(form.customSplitStr) / 100
      : null
    const payload = {
      name:         form.name,
      amount:       parseFloat(form.amount),
      category:     form.category,
      is_shared:    form.isShared,
      custom_split: customSplitVal,
      recurrence:   form.recurrence,
      due_day:      form.dueDay    ? parseInt(form.dueDay, 10)    : null,
      due_month:    form.dueMonth  ? parseInt(form.dueMonth, 10)  : null,
      status:       form.status,
      notes:        form.notes || null,
    }
    if (editing) {
      await put(`/expenses/${editing.id}`, payload)
    } else {
      await post('/expenses', payload)
    }
    closeModal()
    load()
  }

  async function handleDelete(e: Expense) {
    if (!window.confirm(`Delete "${e.name}"? This cannot be undone.`)) return
    await deleteExpense(e.id)
    load()
  }

  async function handleToggle(e: Expense) {
    const next = e.status === 'paused' ? 'active' : 'paused'
    await patch(`/expenses/${e.id}/status`, { status: next })
    load()
  }

  // ── Grouping ──────────────────────────────────────────────────────────────

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: expenses.filter(e => e.category === cat),
  })).filter(g => g.items.length > 0)

  const totalMyShare = expenses
    .filter(e => e.status === 'active' || e.status === 'upcoming')
    .reduce((s, e) => s + e.myShare, 0)

  const monthlyShare = expenses
    .filter(e => e.recurrence === 'monthly' && (e.status === 'active'))
    .reduce((s, e) => s + e.myShare, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="text-gray-600 text-sm py-8 text-center">Loading…</div>
  if (error)   return <div className="text-red-400 text-sm">{error}</div>

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Expenses</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {expenses.length} entries · monthly {fmt(monthlyShare)} your share · {splitPercent}% split
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
          + Add
        </button>
      </div>

      {/* Summary strip */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Monthly (your share)', value: fmt(monthlyShare) },
            { label: 'All active (your share)', value: fmt(totalMyShare) },
            { label: 'Active entries', value: String(expenses.filter(e => e.status === 'active').length) },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-lg font-bold text-gray-100 tabular-nums mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category groups */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg mb-2">No expenses yet</p>
          <p className="text-sm">Click <strong className="text-gray-500">+ Add</strong> to create your first expense.</p>
        </div>
      ) : (
        grouped.map(({ cat, label, items }) => {
          const groupShare = items
            .filter(e => e.status !== 'paused')
            .reduce((s, e) => s + e.myShare, 0)

          return (
            <section key={cat} className="bg-gray-900 rounded-xl border border-gray-800">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-semibold text-gray-300">{label}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span className="font-medium text-gray-400 tabular-nums">{fmt(groupShare)}/mo</span>
                </div>
              </div>

              {/* Rows */}
              <div className="px-4">
                {items.map(e => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    splitPercent={splitPercent}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </section>
          )
        })
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <ExpenseForm
              initial={editing}
              splitPercent={splitPercent}
              onSave={handleSave}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  )
}
