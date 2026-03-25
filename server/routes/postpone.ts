import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupRow   { id: number; name: string; sort_order: number }
interface CatRow     { id: number; name: string; group_id: number; sort_order: number }
interface TargetRow  { category_id: number; target_type: string; target_amount: number; target_date: string | null }
interface BudgetRow  { category_id: number; assigned: number }
interface TxSumRow   { category_id: number; activity: number }

type Priority = 'must_fund' | 'should_fund' | 'can_postpone' | 'should_postpone'

interface PostponeItem {
  category_id:   number
  category_name: string
  group_id:      number
  group_name:    string
  assigned:      number
  activity:      number
  available:     number
  target_amount: number
  target_type:   string
  underfunded:   number
  priority:      Priority
  priority_label: string
}

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

/** Classify a category by priority for postponement */
function classifyPriority(
  groupName: string,
  targetType: string,
  available: number,
  targetAmount: number,
): { priority: Priority; label: string } {
  const gn = groupName.toLowerCase()

  // Must fund — fixed obligations, debt, immediate obligations
  if (gn.includes('debt') || gn.includes('obligation') || gn.includes('shared') || gn.includes('rent')) {
    return { priority: 'must_fund', label: 'Must Fund' }
  }

  // Should fund — regular needs, subscriptions, car, etc.
  if (gn.includes('car') || gn.includes('subscri') || gn.includes('personal care') || gn.includes('true expense')) {
    return { priority: 'should_fund', label: 'Should Fund' }
  }

  // Should postpone — already overspent elsewhere or bad timing
  if (available < 0) {
    return { priority: 'should_postpone', label: 'Should Postpone' }
  }

  // Can postpone — comfort, fun, goals, savings
  if (gn.includes('fun') || gn.includes('goal') || gn.includes('saving') || gn.includes('quality') || gn.includes('comfort')) {
    return { priority: 'can_postpone', label: 'Can Postpone' }
  }

  // Default: should fund
  return { priority: 'should_fund', label: 'Should Fund' }
}

// ── GET /api/postpone?month=YYYY-MM ──────────────────────────────────────────

router.get('/', (req, res) => {
  const now = new Date()
  const month = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM format' })
  }

  const groups = db.prepare('SELECT * FROM category_groups ORDER BY sort_order, id').all() as GroupRow[]
  const groupMap = new Map(groups.map(g => [g.id, g.name]))

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

  const items: PostponeItem[] = []

  for (const cat of categories) {
    const target = targetMap.get(cat.id)
    if (!target) continue // Only categories with targets are considered

    const assigned = budgetMap.get(cat.id) ?? 0
    const activity = activityMap.get(cat.id) ?? 0
    const available = calculateAvailable(cat.id, month, assigned, activity)
    const groupName = groupMap.get(cat.group_id) ?? 'Unknown'

    const underfunded = Math.max(0, target.target_amount - available)
    if (underfunded <= 0) continue // Fully funded, skip

    const { priority, label } = classifyPriority(groupName, target.target_type, available, target.target_amount)

    items.push({
      category_id:    cat.id,
      category_name:  cat.name,
      group_id:       cat.group_id,
      group_name:     groupName,
      assigned,
      activity,
      available,
      target_amount:  target.target_amount,
      target_type:    target.target_type,
      underfunded,
      priority,
      priority_label: label,
    })
  }

  // Sort by priority order then by underfunded amount (largest first)
  const priorityOrder: Record<Priority, number> = {
    must_fund: 0,
    should_fund: 1,
    can_postpone: 2,
    should_postpone: 3,
  }

  items.sort((a, b) => {
    const po = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (po !== 0) return po
    return b.underfunded - a.underfunded
  })

  const totalUnderfunded = items.reduce((s, i) => s + i.underfunded, 0)
  const postponable = items
    .filter(i => i.priority === 'can_postpone' || i.priority === 'should_postpone')
    .reduce((s, i) => s + i.underfunded, 0)

  res.json({
    month,
    items,
    summary: {
      totalUnderfunded: +totalUnderfunded.toFixed(2),
      postponableAmount: +postponable.toFixed(2),
      categoryCount: items.length,
    },
  })
})

export default router
