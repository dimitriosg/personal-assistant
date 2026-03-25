import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupRow    { id: number; name: string; sort_order: number }
interface CatRow     { id: number; name: string; group_id: number; sort_order: number }
interface TargetRow  { category_id: number; target_type: string; target_amount: number; target_date: string | null }
interface BudgetRow  { category_id: number; assigned: number }
interface TxSumRow   { category_id: number; activity: number }
interface IncomeRow  { name: string; amount: number; type: string; expected_month: number | null; is_recurring: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAvailable(categoryId: number, month: string, assigned: number, activity: number): number {
  const priorAssigned = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE category_id = ? AND month < ?'
  ).get(categoryId, month) as { total: number }

  const priorActivity = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category_id = ? AND date < ?'
  ).get(categoryId, month + '-01') as { total: number }

  return +(assigned + activity + priorAssigned.total + priorActivity.total).toFixed(2)
}

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

// ── GET /api/prompt?month=YYYY-MM ────────────────────────────────────────────

router.get('/', (req, res) => {
  const now = new Date()
  const month = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM format' })
  }

  const readyToAssign = calculateReadyToAssign(month)

  const groups = db.prepare('SELECT * FROM category_groups ORDER BY sort_order, id').all() as GroupRow[]
  const categories = db.prepare('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order, id').all() as CatRow[]
  const targets = db.prepare('SELECT * FROM category_targets').all() as TargetRow[]
  const targetMap = new Map(targets.map(t => [t.category_id, t]))

  const budgets = db.prepare('SELECT category_id, assigned FROM monthly_budgets WHERE month = ?').all(month) as BudgetRow[]
  const budgetMap = new Map(budgets.map(b => [b.category_id, b.assigned]))

  const txSums = db.prepare(`
    SELECT category_id, COALESCE(SUM(amount), 0) AS activity
    FROM transactions WHERE date LIKE ? AND category_id IS NOT NULL
    GROUP BY category_id
  `).all(month + '-%') as TxSumRow[]
  const activityMap = new Map(txSums.map(t => [t.category_id, t.activity]))

  const overspent: Array<{ name: string; group: string; available: number }> = []
  const unfundedTargets: Array<{ name: string; group: string; target_amount: number; available: number; gap: number }> = []

  const groupsData = groups.map(g => {
    const cats = categories.filter(c => c.group_id === g.id)
    const catsData = cats.map(c => {
      const assigned = budgetMap.get(c.id) ?? 0
      const activity = activityMap.get(c.id) ?? 0
      const available = calculateAvailable(c.id, month, assigned, activity)
      const target = targetMap.get(c.id)

      if (available < 0) {
        overspent.push({ name: c.name, group: g.name, available })
      }
      if (target && available < target.target_amount) {
        unfundedTargets.push({
          name: c.name, group: g.name,
          target_amount: target.target_amount,
          available,
          gap: +(target.target_amount - available).toFixed(2),
        })
      }

      return { name: c.name, assigned: +assigned.toFixed(2), activity: +activity.toFixed(2), available }
    })

    return {
      name: g.name,
      categories: catsData,
      totals: {
        assigned: +catsData.reduce((s, c) => s + c.assigned, 0).toFixed(2),
        activity: +catsData.reduce((s, c) => s + c.activity, 0).toFixed(2),
        available: +catsData.reduce((s, c) => s + c.available, 0).toFixed(2),
      },
    }
  })

  // Income forecast
  const monthNum = parseInt(month.split('-')[1], 10)
  const incomeRows = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  const monthlyBase = incomeRows.filter(i => i.is_recurring).reduce((s, i) => s + i.amount, 0)
  const forecast = [3, 6].map(n => {
    let total = 0
    for (let offset = 1; offset <= n; offset++) {
      const m = ((monthNum - 1 + offset) % 12) + 1
      const extras = incomeRows.filter(i => !i.is_recurring && Number(i.expected_month) === m).reduce((s, i) => s + i.amount, 0)
      total += monthlyBase + extras
    }
    return { months: n, total: +total.toFixed(2) }
  })

  res.json({
    month,
    readyToAssign,
    groups: groupsData,
    overspent,
    unfundedTargets,
    forecast,
  })
})

export default router
