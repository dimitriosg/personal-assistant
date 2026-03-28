import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountRow {
  id: number
  name: string
  type: string
  account_type: string
  balance: number
  currency: string
  is_closed: number
  sort_order: number
  created_at: string
}

interface TransactionRow {
  id: number
  date: string
  payee: string | null
  category_id: number | null
  account_id: number | null
  memo: string | null
  amount: number
  cleared: number
  created_at: string
}

interface RunResult { lastInsertRowid: number | bigint }

function shapeTransaction(t: TransactionRow) {
  return {
    ...t,
    cleared: Boolean(t.cleared),
  }
}

// ── GET /api/accounts ─────────────────────────────────────────────────────────
// Returns all non-closed accounts ordered by sort_order

router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT * FROM accounts WHERE is_closed = 0 ORDER BY sort_order, id'
  ).all() as AccountRow[]
  res.json(rows)
})

// ── POST /api/accounts ────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name, type, account_type, balance, currency } =
    req.body as Record<string, unknown>

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }
  if (type !== 'budget' && type !== 'tracking') {
    return res.status(400).json({ error: "type must be 'budget' or 'tracking'" })
  }
  if (!account_type || String(account_type).trim() === '') {
    return res.status(400).json({ error: 'account_type is required' })
  }

  const result = db.prepare(`
    INSERT INTO accounts (name, type, account_type, balance, currency)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    String(type),
    String(account_type).trim(),
    balance != null ? Number(balance) : 0,
    currency ? String(currency).trim() : 'EUR'
  ) as RunResult

  const created = db.prepare('SELECT * FROM accounts WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as AccountRow
  res.status(201).json(created)
})

// ── PATCH /api/accounts/:id ───────────────────────────────────────────────────
// Updates only provided fields, returns updated Account

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { name, balance, is_closed, sort_order } =
    req.body as Record<string, unknown>

  const updates: string[] = []
  const params: unknown[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(String(name).trim())
  }
  if (balance !== undefined) {
    updates.push('balance = ?')
    params.push(Number(balance))
  }
  if (is_closed !== undefined) {
    updates.push('is_closed = ?')
    params.push(is_closed ? 1 : 0)
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(Number(sort_order))
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }

  params.push(id)
  db.prepare(`UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`).run(...params)

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow
  res.json(updated)
})

// ── DELETE /api/accounts/:id ──────────────────────────────────────────────────
// Soft-delete: sets is_closed = 1, does NOT delete transactions

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM accounts WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('UPDATE accounts SET is_closed = 1 WHERE id = ?').run(id)
  res.json({ success: true })
})

// ── GET /api/accounts/:id/register ───────────────────────────────────────────
// Returns ALL transactions for the account sorted date ASC with running balance.
// running_balance = cumulative sum of amounts up to that row (income adds, expense subtracts).

router.get('/:id/register', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM accounts WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const rows = db.prepare(`
    SELECT t.id, t.date, t.payee, t.amount, t.category_id, t.account_id,
           c.name AS category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.account_id = ?
    ORDER BY t.date ASC, t.id ASC
  `).all(id) as {
    id: number
    date: string
    payee: string | null
    amount: number
    category_id: number | null
    account_id: number | null
    category_name: string | null
  }[]

  let runningBalance = 0
  const result = rows.map(r => {
    runningBalance += r.amount
    return {
      id: r.id,
      date: r.date,
      description: r.payee,
      amount: r.amount,
      type: r.amount >= 0 ? 'income' : 'expense',
      category_id: r.category_id,
      category_name: r.category_name,
      account_id: r.account_id,
      running_balance: +runningBalance.toFixed(2),
    }
  })

  res.json(result)
})

// ── GET /api/accounts/:id/transactions ────────────────────────────────────────
// Returns transactions WHERE account_id = :id
// Supports ?month=YYYY-MM query param

router.get('/:id/transactions', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM accounts WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const { month } = req.query as Record<string, string | undefined>

  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be in YYYY-MM format' })
  }

  let sql = 'SELECT * FROM transactions WHERE account_id = ?'
  const params: unknown[] = [id]

  if (month) {
    sql += ' AND date LIKE ?'
    params.push(month + '-%')
  }

  sql += ' ORDER BY date DESC, id DESC'

  const rows = db.prepare(sql).all(...params) as TransactionRow[]

  // Calculate running balance: accumulate oldest→newest, display newest-first
  const chronological = [...rows].reverse()
  let balance = 0
  const withBalance = chronological.map(r => {
    balance += r.amount
    return { ...shapeTransaction(r), runningBalance: +balance.toFixed(2) }
  })
  withBalance.reverse()

  res.json(withBalance)
})

export default router
