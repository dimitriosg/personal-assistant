import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: number; name: string; sort_order: number; is_collapsed: number
}

interface CategoryRow {
  id: number; name: string; group_id: number
  is_shared: number; custom_split: number | null
  sort_order: number; hidden: number
}

interface TargetRow {
  id: number; category_id: number; target_type: string
  target_amount: number; target_date: string | null; is_recurring: number
}

interface BudgetRow {
  category_id: number; assigned: number
}

interface TxSumRow {
  category_id: number; activity: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSettings(): { splitUser: number; savingsTarget: number } {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    splitUser: parseFloat(cfg.shared_split_user ?? '0.5'),
    savingsTarget: parseFloat(cfg.savings_target ?? '100'),
  }
}

/** Calculate available for a category (with rollover from previous months) */
function calculateAvailable(
  categoryId: number,
  currentMonth: string,
  assigned: number,
  activity: number
): number {
  // Available = assigned + activity + carryover from all prior months
  // Carryover = sum of (assigned + activity) for all prior months for this category
  const priorRow = db.prepare(`
    SELECT COALESCE(SUM(mb.assigned), 0) AS total_assigned
    FROM monthly_budgets mb
    WHERE mb.category_id = ? AND mb.month < ?
  `).get(categoryId, currentMonth) as { total_assigned: number }

  const priorTxRow = db.prepare(`
    SELECT COALESCE(SUM(t.amount), 0) AS total_activity
    FROM transactions t
    WHERE t.category_id = ? AND t.date < ?
  `).get(categoryId, currentMonth + '-01') as { total_activity: number }

  const carryover = priorRow.total_assigned + priorTxRow.total_activity
  return +(assigned + activity + carryover).toFixed(2)
}

// ── GET /api/budget/:month ────────────────────────────────────────────────────
// Returns all groups, categories, with assigned, activity, available for the month

router.get('/:month', (req, res) => {
  const month = req.params.month // format: "2026-03"
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM format' })
  }

  const { splitUser } = getSettings()

  const groups = db.prepare(
    'SELECT * FROM category_groups ORDER BY sort_order, id'
  ).all() as GroupRow[]

  const categories = db.prepare(
    'SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order, id'
  ).all() as CategoryRow[]

  const targets = db.prepare(
    'SELECT * FROM category_targets'
  ).all() as TargetRow[]

  // Monthly budget assignments for this month
  const budgets = db.prepare(
    'SELECT category_id, assigned FROM monthly_budgets WHERE month = ?'
  ).all(month) as BudgetRow[]
  const budgetMap = new Map(budgets.map(b => [b.category_id, b.assigned]))

  // Transaction activity for this month (sum of amounts per category)
  const txSums = db.prepare(`
    SELECT category_id, COALESCE(SUM(amount), 0) AS activity
    FROM transactions
    WHERE date LIKE ? AND category_id IS NOT NULL
    GROUP BY category_id
  `).all(month + '-%') as TxSumRow[]
  const activityMap = new Map(txSums.map(t => [t.category_id, t.activity]))

  // Compute income this month (inflows = positive transactions without category)
  const incomeRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE date LIKE ? AND amount > 0 AND category_id IS NULL
  `).get(month + '-%') as { total: number }

  // Also add from income table (recurring + one-off for this month)
  const monthNum = parseInt(month.split('-')[1], 10)
  const incomeFromTable = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM income
    WHERE is_recurring = 1 OR expected_month = ?
  `).get(monthNum) as { total: number }

  const totalIncome = incomeRow.total + incomeFromTable.total
  const totalAssigned = budgets.reduce((s, b) => s + b.assigned, 0)

  // Ready to Assign = total income - total assigned (across all months up to and including current)
  const allAssignedRow = db.prepare(`
    SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month <= ?
  `).get(month) as { total: number }

  // All income up to this month
  const allIncomeRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions WHERE amount > 0 AND category_id IS NULL AND date <= ?
  `).get(month + '-31') as { total: number }

  // Also consider income table for all months up to current
  const incomeTableTotal = (() => {
    const rows = db.prepare('SELECT * FROM income').all() as Array<{
      amount: number; is_recurring: number; expected_month: number | null
    }>
    let total = 0
    for (let m = 1; m <= monthNum; m++) {
      for (const i of rows) {
        if (i.is_recurring) total += i.amount
        else if (i.expected_month === m) total += i.amount
      }
    }
    return total
  })()

  const readyToAssign = +(allIncomeRow.total + incomeTableTotal - allAssignedRow.total).toFixed(2)

  // Build response
  const groupsData = groups.map(g => {
    const cats = categories.filter(c => c.group_id === g.id)
    const categoryData = cats.map(c => {
      const assigned = budgetMap.get(c.id) ?? 0
      const activity = activityMap.get(c.id) ?? 0
      const available = calculateAvailable(c.id, month, assigned, activity)
      const target = targets.find(t => t.category_id === c.id)

      return {
        id: c.id,
        name: c.name,
        group_id: c.group_id,
        is_shared: Boolean(c.is_shared),
        custom_split: c.custom_split,
        sort_order: c.sort_order,
        assigned: +assigned.toFixed(2),
        activity: +activity.toFixed(2),
        available,
        target: target ? {
          id: target.id,
          target_type: target.target_type,
          target_amount: target.target_amount,
          target_date: target.target_date,
          is_recurring: Boolean(target.is_recurring),
        } : null,
      }
    })

    return {
      id: g.id,
      name: g.name,
      sort_order: g.sort_order,
      is_collapsed: Boolean(g.is_collapsed),
      categories: categoryData,
      totals: {
        assigned: +categoryData.reduce((s, c) => s + c.assigned, 0).toFixed(2),
        activity: +categoryData.reduce((s, c) => s + c.activity, 0).toFixed(2),
        available: +categoryData.reduce((s, c) => s + c.available, 0).toFixed(2),
      },
    }
  })

  res.json({
    month,
    readyToAssign,
    totalAssigned: +totalAssigned.toFixed(2),
    totalIncome: +totalIncome.toFixed(2),
    groups: groupsData,
  })
})

// ── POST /api/budget/assign ───────────────────────────────────────────────────
// Assign (or update) money to a category for a month

router.post('/assign', (req, res) => {
  const { category_id, month, assigned } = req.body as {
    category_id?: number; month?: string; assigned?: number
  }

  if (!category_id) return res.status(400).json({ error: 'category_id is required' })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM format' })
  if (assigned === undefined || assigned === null) return res.status(400).json({ error: 'assigned is required' })
  if (isNaN(Number(assigned))) return res.status(400).json({ error: 'assigned must be a number' })

  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id)) {
    return res.status(404).json({ error: 'Category not found' })
  }

  db.prepare(`
    INSERT INTO monthly_budgets (category_id, month, assigned)
    VALUES (?, ?, ?)
    ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
  `).run(category_id, month, Number(assigned))

  res.json({ ok: true, category_id, month, assigned: Number(assigned) })
})

// ── POST /api/budget/move ─────────────────────────────────────────────────────
// Move money between categories for a given month

router.post('/move', (req, res) => {
  const { from_category_id, to_category_id, month, amount } = req.body as {
    from_category_id?: number; to_category_id?: number; month?: string; amount?: number
  }

  if (!from_category_id) return res.status(400).json({ error: 'from_category_id is required' })
  if (!to_category_id) return res.status(400).json({ error: 'to_category_id is required' })
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM format' })
  if (amount === undefined || amount === null || isNaN(Number(amount)) || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' })

  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(from_category_id)) {
    return res.status(404).json({ error: 'Source category not found' })
  }
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(to_category_id)) {
    return res.status(404).json({ error: 'Destination category not found' })
  }

  db.exec('BEGIN')
  try {
    // Reduce from source
    const fromRow = db.prepare(
      'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
    ).get(from_category_id, month) as { assigned: number } | undefined

    const fromAssigned = (fromRow?.assigned ?? 0) - amount

    db.prepare(`
      INSERT INTO monthly_budgets (category_id, month, assigned)
      VALUES (?, ?, ?)
      ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
    `).run(from_category_id, month, fromAssigned)

    // Add to destination
    const toRow = db.prepare(
      'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
    ).get(to_category_id, month) as { assigned: number } | undefined

    const toAssigned = (toRow?.assigned ?? 0) + amount

    db.prepare(`
      INSERT INTO monthly_budgets (category_id, month, assigned)
      VALUES (?, ?, ?)
      ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
    `).run(to_category_id, month, toAssigned)

    db.exec('COMMIT')
    res.json({ ok: true, from_category_id, to_category_id, amount, month })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

export default router
