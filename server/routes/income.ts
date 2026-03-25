import { Router } from 'express'
import db from '../db'

const router = Router()

const VALID_TYPES = ['salary', 'bonus', 'one-off']

interface IncomeRow {
  id: number; name: string; amount: number; type: string
  expected_month: number | null; is_recurring: number
  due_day: number | null; notes: string | null; created_at: string
}

interface RunResult { lastInsertRowid: number | bigint }

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function shape(r: IncomeRow) {
  return { ...r, isRecurring: Boolean(r.is_recurring) }
}

function validate(body: Record<string, unknown>): string | null {
  const { name, amount, type } = body
  if (!name || String(name).trim() === '') return 'name is required'
  if (!amount || Number(amount) <= 0)        return 'amount must be > 0'
  if (!VALID_TYPES.includes(String(type)))   return 'type must be salary, bonus, or one-off'
  return null
}

// ── Forecast: cumulative totals for next 3/6/9/12 months ─────────────────────

function buildForecast(all: IncomeRow[], currentMonth: number) {
  const baseMonthly = all.filter(i => i.is_recurring).reduce((s, i) => s + i.amount, 0)

  return [3, 6, 9, 12].map(n => {
    let total = 0
    const bonusMonths: Array<{ month: number; label: string; amount: number }> = []

    for (let offset = 1; offset <= n; offset++) {
      const month = ((currentMonth - 1 + offset) % 12) + 1
      const extras = all
        .filter(i => !i.is_recurring && i.expected_month === month)
        .reduce((s, i) => s + i.amount, 0)
      total += baseMonthly + extras

      const bonuses = all.filter(i => i.type === 'bonus' && i.expected_month === month)
      for (const b of bonuses) {
        if (!bonusMonths.some(bm => bm.month === month && bm.amount === b.amount)) {
          bonusMonths.push({ month, label: MONTHS_SHORT[month - 1], amount: b.amount })
        }
      }
    }

    return { months: n, total: +total.toFixed(2), bonusMonths }
  })
}

// ── Find next upcoming bonus (within 12 months) ───────────────────────────────

function findNextBonus(all: IncomeRow[], currentMonth: number) {
  for (let offset = 1; offset <= 12; offset++) {
    const month = ((currentMonth - 1 + offset) % 12) + 1
    const bonus = all.find(i => i.type === 'bonus' && i.expected_month === month)
    if (bonus) {
      return { month, label: MONTHS_SHORT[month - 1], name: bonus.name, amount: bonus.amount, monthsAway: offset }
    }
  }
  return null
}

// ── GET /api/income ───────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const all = db.prepare('SELECT * FROM income ORDER BY type, name').all() as IncomeRow[]
  const cm  = new Date().getMonth() + 1

  const monthlyBase = all.filter(i => i.is_recurring).reduce((s, i) => s + i.amount, 0)
  const annualExtras = all.filter(i => !i.is_recurring).reduce((s, i) => s + i.amount, 0)

  res.json({
    income:     all.map(shape),
    summary:    { monthlyBase: +monthlyBase.toFixed(2), annualExtras: +annualExtras.toFixed(2) },
    forecast:   buildForecast(all, cm),
    nextBonus:  findNextBonus(all, cm),
  })
})

// ── GET /api/income/:id ───────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM income WHERE id = ?')
    .get(Number(req.params.id)) as IncomeRow | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(shape(row))
})

// ── POST /api/income ──────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const err = validate(req.body as Record<string, unknown>)
  if (err) return res.status(400).json({ error: err })

  const { name, amount, type, is_recurring, expected_month, due_day, notes } =
    req.body as Record<string, unknown>

  // salary is always recurring; bonus never is
  const recurring = type === 'salary' ? 1 : type === 'bonus' ? 0 : (is_recurring ? 1 : 0)

  const result = db.prepare(`
    INSERT INTO income (name, amount, type, expected_month, is_recurring, due_day, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(), Number(amount), type,
    expected_month ?? null, recurring,
    due_day ?? null, notes ? String(notes).trim() : null
  ) as RunResult

  const created = db.prepare('SELECT * FROM income WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as IncomeRow
  res.status(201).json(shape(created))
})

// ── PUT /api/income/:id ───────────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM income WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const err = validate(req.body as Record<string, unknown>)
  if (err) return res.status(400).json({ error: err })

  const { name, amount, type, is_recurring, expected_month, due_day, notes } =
    req.body as Record<string, unknown>

  const recurring = type === 'salary' ? 1 : type === 'bonus' ? 0 : (is_recurring ? 1 : 0)

  db.prepare(`
    UPDATE income
    SET name=?, amount=?, type=?, expected_month=?, is_recurring=?, due_day=?, notes=?
    WHERE id=?
  `).run(
    String(name).trim(), Number(amount), type,
    expected_month ?? null, recurring,
    due_day ?? null, notes ? String(notes).trim() : null,
    id
  )

  const updated = db.prepare('SELECT * FROM income WHERE id = ?').get(id) as IncomeRow
  res.json(shape(updated))
})

// ── DELETE /api/income/:id ────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM income WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM income WHERE id = ?').run(id)
  res.json({ ok: true })
})

export default router
