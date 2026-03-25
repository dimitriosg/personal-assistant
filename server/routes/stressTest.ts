import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeRow   { amount: number; type: string; expected_month: number | null; is_recurring: number }
interface TestRow     { id: number; item: string; price: number; category: string; urgency: string; verdict: string; reason: string; date: string; category_id: number | null }
interface RunResult   { lastInsertRowid: number | bigint }

interface BonusFlag       { name: string; amount: number; label: string }

interface CategoryInfo {
  id: number; name: string; group_id: number; group_name: string; available: number
}

interface FinancialState {
  readyToAssign:  number
  categoryAvail:  number       // available balance in chosen category
  categoryName:   string
  groupName:      string
  sameGroupTargets: Array<{ name: string; target_amount: number; days_away: number }>
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

function eur(n: number) { return `€${n.toFixed(2)}` }

/** Calculate available for a category (same logic as budget.ts) */
function calculateCategoryAvailable(categoryId: number, month: string): number {
  const budgetRow = db.prepare(
    'SELECT COALESCE(assigned, 0) AS assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
  ).get(categoryId, month) as { assigned: number } | undefined
  const assigned = budgetRow?.assigned ?? 0

  const activityRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS activity FROM transactions WHERE category_id = ? AND date LIKE ?'
  ).get(categoryId, month + '-%') as { activity: number }
  const activity = activityRow.activity

  // Carryover from prior months
  const priorAssigned = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE category_id = ? AND month < ?'
  ).get(categoryId, month) as { total: number }

  const priorActivity = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category_id = ? AND date < ?'
  ).get(categoryId, month + '-01') as { total: number }

  return +(assigned + activity + priorAssigned.total + priorActivity.total).toFixed(2)
}

/** Calculate Ready to Assign for a month (same logic as budget.ts) */
function calculateReadyToAssign(month: string): number {
  const monthNum = parseInt(month.split('-')[1], 10)

  const allAssigned = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month <= ?'
  ).get(month) as { total: number }

  const allTxIncome = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE amount > 0 AND category_id IS NULL AND date <= ?'
  ).get(month + '-31') as { total: number }

  const incomeRows = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  let incomeTableTotal = 0
  for (let m = 1; m <= monthNum; m++) {
    for (const i of incomeRows) {
      if (i.is_recurring) incomeTableTotal += i.amount
      else if (Number(i.expected_month) === m) incomeTableTotal += i.amount
    }
  }

  return +(allTxIncome.total + incomeTableTotal - allAssigned.total).toFixed(2)
}

// ── Get live financial state from DB ─────────────────────────────────────────

function getState(categoryId: number): FinancialState {
  const now = new Date()
  const cm  = now.getMonth() + 1
  const cy  = now.getFullYear()
  const month = `${cy}-${String(cm).padStart(2, '0')}`

  // Category info
  const catRow = db.prepare(`
    SELECT c.id, c.name, c.group_id, g.name as group_name
    FROM categories c JOIN category_groups g ON g.id = c.group_id
    WHERE c.id = ?
  `).get(categoryId) as { id: number; name: string; group_id: number; group_name: string } | undefined

  const categoryName = catRow?.name ?? 'Unknown'
  const groupName    = catRow?.group_name ?? 'Unknown'
  const groupId      = catRow?.group_id

  const categoryAvail = calculateCategoryAvailable(categoryId, month)
  const readyToAssign = calculateReadyToAssign(month)

  // Targets in same group due within 30 days
  const sameGroupTargets: FinancialState['sameGroupTargets'] = []
  if (groupId) {
    const targets = db.prepare(`
      SELECT c.name, ct.target_amount, ct.target_date
      FROM category_targets ct
      JOIN categories c ON c.id = ct.category_id
      WHERE c.group_id = ? AND ct.target_date IS NOT NULL AND c.id != ?
    `).all(groupId, categoryId) as Array<{ name: string; target_amount: number; target_date: string | null }>

    for (const t of targets) {
      if (!t.target_date) continue
      const td = new Date(t.target_date)
      const diff = Math.ceil((td.getTime() - now.getTime()) / 86400000)
      if (diff >= 1 && diff <= 30) {
        sameGroupTargets.push({ name: t.name, target_amount: t.target_amount, days_away: diff })
      }
    }
    sameGroupTargets.sort((a, b) => a.days_away - b.days_away)
  }

  // Bonus next month
  const nextMonth = (cm % 12) + 1
  const allIncome = db.prepare('SELECT amount,type,expected_month,is_recurring,name FROM income').all() as Array<IncomeRow & { name: string }>
  const bonusRow = allIncome.find(i => i.type === 'bonus' && Number(i.expected_month) === nextMonth)
  const bonusNextMonth = bonusRow
    ? { name: bonusRow.name, amount: bonusRow.amount, label: MONTHS_SHORT[nextMonth - 1] }
    : null

  return { readyToAssign, categoryAvail, categoryName, groupName, sameGroupTargets, bonusNextMonth }
}

// ── Rule engine (updated for category-based model) ────────────────────────────

function runRules(price: number, category: string, urgency: string, st: FinancialState): RuleResult {
  const { categoryAvail, categoryName, readyToAssign, sameGroupTargets, bonusNextMonth } = st

  // Rule 1 — category can't cover it
  if (categoryAvail < price) {
    const gap = price - categoryAvail
    // Rule 3 — Ready to Assign can cover the gap
    if (readyToAssign >= gap) {
      return {
        verdict: 'wait', rule: 3,
        why:      `"${categoryName}" only has ${eur(categoryAvail)} available, but you'd need ${eur(price)}. You could assign ${eur(gap)} from Ready to Assign (${eur(readyToAssign)}).`,
        risk:     `Reduces your unassigned pool by ${eur(gap)}.`,
        nextMove: `Assign ${eur(gap)} to "${categoryName}" first, then buy.`,
      }
    }
    // Rule 2 — no other way to cover
    return {
      verdict: 'reject', rule: 1,
      why:      `"${categoryName}" only has ${eur(categoryAvail)} available and this costs ${eur(price)}. Ready to Assign (${eur(readyToAssign)}) can't cover the ${eur(gap)} gap either.`,
      risk:     `You'd overspend this category by ${eur(gap)}.`,
      nextMove: `Wait until next month, or move money from another category first.`,
    }
  }

  const afterPurchase = categoryAvail - price

  // Rule 4 — impulse + low urgency
  if (urgency === 'low' && category === 'impulse') {
    return {
      verdict: 'reject', rule: 4,
      why:      `Bad call. Wait. Low-urgency impulse purchases are the #1 source of buyer's remorse.`,
      risk:     `${eur(price)} gone from "${categoryName}" on something you rated as low urgency and impulse.`,
      nextMove: `Come back in 7 days. If you still want it with the same urgency, reassess then.`,
    }
  }

  // Rule 5 — bad timing (targets due in same group within 30 days)
  if (sameGroupTargets.length > 0 && urgency !== 'high') {
    const t = sameGroupTargets[0]
    return {
      verdict: 'wait', rule: 5,
      why:      `Bad timing — ${t.name} (${eur(t.target_amount)} target) in the same group is due in ${t.days_away} day${t.days_away !== 1 ? 's' : ''}.`,
      risk:     `Spending ${eur(price)} now could leave the group underfunded.`,
      nextMove: `Wait until after ${t.name} is funded. Reassess then.`,
    }
  }

  // Rule 6 — bonus next month, not high urgency
  if (bonusNextMonth && urgency !== 'high') {
    return {
      verdict: 'wait', rule: 6,
      why:      `Wait for your ${bonusNextMonth.name} next month (${eur(bonusNextMonth.amount)}). You'll be in a much better position.`,
      risk:     `Minor — buying now is just ${eur(bonusNextMonth.amount)} less comfortable than waiting one month.`,
      nextMove: `Add it to your wishlist and buy it next month after your ${bonusNextMonth.label} bonus arrives.`,
    }
  }

  // Rule 7 — genuine need, high urgency
  if (category === 'need' && urgency === 'high') {
    return {
      verdict: 'buy', rule: 7,
      why:      `Do it. It's a genuine need with high urgency and "${categoryName}" can cover it. Remaining after: ${eur(afterPurchase)}.`,
      risk:     afterPurchase > 0
        ? `Low. "${categoryName}" still has ${eur(afterPurchase)} after the purchase.`
        : `Category will be fully spent. No room for other expenses in "${categoryName}".`,
      nextMove: `Buy it. Log the transaction so the budget stays accurate.`,
    }
  }

  // Default — opportunity cost analysis
  const pct = categoryAvail > 0 ? Math.round(price / categoryAvail * 100) : 100
  const cautious = category === 'impulse' || (category === 'comfort' && urgency === 'low')

  return {
    verdict:  cautious ? 'wait' : 'buy',
    rule:     cautious ? 4 : 7,
    why:      `"${categoryName}" has ${eur(categoryAvail)} available. This uses ${pct}% of it, leaving ${eur(afterPurchase)}.`,
    risk:     afterPurchase > price
      ? `Low. Plenty of room left in "${categoryName}".`
      : `Moderate. "${categoryName}" will be tight for the rest of the month.`,
    nextMove: cautious
      ? `Think it over for a few days — it's not urgent and you rated it ${category}.`
      : afterPurchase > price
        ? `OK to buy. Track the transaction.`
        : `OK to buy but keep an eye on "${categoryName}" for the rest of the month.`,
  }
}

// ── POST /api/stress-test ─────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { item, price, category, urgency, category_id } = req.body as Record<string, unknown>

  if (!item || String(item).trim() === '')       return res.status(400).json({ error: 'item is required' })
  if (!price || Number(price) <= 0)              return res.status(400).json({ error: 'price must be > 0' })
  if (!['need','useful','comfort','impulse'].includes(String(category))) return res.status(400).json({ error: 'invalid category' })
  if (!['high','medium','low'].includes(String(urgency)))               return res.status(400).json({ error: 'invalid urgency' })
  if (!category_id || !Number.isInteger(Number(category_id)))           return res.status(400).json({ error: 'category_id is required' })

  const catId = Number(category_id)
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(catId)) {
    return res.status(404).json({ error: 'Budget category not found' })
  }

  const state  = getState(catId)
  const result = runRules(Number(price), String(category), String(urgency), state)

  const reasonJson = JSON.stringify({ rule: result.rule, why: result.why, risk: result.risk, nextMove: result.nextMove })

  const ins = db.prepare(`
    INSERT INTO stress_tests (item, price, category, urgency, verdict, reason, date, category_id)
    VALUES (?, ?, ?, ?, ?, ?, date('now'), ?)
  `).run(String(item).trim(), Number(price), category, urgency, result.verdict, reasonJson, catId) as RunResult

  const saved = db.prepare('SELECT * FROM stress_tests WHERE id = ?')
    .get(Number(ins.lastInsertRowid)) as TestRow

  res.status(201).json({
    ...saved,
    ...result,
    context: {
      categoryAvailable:     state.categoryAvail,
      categoryName:          state.categoryName,
      readyToAssign:         state.readyToAssign,
      afterPurchase:         +(state.categoryAvail - Number(price)).toFixed(2),
      sameGroupTargets:      state.sameGroupTargets.length,
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
    let budgetCategoryName: string | null = null
    if (r.category_id) {
      const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(r.category_id) as { name: string } | undefined
      budgetCategoryName = cat?.name ?? null
    }
    return { ...r, rule: parsed.rule, why: parsed.why ?? r.reason, risk: parsed.risk, nextMove: parsed.nextMove, budgetCategoryName }
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
