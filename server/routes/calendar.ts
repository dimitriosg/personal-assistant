import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeRow   { id: number; name: string; amount: number; type: string; expected_month: number | null; is_recurring: number; due_day: number | null }
interface TargetRow   { category_id: number; target_type: string; target_amount: number; target_date: string | null }
interface CatRow      { id: number; name: string; group_id: number }
interface GroupRow    { id: number; name: string }
interface TxRow       { id: number; date: string; payee: string | null; amount: number; category_id: number | null; memo: string | null }

type EventType = 'income' | 'target' | 'transaction'

interface CalendarEvent {
  day:     number
  type:    EventType
  label:   string
  amount:  number
  color:   string
}

// ── GET /api/calendar/:month ─────────────────────────────────────────────────

router.get('/:month', (req, res) => {
  const month = req.params.month // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM format' })
  }

  const monthNum = parseInt(month.split('-')[1], 10)
  const events: CalendarEvent[] = []

  // Income events (green)
  const incomes = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  for (const inc of incomes) {
    const matches = inc.is_recurring || Number(inc.expected_month) === monthNum
    if (!matches) continue
    const day = inc.due_day ?? 1
    events.push({
      day,
      type: 'income',
      label: inc.name,
      amount: inc.amount,
      color: 'green',
    })
  }

  // Target due dates (blue)
  const targets = db.prepare(`
    SELECT ct.*, c.name AS category_name, g.name AS group_name
    FROM category_targets ct
    JOIN categories c ON c.id = ct.category_id
    JOIN category_groups g ON g.id = c.group_id
    WHERE ct.target_date IS NOT NULL
  `).all() as Array<TargetRow & { category_name: string; group_name: string }>

  for (const t of targets) {
    if (!t.target_date) continue
    const [tYear, tMonth, tDay] = t.target_date.split('-').map(Number)
    const targetMonth = `${tYear}-${String(tMonth).padStart(2, '0')}`
    if (targetMonth !== month) continue
    events.push({
      day: tDay,
      type: 'target',
      label: `${t.category_name} target`,
      amount: t.target_amount,
      color: 'blue',
    })
  }

  // Transactions (red for outflow, green for inflow)
  const txns = db.prepare(
    'SELECT * FROM transactions WHERE date LIKE ? ORDER BY date'
  ).all(month + '-%') as TxRow[]

  // Category names for transactions
  const cats = db.prepare('SELECT id, name FROM categories').all() as CatRow[]
  const catMap = new Map(cats.map(c => [c.id, c.name]))

  for (const tx of txns) {
    const day = parseInt(tx.date.split('-')[2], 10)
    const isInflow = tx.amount > 0
    const catName = tx.category_id ? catMap.get(tx.category_id) ?? '' : ''
    events.push({
      day,
      type: 'transaction',
      label: tx.payee || catName || tx.memo || (isInflow ? 'Inflow' : 'Expense'),
      amount: tx.amount,
      color: isInflow ? 'green' : 'red',
    })
  }

  // Group events by day
  const year = parseInt(month.split('-')[0], 10)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const firstDayOfWeek = new Date(year, monthNum - 1, 1).getDay() // 0=Sun

  res.json({
    month,
    year,
    monthNum,
    daysInMonth,
    firstDayOfWeek,
    events,
  })
})

export default router
