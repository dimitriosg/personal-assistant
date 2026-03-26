import { useEffect, useState, useCallback, useMemo } from 'react'
import { get, post, put, del } from '../../lib/api'
import type { Transaction, CategoryGroup, SortField, SortDir, Filters } from './types'
import TransactionForm, { type TransactionPayload } from './TransactionForm'
import CategoryPicker from './CategoryPicker'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// Build a lookup: categoryId → "Group: Category"
function buildCategoryLabel(groups: CategoryGroup[]): Record<number, string> {
  const map: Record<number, string> = {}
  for (const g of groups) {
    for (const c of g.categories) {
      map[c.id] = `${g.name}: ${c.name}`
    }
  }
  return map
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [payees, setPayees] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filters, setFilters] = useState<Filters>({
    month: currentMonth(),
    category_id: '',
    payee: '',
    type: '',
    search: '',
  })

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Modal
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  // Inline editing
  const [inlineEditId, setInlineEditId] = useState<number | null>(null)
  const [inlineField, setInlineField] = useState<string | null>(null)
  const [inlineValue, setInlineValue] = useState('')

  const categoryLabel = useMemo(() => buildCategoryLabel(groups), [groups])

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.month) params.set('month', filters.month)
      if (filters.category_id) params.set('category_id', filters.category_id)
      if (filters.payee) params.set('payee', filters.payee)
      if (filters.type) params.set('type', filters.type)

      const qs = params.toString()
      const data = await get<Transaction[]>(`/transactions${qs ? '?' + qs : ''}`)
      setTransactions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    }
  }, [filters.month, filters.category_id, filters.payee, filters.type])

  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      try {
        const [cats, pays] = await Promise.all([
          get<CategoryGroup[]>('/categories'),
          get<string[]>('/transactions/payees'),
        ])
        setGroups(cats)
        setPayees(pays)
      } catch {
        // Categories/payees are nice-to-have; failure doesn't block page load
      }
      await fetchTransactions()
      setLoading(false)
    }
    loadAll()
  }, [fetchTransactions])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // ── Sorting logic ──────────────────────────────────────────────────────

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'date' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const copy = [...transactions]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date':
          cmp = a.date.localeCompare(b.date) || a.id - b.id
          break
        case 'payee':
          cmp = (a.payee ?? '').localeCompare(b.payee ?? '')
          break
        case 'category':
          cmp = (categoryLabel[a.category_id ?? 0] ?? '').localeCompare(
            categoryLabel[b.category_id ?? 0] ?? ''
          )
          break
        case 'memo':
          cmp = (a.memo ?? '').localeCompare(b.memo ?? '')
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
        case 'runningBalance':
          cmp = a.runningBalance - b.runningBalance
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [transactions, sortField, sortDir, categoryLabel])

  // ── Client-side search (on top of server filters) ──────────────────────

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return sorted
    const q = filters.search.toLowerCase()
    return sorted.filter(t =>
      (t.payee ?? '').toLowerCase().includes(q) ||
      (t.memo ?? '').toLowerCase().includes(q) ||
      (categoryLabel[t.category_id ?? 0] ?? '').toLowerCase().includes(q) ||
      t.date.includes(q)
    )
  }, [sorted, filters.search, categoryLabel])

  // ── CRUD handlers ──────────────────────────────────────────────────────

  async function handleSave(data: TransactionPayload) {
    if (editingTx) {
      await put(`/transactions/${editingTx.id}`, data)
    } else {
      await post('/transactions', data)
    }
    setShowForm(false)
    setEditingTx(null)
    await fetchTransactions()
    // Refresh payees
    try { setPayees(await get<string[]>('/transactions/payees')) } catch { /* payee refresh is best-effort */ }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return
    try {
      await del(`/transactions/${id}`)
      await fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  function openEdit(tx: Transaction) {
    setEditingTx(tx)
    setShowForm(true)
  }

  function openAdd() {
    setEditingTx(null)
    setShowForm(true)
  }

  // ── Inline editing ─────────────────────────────────────────────────────

  function startInlineEdit(tx: Transaction, field: string) {
    setInlineEditId(tx.id)
    setInlineField(field)
    if (field === 'category_id') {
      setInlineValue(tx.category_id != null ? String(tx.category_id) : '')
    } else if (field === 'payee') {
      setInlineValue(tx.payee ?? '')
    } else if (field === 'memo') {
      setInlineValue(tx.memo ?? '')
    }
  }

  async function commitInlineEdit(tx: Transaction) {
    if (inlineField === null || inlineEditId !== tx.id) return

    const updated: Record<string, unknown> = {
      date: tx.date,
      payee: tx.payee,
      category_id: tx.category_id,
      memo: tx.memo,
      amount: tx.amount,
      cleared: tx.cleared,
    }

    if (inlineField === 'payee') updated.payee = inlineValue.trim() || null
    else if (inlineField === 'memo') updated.memo = inlineValue.trim() || null
    else if (inlineField === 'category_id') updated.category_id = inlineValue ? Number(inlineValue) : null

    try {
      await put(`/transactions/${tx.id}`, updated)
      await fetchTransactions()
      if (inlineField === 'payee') {
        try { setPayees(await get<string[]>('/transactions/payees')) } catch { /* payee refresh is best-effort */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inline edit failed')
    }

    setInlineEditId(null)
    setInlineField(null)
    setInlineValue('')
  }

  function cancelInlineEdit() {
    setInlineEditId(null)
    setInlineField(null)
    setInlineValue('')
  }

  // ── Filter helpers ─────────────────────────────────────────────────────

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  // ── Sort indicator ─────────────────────────────────────────────────────

  function sortIcon(field: SortField) {
    if (field !== sortField) return <span className="text-gray-700 ml-1">↕</span>
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 text-sm">Loading transactions…</div>
      </div>
    )
  }

  if (error && transactions.length === 0) {
    return (
      <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
        <p className="text-red-400 text-sm font-medium">Failed to load transactions</p>
        <p className="text-red-600 text-xs mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">Transactions</h1>
        <button
          onClick={openAdd}
          className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500
            text-white rounded-lg transition-colors"
        >
          + Add Transaction
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Month */}
        <input
          type="month"
          value={filters.month}
          onChange={e => setFilter('month', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
            text-sm text-gray-200 outline-none focus:border-indigo-500 [color-scheme:dark]"
        />

        {/* Category */}
        <select
          value={filters.category_id}
          onChange={e => setFilter('category_id', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
            text-sm text-gray-200 outline-none focus:border-indigo-500"
        >
          <option value="">All categories</option>
          {groups.map(g => (
            <optgroup key={g.id} label={g.name}>
              {g.categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Type */}
        <select
          value={filters.type}
          onChange={e => setFilter('type', e.target.value as Filters['type'])}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
            text-sm text-gray-200 outline-none focus:border-indigo-500"
        >
          <option value="">All types</option>
          <option value="outflow">Outflow</option>
          <option value="inflow">Inflow</option>
        </select>

        {/* Search */}
        <input
          type="text"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          placeholder="Search…"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5
            text-sm text-gray-200 outline-none focus:border-indigo-500 flex-1 min-w-[180px]"
        />

        {/* Clear all month filter to see all */}
        {filters.month && (
          <button
            onClick={() => setFilter('month', '')}
            className="text-xs text-gray-500 hover:text-gray-300 px-2"
          >
            Show all months
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* ── Transaction cards (mobile) ──────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">No transactions found.</div>
        ) : (
          filtered.map(tx => (
            <div
              key={tx.id}
              className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {tx.payee || <span className="text-gray-600 italic">No payee</span>}
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(tx.date)}</div>
                </div>
                <div className="text-right shrink-0">
                  {tx.amount < 0 ? (
                    <span className="text-sm font-medium text-red-400 tabular-nums">
                      {fmt(Math.abs(tx.amount))}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-green-400 tabular-nums">
                      +{fmt(tx.amount)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {tx.category_id ? (
                    <CategoryBadge label={categoryLabel[tx.category_id]} />
                  ) : (
                    <span className="text-xs text-gray-600 italic">Uncategorized</span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(tx)}
                    className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                  >
                    ✎ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {tx.memo && (
                <div className="text-xs text-gray-500 truncate">{tx.memo}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Transaction table (desktop) ──────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/60 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <Th field="date" current={sortField} dir={sortDir} onSort={handleSort}>Date</Th>
              <Th field="payee" current={sortField} dir={sortDir} onSort={handleSort}>Payee</Th>
              <Th field="category" current={sortField} dir={sortDir} onSort={handleSort}>Category</Th>
              <Th field="memo" current={sortField} dir={sortDir} onSort={handleSort}>Memo</Th>
              <ThR field="amount" current={sortField} dir={sortDir} onSort={handleSort} label="Outflow" />
              <ThR field="amount" current={sortField} dir={sortDir} onSort={handleSort} label="Inflow" />
              <ThR field="runningBalance" current={sortField} dir={sortDir} onSort={handleSort} label="Balance" />
              <th className="px-2 py-2 text-right w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-600 text-sm">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filtered.map(tx => (
                <tr
                  key={tx.id}
                  className="border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group"
                >
                  {/* Date */}
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>

                  {/* Payee (inline editable) */}
                  <td
                    className="px-3 py-2 text-gray-200 max-w-[200px] truncate cursor-pointer"
                    onClick={() => startInlineEdit(tx, 'payee')}
                  >
                    {inlineEditId === tx.id && inlineField === 'payee' ? (
                      <input
                        autoFocus
                        type="text"
                        value={inlineValue}
                        onChange={e => setInlineValue(e.target.value)}
                        onBlur={() => commitInlineEdit(tx)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitInlineEdit(tx)
                          if (e.key === 'Escape') cancelInlineEdit()
                        }}
                        className="w-full bg-gray-800 border border-indigo-500 rounded px-2 py-0.5
                          text-sm text-gray-200 outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      tx.payee || <span className="text-gray-600 italic">—</span>
                    )}
                  </td>

                  {/* Category (inline editable with picker) */}
                  <td
                    className="px-3 py-2 max-w-[240px] truncate cursor-pointer"
                    onClick={() => startInlineEdit(tx, 'category_id')}
                  >
                    {inlineEditId === tx.id && inlineField === 'category_id' ? (
                      <select
                        autoFocus
                        value={inlineValue}
                        onChange={e => { setInlineValue(e.target.value) }}
                        onBlur={() => commitInlineEdit(tx)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelInlineEdit()
                        }}
                        className="w-full bg-gray-800 border border-indigo-500 rounded px-2 py-0.5
                          text-sm text-gray-200 outline-none"
                        onClick={e => e.stopPropagation()}
                      >
                        <option value="">Uncategorized</option>
                        {groups.map(g => (
                          <optgroup key={g.id} label={g.name}>
                            {g.categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : tx.category_id ? (
                      <CategoryBadge label={categoryLabel[tx.category_id]} />
                    ) : (
                      <span className="text-gray-600 italic">Uncategorized</span>
                    )}
                  </td>

                  {/* Memo (inline editable) */}
                  <td
                    className="px-3 py-2 text-gray-400 max-w-[180px] truncate cursor-pointer"
                    onClick={() => startInlineEdit(tx, 'memo')}
                  >
                    {inlineEditId === tx.id && inlineField === 'memo' ? (
                      <input
                        autoFocus
                        type="text"
                        value={inlineValue}
                        onChange={e => setInlineValue(e.target.value)}
                        onBlur={() => commitInlineEdit(tx)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitInlineEdit(tx)
                          if (e.key === 'Escape') cancelInlineEdit()
                        }}
                        className="w-full bg-gray-800 border border-indigo-500 rounded px-2 py-0.5
                          text-sm text-gray-200 outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      tx.memo || <span className="text-gray-600 italic">—</span>
                    )}
                  </td>

                  {/* Outflow */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {tx.amount < 0 ? (
                      <span className="text-red-400">{fmt(Math.abs(tx.amount))}</span>
                    ) : null}
                  </td>

                  {/* Inflow */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {tx.amount > 0 ? (
                      <span className="text-green-400">{fmt(tx.amount)}</span>
                    ) : null}
                  </td>

                  {/* Running balance */}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className={tx.runningBalance < 0 ? 'text-red-400' : 'text-gray-300'}>
                      {fmt(tx.runningBalance)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2 text-right">
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end transition-opacity">
                      <button
                        onClick={() => openEdit(tx)}
                        className="text-xs text-gray-500 hover:text-indigo-400 transition-colors px-1"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      {filtered.length > 0 && (
        <div className="flex justify-between items-center mt-3 text-xs text-gray-500 px-1">
          <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
          <span>
            Total: {fmt(filtered.reduce((s, t) => s + t.amount, 0))}
          </span>
        </div>
      )}

      {/* ── Transaction form modal ───────────────────────────────────────── */}
      {showForm && (
        <TransactionForm
          transaction={editingTx}
          groups={groups}
          payees={payees}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTx(null) }}
        />
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Th({
  field, current, dir, onSort, children,
}: {
  field: SortField; current: SortField; dir: SortDir
  onSort: (f: SortField) => void; children: React.ReactNode
}) {
  return (
    <th
      className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:text-gray-300 transition-colors"
      onClick={() => onSort(field)}
    >
      {children}
      {field === current && <span className="text-indigo-400 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
      {field !== current && <span className="text-gray-700 ml-1">↕</span>}
    </th>
  )
}

function ThR({
  field, current, dir, onSort, label,
}: {
  field: SortField; current: SortField; dir: SortDir
  onSort: (f: SortField) => void; label: string
}) {
  return (
    <th
      className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:text-gray-300 transition-colors"
      onClick={() => onSort(field)}
    >
      {label}
      {field === current && <span className="text-indigo-400 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
      {field !== current && <span className="text-gray-700 ml-1">↕</span>}
    </th>
  )
}

function CategoryBadge({ label }: { label?: string }) {
  if (!label) return <span className="text-gray-600 italic">Uncategorized</span>
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium
      bg-indigo-600/15 text-indigo-300 border border-indigo-600/20 truncate max-w-full">
      {label}
    </span>
  )
}
