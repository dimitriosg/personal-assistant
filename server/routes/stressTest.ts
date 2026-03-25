import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeRow   { amount: number; type: string; expected_month: number | null; is_recurring: number }
interface ExpenseRow  { id: number; name: string; amount: number; is_shared: number; recurrence: string; due_day: number | null; due_month: number | null; status: string; custom_split: number | null }
interface TestRow     { id: number; item: string; price: number; category: string; urgency: string; verdict: string; reason: string; date: string }
interface RunResult   { lastInsertRowid: number | bigint }

interface UpcomingExpense { id: number; name: string; amount: number; myShare: number; daysAway: number }
interface BonusFlag       { name: string; amount: number; label: string }

interface FinancialState {
  splitUser:      number
  savingsTarget:  number
  remaining:      number      // income - fixedMyShare - alreadySpent
  upcoming30:     UpcomingExpense[]
  bonusNextMonth: BonusFlag | null
}

interface RuleResult {
  verdict:  'buy' | 'wait' | 'reject'
  rule:     number
  why:      string
  risk:     string
  nextMove: string
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dueMonth: number, dueDay: number | null, now: Date): number {
  const cm = now.getMonth() + 1, cy = now.getFullYear()
  let year = cy
  if (dueMonth < cm) year = cy + 1
  else if (dueMonth === cm && dueDay && dueDay < now.getDate()) year = cy + 1
  const target = new Date(year, dueMonth - 1, dueDay ?? 1)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function eur(n: number) { return `€${n.toFixed(2)}` }

// ── Get live financial state from DB ─────────────────────────────────────────

function getState(): FinancialState {
  const now = new Date()
  const cm  = now.getMonth() + 1
  const cy  = now.getFullYear()
  const monthStr = `${cy}-${String(cm).padStart(2, '0')}`

  const settingsRows = db.prepare('SELECT key,value FROM settings').all() as { key: string; value: string }[]
  const cfg = Object.fromEntries(settingsRows.map(r => [r.key, r.value]))
  const splitUser    = parseFloat(cfg.shared_split_user ?? '0.5')
  const savingsTarget = parseFloat(cfg.savings_target ?? '100')

  // Income this month
  const allIncome = db.prepare('SELECT amount,type,expected_month,is_recurring FROM income').all() as IncomeRow[]
  const incomeTotal = allIncome
    .filter(i => i.is_recurring || Number(i.expected_month) === cm)
    .reduce((s, i) => s + i.amount, 0)

  // Fixed expenses my share this month
  const allExpenses = db.prepare(
    "SELECT * FROM expenses WHERE status NOT IN ('paid','paused')"
  ).all() as ExpenseRow[]

  const fixedMyShare = allExpenses
    .filter(e => e.recurrence === 'monthly' || (e.recurrence !== 'monthly' && Number(e.due_month) === cm))
    .reduce((s, e) => s + (e.is_shared ? e.amount * splitUser : e.amount), 0)

  // Transactions this month
  const txRow = db.prepare(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE date LIKE ?"
  ).get(monthStr + '-%') as { total: number }

  const remaining = +(incomeTotal - fixedMyShare - txRow.total).toFixed(2)

  // Upcoming in 30 days (non-monthly, not current month)
  const upcoming30 = allExpenses
    .filter(e => e.recurrence !== 'monthly' && e.due_month !== null && Number(e.due_month) !== cm)
    .map(e => ({
      id:       e.id,
      name:     e.name,
      amount:   e.amount,
      myShare:  e.is_shared ? +(e.amount * (e.custom_split ?? splitUser)).toFixed(2) : e.amount,
      daysAway: daysUntil(Number(e.due_month), e.due_day, now),
    }))
    .filter(e => e.daysAway >= 1 && e.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway)

  // Bonus next month
  const nextMonth = (cm % 12) + 1
  const bonusRow  = allIncome.find(i => i.type === 'bonus' && Number(i.expected_month) === nextMonth)
  const bonusNextMonth = bonusRow
    ? { name: (db.prepare('SELECT name FROM income WHERE type=? AND expected_month=?').get('bonus', nextMonth) as { name: string }).name, amount: bonusRow.amount, label: MONTHS_SHORT[nextMonth - 1] }
    : null

  return { splitUser, savingsTarget, remaining, upcoming30, bonusNextMonth }
}

// ── Rule engine ───────────────────────────────────────────────────────────────

function runRules(price: number, category: string, urgency: string, st: FinancialState): RuleResult {
  const { remaining, savingsTarget, upcoming30, bonusNextMonth } = st

  // Rule 1 — can't afford
  if (remaining < price) {
    const gap = price - remaining
    return {
      verdict: 'reject', rule: 1,
      why:      `You can't afford this without cutting something. You have ${eur(remaining)} left this month and this costs ${eur(price)}.`,
      risk:     `You'd need to cut ${eur(gap)} from other spending or skip a fixed expense.`,
      nextMove: `Wait until next month. If truly urgent, free up ${eur(gap)} from variable spending first.`,
    }
  }

  // Rule 2 — kills buffer
  const afterPurchase = remaining - price
  if (afterPurchase < savingsTarget) {
    const shortfall = savingsTarget - afterPurchase
    return {
      verdict: 'wait', rule: 2,
      why:      `This kills your buffer. After buying you'd have ${eur(afterPurchase)} left — ${eur(shortfall)} below your ${eur(savingsTarget)} safety target.`,
      risk:     `No cushion for unexpected costs this month.`,
      nextMove: `Cut ${eur(shortfall)} from variable spending first, or wait until next month when income resets.`,
    }
  }

  // Rule 3 — impulse + low urgency
  if (urgency === 'low' && category === 'impulse') {
    return {
      verdict: 'reject', rule: 3,
      why:      `Bad call. Wait. Low-urgency impulse purchases are the #1 source of buyer's remorse.`,
      risk:     `${eur(price)} gone on something you rated as low urgency and impulse.`,
      nextMove: `Come back in 7 days. If you still want it with the same urgency, reassess then.`,
    }
  }

  // Rule 4 — bad timing (upcoming irregular expense within 30 days)
  if (urgency === 'low' && upcoming30.length > 0) {
    const exp = upcoming30[0]
    return {
      verdict: 'wait', rule: 4,
      why:      `Bad timing — ${exp.name} (${eur(exp.myShare)} your share) is due in ${exp.daysAway} day${exp.daysAway !== 1 ? 's' : ''}.`,
      risk:     `You'll need that money soon. Buying now leaves your buffer thin.`,
      nextMove: `Wait until after ${exp.name} is paid. Your position will be clearer then.`,
    }
  }

  // Rule 5 — bonus next month, not a need
  if (bonusNextMonth && category !== 'need') {
    return {
      verdict: 'wait', rule: 5,
      why:      `Wait for your ${bonusNextMonth.name} next month (${eur(bonusNextMonth.amount)}). You'll be in a much better position.`,
      risk:     `Minor — buying now is just ${eur(bonusNextMonth.amount)} less comfortable than waiting one month.`,
      nextMove: `Add it to your wishlist and buy it next month after your ${bonusNextMonth.label} bonus arrives.`,
    }
  }

  // Rule 6 — genuine need, high urgency
  if (category === 'need' && urgency === 'high') {
    return {
      verdict: 'buy', rule: 6,
      why:      `Do it. It's a genuine need with high urgency and you can cover it. Buffer after purchase: ${eur(afterPurchase)}.`,
      risk:     afterPurchase >= savingsTarget
        ? `Low. Buffer stays above target at ${eur(afterPurchase)}.`
        : `Your buffer will drop to ${eur(afterPurchase)}, below your ${eur(savingsTarget)} target.`,
      nextMove: `Buy it. Log the transaction so the dashboard stays accurate.`,
    }
  }

  // Rule 7 — default: opportunity cost
  const pct = Math.round(price / remaining * 100)
  const comfortable = afterPurchase >= savingsTarget * 2
  const cautious    = category === 'impulse' || (category === 'comfort' && urgency === 'low')

  return {
    verdict:  cautious ? 'wait' : 'buy',
    rule:     7,
    why:      `You can afford this. It uses ${pct}% of your remaining budget, leaving ${eur(afterPurchase)} for the rest of the month.`,
    risk:     comfortable
      ? `Low. You stay comfortably above your ${eur(savingsTarget)} target.`
      : `Moderate. Your buffer of ${eur(afterPurchase)} is within range of your ${eur(savingsTarget)} target.`,
    nextMove: cautious
      ? `Think it over for a few days — it's not urgent and you rated it ${category}.`
      : comfortable
        ? `OK to buy. Track the transaction.`
        : `OK to buy but keep an eye on spending for the rest of the month.`,
  }
}

// ── POST /api/stress-test ─────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { item, price, category, urgency } = req.body as Record<string, unknown>

  if (!item || String(item).trim() === '')       return res.status(400).json({ error: 'item is required' })
  if (!price || Number(price) <= 0)              return res.status(400).json({ error: 'price must be > 0' })
  if (!['need','useful','comfort','impulse'].includes(String(category))) return res.status(400).json({ error: 'invalid category' })
  if (!['high','medium','low'].includes(String(urgency)))               return res.status(400).json({ error: 'invalid urgency' })

  const state  = getState()
  const result = runRules(Number(price), String(category), String(urgency), state)

  const reasonJson = JSON.stringify({ rule: result.rule, why: result.why, risk: result.risk, nextMove: result.nextMove })

  const ins = db.prepare(`
    INSERT INTO stress_tests (item, price, category, urgency, verdict, reason, date)
    VALUES (?, ?, ?, ?, ?, ?, date('now'))
  `).run(String(item).trim(), Number(price), category, urgency, result.verdict, reasonJson) as RunResult

  const saved = db.prepare('SELECT * FROM stress_tests WHERE id = ?')
    .get(Number(ins.lastInsertRowid)) as TestRow

  res.status(201).json({
    ...saved,
    ...result,
    context: {
      remaining:             state.remaining,
      savingsTarget:         state.savingsTarget,
      remainingAfterPurchase: +(state.remaining - Number(price)).toFixed(2),
      upcoming30Count:       state.upcoming30.length,
      bonusNextMonth:        state.bonusNextMonth,
    },
  })
})

// ── GET /api/stress-test ──────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT * FROM stress_tests ORDER BY date DESC, id DESC LIMIT 30'
  ).all() as TestRow[]

  const results = rows.map(r => {
    let parsed: { rule?: number; why?: string; risk?: string; nextMove?: string } = {}
    try { parsed = JSON.parse(r.reason) } catch { parsed = { why: r.reason } }
    return { ...r, rule: parsed.rule, why: parsed.why ?? r.reason, risk: parsed.risk, nextMove: parsed.nextMove }
  })

  res.json(results)
})

// ── DELETE /api/stress-test/:id ───────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM stress_tests WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM stress_tests WHERE id = ?').run(id)
  res.json({ ok: true })
})

export default router
