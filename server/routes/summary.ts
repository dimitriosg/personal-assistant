import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeRow {
  amount: number; type: string; expected_month: number | null; is_recurring: number
}

// ── GET /api/summary/:month ───────────────────────────────────────────────────
// Monthly summary data for the right sidebar

router.get('/:month', (req, res) => {
  const month = req.params.month // "2026-03"
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM format' })
  }

  const monthNum = parseInt(month.split('-')[1], 10)
  const yearNum = parseInt(month.split('-')[0], 10)

  // Previous month
  const prevMonth = monthNum === 1
    ? `${yearNum - 1}-12`
    : `${yearNum}-${String(monthNum - 1).padStart(2, '0')}`

  // ── Assigned in this month
  const assignedRow = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month = ?'
  ).get(month) as { total: number }
  const assignedThisMonth = assignedRow.total

  // ── Activity this month (sum of all transaction amounts)
  const activityRow = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE date LIKE ?"
  ).get(month + '-%') as { total: number }
  const activityThisMonth = activityRow.total

  // ── Left over from last month (sum of available balances carried forward)
  // = all assigned + all activity for months < current month
  const priorAssignedRow = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month < ?'
  ).get(month) as { total: number }
  const priorActivityRow = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE date < ?"
  ).get(month + '-01') as { total: number }
  const leftOverFromLastMonth = +(priorAssignedRow.total + priorActivityRow.total).toFixed(2)

  // ── Targets this month
  const targetsRow = db.prepare(
    'SELECT COALESCE(SUM(target_amount), 0) AS total FROM category_targets WHERE target_type = ? OR is_recurring = 1'
  ).get('monthly') as { total: number }
  const targetsThisMonth = targetsRow.total

  // ── Expected income this month (from income table)
  const allIncome = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  const expectedIncome = allIncome
    .filter(i => i.is_recurring || i.expected_month === monthNum)
    .reduce((s, i) => s + i.amount, 0)

  // ── Underfunded (total targets - total assigned for this month)
  const underfunded = Math.max(0, targetsThisMonth - assignedThisMonth)

  // ── Last month stats
  const lastMonthAssignedRow = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month = ?'
  ).get(prevMonth) as { total: number }
  const assignedLastMonth = lastMonthAssignedRow.total

  const lastMonthActivityRow = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE date LIKE ?"
  ).get(prevMonth + '-%') as { total: number }
  const spentLastMonth = lastMonthActivityRow.total

  // ── Average assigned/spent (all months with data)
  const allMonthsAssigned = db.prepare(`
    SELECT month, SUM(assigned) AS total
    FROM monthly_budgets
    GROUP BY month
    ORDER BY month
  `).all() as Array<{ month: string; total: number }>

  const avgAssigned = allMonthsAssigned.length > 0
    ? allMonthsAssigned.reduce((s, m) => s + m.total, 0) / allMonthsAssigned.length
    : 0

  const allMonthsSpent = db.prepare(`
    SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
    FROM transactions
    WHERE amount < 0
    GROUP BY month
    ORDER BY month
  `).all() as Array<{ month: string; total: number }>

  const avgSpent = allMonthsSpent.length > 0
    ? allMonthsSpent.reduce((s, m) => s + Math.abs(m.total), 0) / allMonthsSpent.length
    : 0

  // ── Ready to Assign (available balance)
  // All income (table) up to this month + all inflow transactions - all assigned
  const incomeTableTotal = (() => {
    let total = 0
    for (let m = 1; m <= monthNum; m++) {
      for (const i of allIncome) {
        if (i.is_recurring) total += i.amount
        else if (i.expected_month === m) total += i.amount
      }
    }
    return total
  })()

  const allInflowRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions WHERE amount > 0 AND category_id IS NULL AND date <= ?
  `).get(month + '-31') as { total: number }

  const allAssignedRow = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month <= ?'
  ).get(month) as { total: number }

  const readyToAssign = +(allInflowRow.total + incomeTableTotal - allAssignedRow.total).toFixed(2)

  res.json({
    month,
    leftOverFromLastMonth: +leftOverFromLastMonth.toFixed(2),
    assignedThisMonth: +assignedThisMonth.toFixed(2),
    activityThisMonth: +activityThisMonth.toFixed(2),
    available: +readyToAssign.toFixed(2),
    targetsThisMonth: +targetsThisMonth.toFixed(2),
    expectedIncome: +expectedIncome.toFixed(2),
    underfunded: +underfunded.toFixed(2),
    assignedLastMonth: +assignedLastMonth.toFixed(2),
    spentLastMonth: +Math.abs(spentLastMonth).toFixed(2),
    averageAssigned: +avgAssigned.toFixed(2),
    averageSpent: +avgSpent.toFixed(2),
  })
})

export default router
