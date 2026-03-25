import { Router } from 'express'
import db from '../db'

const router = Router()

const VALID_CATEGORIES = ['fixed_shared', 'fixed_personal', 'variable_shared', 'variable_personal', 'irregular']
const VALID_RECURRENCES = ['monthly', 'annual', 'one_time', 'specific_month']
const VALID_STATUSES    = ['active', 'paid', 'upcoming', 'paused']

interface ExpenseRow {
  id: number; name: string; amount: number; category: string
  is_shared: number; recurrence: string; due_day: number | null
  due_month: number | null; status: string; notes: string | null
  custom_split: number | null; created_at: string
}

interface RunResult { lastInsertRowid: number | bigint }

function splitUser(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key='shared_split_user'")
    .get() as { value: string } | undefined
  return parseFloat(row?.value ?? '0.5')
}

function shape(e: ExpenseRow, globalSplit: number) {
  const effectiveSplit = e.custom_split ?? globalSplit
  return {
    ...e,
    isShared: Boolean(e.is_shared),
    myShare: e.is_shared ? +(e.amount * effectiveSplit).toFixed(2) : e.amount,
  }
}

function validate(body: Record<string, unknown>): string | null {
  const { name, amount, category, recurrence, status } = body
  if (!name || String(name).trim() === '') return 'name is required'
  if (!amount || Number(amount) <= 0)        return 'amount must be > 0'
  if (!VALID_CATEGORIES.includes(String(category)))  return 'invalid category'
  if (!VALID_RECURRENCES.includes(String(recurrence))) return 'invalid recurrence'
  if (status && !VALID_STATUSES.includes(String(status))) return 'invalid status'
  return null
}

// GET /api/expenses
router.get('/', (_req, res) => {
  const split = splitUser()
  const rows = db.prepare(
    'SELECT * FROM expenses ORDER BY category, recurrence, name'
  ).all() as ExpenseRow[]
  res.json({ splitPercent: Math.round(split * 100), expenses: rows.map(e => shape(e, split)) })
})

// GET /api/expenses/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?')
    .get(Number(req.params.id)) as ExpenseRow | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(shape(row, splitUser()))
})

// POST /api/expenses
router.post('/', (req, res) => {
  const err = validate(req.body as Record<string, unknown>)
  if (err) return res.status(400).json({ error: err })

  const { name, amount, category, is_shared, recurrence, due_day, due_month, status = 'active', notes, custom_split } = req.body as Record<string, unknown>

  const result = db.prepare(`
    INSERT INTO expenses (name, amount, category, is_shared, recurrence, due_day, due_month, status, notes, custom_split)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(), Number(amount), category,
    is_shared ? 1 : 0, recurrence,
    due_day ?? null, due_month ?? null,
    status ?? 'active', notes ? String(notes).trim() : null,
    custom_split != null ? Number(custom_split) : null
  ) as RunResult

  const created = db.prepare('SELECT * FROM expenses WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as ExpenseRow
  res.status(201).json(shape(created, splitUser()))
})

// PUT /api/expenses/:id
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM expenses WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const err = validate(req.body as Record<string, unknown>)
  if (err) return res.status(400).json({ error: err })

  const { name, amount, category, is_shared, recurrence, due_day, due_month, status = 'active', notes, custom_split } = req.body as Record<string, unknown>

  db.prepare(`
    UPDATE expenses
    SET name=?, amount=?, category=?, is_shared=?, recurrence=?,
        due_day=?, due_month=?, status=?, notes=?, custom_split=?
    WHERE id=?
  `).run(
    String(name).trim(), Number(amount), category,
    is_shared ? 1 : 0, recurrence,
    due_day ?? null, due_month ?? null,
    status ?? 'active', notes ? String(notes).trim() : null,
    custom_split != null ? Number(custom_split) : null,
    id
  )

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow
  res.json(shape(updated, splitUser()))
})

// PATCH /api/expenses/:id/status
router.patch('/:id/status', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })

  const { status } = req.body as { status?: string }
  if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })

  db.prepare('UPDATE expenses SET status=? WHERE id=?').run(status, id)
  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow
  res.json(shape(updated, splitUser()))
})

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM expenses WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  res.json({ ok: true })
})

export default router
