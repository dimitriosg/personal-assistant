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

// ── GET /api/budget/moves?month=YYYY-MM ──────────────────────────────────────
// Returns last 20 moves for the month, newest first, with category names.
// NOTE: Must be registered BEFORE /:month to avoid being caught by the param route.

router.get('/moves', (req, res) => {
  const month = req.query.month as string | undefined
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month query param must be YYYY-MM format' })
  }

  const rows = db.prepare(`
    SELECT
      bm.id,
      bm.from_category_id,
      bm.to_category_id,
      bm.amount,
      bm.moved_at,
      bm.undone,
      fc.name AS from_name,
      tc.name AS to_name
    FROM budget_moves bm
    LEFT JOIN categories fc ON fc.id = bm.from_category_id
    LEFT JOIN categories tc ON tc.id = bm.to_category_id
    WHERE bm.month = ?
    ORDER BY bm.moved_at DESC, bm.id DESC
    LIMIT 20
  `).all(month) as Array<{
    id: number; from_category_id: number | null; to_category_id: number | null
    amount: number; moved_at: string; undone: number
    from_name: string | null; to_name: string | null
  }>

  const moves = rows.map(r => ({
    id: r.id,
    from: r.from_name ?? 'Ready to Assign',
    to: r.to_name ?? 'Ready to Assign',
    fromCategoryId: r.from_category_id,
    toCategoryId: r.to_category_id,
    amount: r.amount,
    moved_at: r.moved_at,
    undone: r.undone,
  }))

  res.json(moves)
})

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

  // Ready to Assign = budget account balances - total assigned THIS month
  // Only budget accounts (not tracking) count toward the budget
  const budgetAccountsRow = db.prepare(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE type = 'budget' AND is_closed = 0"
  ).get() as { total: number }

  const assignedThisMonthRow = db.prepare(
    'SELECT COALESCE(SUM(assigned), 0) AS total FROM monthly_budgets WHERE month = ?'
  ).get(month) as { total: number }

  const readyToAssign = +(budgetAccountsRow.total - assignedThisMonthRow.total).toFixed(2)

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
// Move money between categories (or Ready to Assign) for a given month.
// Inserts a row into budget_moves and returns resolved category names.

router.post('/move', (req, res) => {
  const { month, fromCategoryId, toCategoryId, amount } = req.body as {
    month?: string; fromCategoryId?: number | null; toCategoryId?: number | null; amount?: number
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM format' })
  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be > 0' })
  if (fromCategoryId == null && toCategoryId == null) return res.status(400).json({ error: 'fromCategoryId or toCategoryId is required' })

  const amt = Number(amount)

  // Validate categories exist (when not null = Ready to Assign)
  let fromName = 'Ready to Assign'
  let toName = 'Ready to Assign'

  if (fromCategoryId != null) {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(fromCategoryId) as { name: string } | undefined
    if (!cat) return res.status(404).json({ error: 'Source category not found' })
    fromName = cat.name
  }
  if (toCategoryId != null) {
    const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(toCategoryId) as { name: string } | undefined
    if (!cat) return res.status(404).json({ error: 'Destination category not found' })
    toName = cat.name
  }

  db.exec('BEGIN')
  try {
    // Reduce from source category (skip if null = Ready to Assign)
    if (fromCategoryId != null) {
      const fromRow = db.prepare(
        'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
      ).get(fromCategoryId, month) as { assigned: number } | undefined

      const fromAssigned = (fromRow?.assigned ?? 0) - amt

      db.prepare(`
        INSERT INTO monthly_budgets (category_id, month, assigned)
        VALUES (?, ?, ?)
        ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
      `).run(fromCategoryId, month, fromAssigned)
    }

    // Add to destination category (skip if null = Ready to Assign)
    if (toCategoryId != null) {
      const toRow = db.prepare(
        'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
      ).get(toCategoryId, month) as { assigned: number } | undefined

      const toAssigned = (toRow?.assigned ?? 0) + amt

      db.prepare(`
        INSERT INTO monthly_budgets (category_id, month, assigned)
        VALUES (?, ?, ?)
        ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
      `).run(toCategoryId, month, toAssigned)
    }

    // Insert into budget_moves log
    const result = db.prepare(`
      INSERT INTO budget_moves (month, from_category_id, to_category_id, amount)
      VALUES (?, ?, ?, ?)
    `).run(month, fromCategoryId ?? null, toCategoryId ?? null, amt)

    const moveId = Number(result.lastInsertRowid)

    db.exec('COMMIT')
    res.json({ id: moveId, from: fromName, to: toName, amount: amt })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

// ── POST /api/budget/moves/:id/undo ──────────────────────────────────────────
// Reverses a move: sets undone = 1, adds amount back to from_category,
// removes from to_category.

router.post('/moves/:id/undo', (req, res) => {
  const moveId = Number(req.params.id)
  if (isNaN(moveId)) return res.status(400).json({ error: 'Invalid move id' })

  const move = db.prepare(
    'SELECT id, month, from_category_id, to_category_id, amount, undone FROM budget_moves WHERE id = ?'
  ).get(moveId) as {
    id: number; month: string; from_category_id: number | null
    to_category_id: number | null; amount: number; undone: number
  } | undefined

  if (!move) return res.status(404).json({ error: 'Move not found' })
  if (move.undone === 1) return res.status(400).json({ error: 'Move already undone' })

  db.exec('BEGIN')
  try {
    // Mark as undone
    db.prepare('UPDATE budget_moves SET undone = 1 WHERE id = ?').run(moveId)

    // Reverse: add amount back to from_category
    if (move.from_category_id != null) {
      const fromRow = db.prepare(
        'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
      ).get(move.from_category_id, move.month) as { assigned: number } | undefined

      const fromAssigned = (fromRow?.assigned ?? 0) + move.amount

      db.prepare(`
        INSERT INTO monthly_budgets (category_id, month, assigned)
        VALUES (?, ?, ?)
        ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
      `).run(move.from_category_id, move.month, fromAssigned)
    }

    // Reverse: remove amount from to_category
    if (move.to_category_id != null) {
      const toRow = db.prepare(
        'SELECT assigned FROM monthly_budgets WHERE category_id = ? AND month = ?'
      ).get(move.to_category_id, move.month) as { assigned: number } | undefined

      const toAssigned = (toRow?.assigned ?? 0) - move.amount

      db.prepare(`
        INSERT INTO monthly_budgets (category_id, month, assigned)
        VALUES (?, ?, ?)
        ON CONFLICT(category_id, month) DO UPDATE SET assigned = excluded.assigned
      `).run(move.to_category_id, move.month, toAssigned)
    }

    db.exec('COMMIT')
    res.json({ undone: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

export default router
