import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface TransactionRow {
  id: number
  date: string
  payee: string | null
  category_id: number | null
  memo: string | null
  amount: number
  cleared: number
  created_at: string
}

interface RunResult { lastInsertRowid: number | bigint }

function shape(t: TransactionRow) {
  return {
    ...t,
    cleared: Boolean(t.cleared),
  }
}

// ── GET /api/transactions ─────────────────────────────────────────────────────
// Query params: month (YYYY-MM), category_id, payee, type (inflow/outflow)

router.get('/', (req, res) => {
  const { month, category_id, payee, type } = req.query as Record<string, string | undefined>

  let sql = 'SELECT * FROM transactions WHERE 1=1'
  const params: unknown[] = []

  if (month) {
    sql += ' AND date LIKE ?'
    params.push(month + '-%')
  }
  if (category_id) {
    sql += ' AND category_id = ?'
    params.push(Number(category_id))
  }
  if (payee) {
    sql += ' AND payee LIKE ?'
    params.push('%' + payee + '%')
  }
  if (type === 'inflow') {
    sql += ' AND amount > 0'
  } else if (type === 'outflow') {
    sql += ' AND amount < 0'
  }

  sql += ' ORDER BY date DESC, id DESC'

  const rows = db.prepare(sql).all(...params) as TransactionRow[]

  // Calculate running balance
  let runningBalance = 0
  const withBalance = rows.map(r => {
    runningBalance += r.amount
    return { ...shape(r), runningBalance: +runningBalance.toFixed(2) }
  })

  res.json(withBalance)
})

// ── POST /api/transactions ────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { date, payee, category_id, memo, amount, cleared } =
    req.body as Record<string, unknown>

  if (!date || String(date).trim() === '') {
    return res.status(400).json({ error: 'date is required' })
  }
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: 'amount is required' })
  }
  if (Number(amount) === 0) {
    return res.status(400).json({ error: 'amount must not be 0' })
  }

  // Validate category exists if provided
  if (category_id != null) {
    if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(category_id))) {
      return res.status(400).json({ error: 'category_id does not exist' })
    }
  }

  const result = db.prepare(`
    INSERT INTO transactions (date, payee, category_id, memo, amount, cleared)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(date).trim(),
    payee ? String(payee).trim() : null,
    category_id != null ? Number(category_id) : null,
    memo ? String(memo).trim() : null,
    Number(amount),
    cleared ? 1 : 0
  ) as RunResult

  const created = db.prepare('SELECT * FROM transactions WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as TransactionRow
  res.status(201).json(shape(created))
})

// ── PUT /api/transactions/:id ─────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow | undefined
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { date, payee, category_id, memo, amount, cleared } =
    req.body as Record<string, unknown>

  if (!date || String(date).trim() === '') {
    return res.status(400).json({ error: 'date is required' })
  }
  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: 'amount is required' })
  }

  if (category_id != null) {
    if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(category_id))) {
      return res.status(400).json({ error: 'category_id does not exist' })
    }
  }

  db.prepare(`
    UPDATE transactions
    SET date = ?, payee = ?, category_id = ?, memo = ?, amount = ?, cleared = ?
    WHERE id = ?
  `).run(
    String(date).trim(),
    payee ? String(payee).trim() : null,
    category_id != null ? Number(category_id) : null,
    memo ? String(memo).trim() : null,
    Number(amount),
    cleared ? 1 : 0,
    id
  )

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow
  res.json(shape(updated))
})

// ── DELETE /api/transactions/:id ──────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  res.json({ ok: true })
})

export default router
