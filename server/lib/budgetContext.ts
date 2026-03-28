import db from '../db'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupRow    { id: number; name: string; sort_order: number }
interface CatRow     { id: number; name: string; group_id: number; sort_order: number }
interface TargetRow  { category_id: number; target_type: string; target_amount: number; target_date: string | null; is_recurring: number }
interface BudgetRow  { category_id: number; assigned: number }
interface TxSumRow   { category_id: number; activity: number }
interface IncomeRow  { name: string; amount: number; type: string; expected_month: number | null; is_recurring: number }

// ── Helpers (mirrored from prompt.ts) ─────────────────────────────────────────

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

  // Only budget account opening balances count toward the budget (not tracking)
  const budgetAccountsRow = db.prepare(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE type = 'budget' AND is_closed = 0"
  ).get() as { total: number }

  const incomeRows = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  let incomeTableTotal = 0
  for (let m = 1; m <= monthNum; m++) {
    for (const i of incomeRows) {
      if (i.is_recurring) incomeTableTotal += i.amount
      else if (Number(i.expected_month) === m) incomeTableTotal += i.amount
    }
  }

  return +(budgetAccountsRow.total + allTxIncome.total + incomeTableTotal - allAssigned.total).toFixed(2)
}

// ── Build formatted budget context string ─────────────────────────────────────

export function buildBudgetContext(month?: string): string {
  const now = new Date()
  const m = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const readyToAssign = calculateReadyToAssign(m)

  const groups = db.prepare('SELECT * FROM category_groups ORDER BY sort_order, id').all() as GroupRow[]
  const categories = db.prepare('SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order, id').all() as CatRow[]
  const targets = db.prepare('SELECT * FROM category_targets').all() as TargetRow[]
  const targetMap = new Map(targets.map(t => [t.category_id, t]))

  const budgets = db.prepare('SELECT category_id, assigned FROM monthly_budgets WHERE month = ?').all(m) as BudgetRow[]
  const budgetMap = new Map(budgets.map(b => [b.category_id, b.assigned]))

  const txSums = db.prepare(`
    SELECT category_id, COALESCE(SUM(amount), 0) AS activity
    FROM transactions WHERE date LIKE ? AND category_id IS NOT NULL
    GROUP BY category_id
  `).all(m + '-%') as TxSumRow[]
  const activityMap = new Map(txSums.map(t => [t.category_id, t.activity]))

  let totalAssigned = 0
  let totalActivity = 0
  const overspent: Array<{ name: string; amount: number }> = []
  const underfunded: Array<{ name: string; gap: number }> = []

  // Cost to Be Me: sum of all monthly/recurring target amounts
  const costToBeMe = (db.prepare(
    "SELECT COALESCE(SUM(target_amount), 0) AS total FROM category_targets WHERE target_type = 'monthly' OR is_recurring = 1"
  ).get() as { total: number }).total

  // Format month label
  const [year, mon] = m.split('-')
  const monthLabel = new Date(Number(year), Number(mon) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const lines: string[] = []
  lines.push(`BUDGET CONTEXT — ${monthLabel}`)
  lines.push('============================================================')

  // Build groups
  const groupBlocks: string[] = []
  for (const g of groups) {
    const cats = categories.filter(c => c.group_id === g.id)
    if (cats.length === 0) continue

    let gAssigned = 0
    let gActivity = 0
    let gAvailable = 0
    const catLines: string[] = []

    for (const c of cats) {
      const assigned = budgetMap.get(c.id) ?? 0
      const activity = activityMap.get(c.id) ?? 0
      const available = calculateAvailable(c.id, m, assigned, activity)
      const target = targetMap.get(c.id)

      gAssigned += assigned
      gActivity += activity
      gAvailable += available

      let flag = ''
      if (available < 0) {
        flag = '  ← OVERSPENT'
        overspent.push({ name: c.name, amount: available })
      }
      if (target && available < target.target_amount) {
        underfunded.push({ name: c.name, gap: +(target.target_amount - available).toFixed(2) })
      }

      catLines.push(`  - ${c.name} | ${assigned.toFixed(2)} | ${activity.toFixed(2)} | ${available.toFixed(2)}${flag}`)
    }

    totalAssigned += gAssigned
    totalActivity += gActivity

    groupBlocks.push(
      `Group: ${g.name}  | Assigned: ${gAssigned.toFixed(2)} | Spent: ${Math.abs(gActivity).toFixed(2)} | Available: ${gAvailable.toFixed(2)}\n` +
      catLines.join('\n')
    )
  }

  // Income forecast
  const monthNum = parseInt(m.split('-')[1], 10)
  const incomeRows = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  const expectedIncome = incomeRows.reduce((sum, i) => {
    if (i.is_recurring) return sum + i.amount
    if (Number(i.expected_month) === monthNum) return sum + i.amount
    return sum
  }, 0)

  lines.push(`Ready to Assign:    EUR ${readyToAssign.toFixed(2)}`)
  lines.push(`Total Assigned:     EUR ${totalAssigned.toFixed(2)}`)
  lines.push(`Total Spent:        EUR ${Math.abs(totalActivity).toFixed(2)}`)
  lines.push(`Expected Income:    EUR ${expectedIncome.toFixed(2)}`)
  lines.push(`Cost to Be Me:      EUR ${costToBeMe.toFixed(2)}`)
  lines.push('')
  lines.push('CATEGORY BREAKDOWN')
  lines.push('------------------------------------------------------------')
  lines.push(groupBlocks.join('\n\n'))

  if (overspent.length > 0) {
    lines.push('')
    lines.push(`OVERSPENT CATEGORIES (${overspent.length} total)`)
    lines.push('------------------------------------------------------------')
    for (const o of overspent) {
      lines.push(`  ${o.name}    -EUR ${Math.abs(o.amount).toFixed(2)}`)
    }
  }

  if (underfunded.length > 0) {
    lines.push('')
    lines.push('UNDERFUNDED CATEGORIES')
    lines.push('------------------------------------------------------------')
    for (const u of underfunded) {
      lines.push(`  ${u.name}    needs EUR ${u.gap.toFixed(2)} more`)
    }
  }

  // Upcoming targets: targets with target_date within next 30 days
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in30Str = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, '0')}-${String(in30.getDate()).padStart(2, '0')}`

  const upcomingRows = db.prepare(`
    SELECT ct.category_id, ct.target_amount, ct.target_date, c.name AS category_name
    FROM category_targets ct
    JOIN categories c ON c.id = ct.category_id
    WHERE ct.target_date IS NOT NULL AND ct.target_date >= ? AND ct.target_date <= ?
    ORDER BY ct.target_date
  `).all(todayStr, in30Str) as Array<{ category_id: number; target_amount: number; target_date: string; category_name: string }>

  if (upcomingRows.length > 0) {
    lines.push('')
    lines.push('UPCOMING TARGETS (next 30 days)')
    lines.push('------------------------------------------------------------')
    for (const u of upcomingRows) {
      const assigned = budgetMap.get(u.category_id) ?? 0
      const activity = activityMap.get(u.category_id) ?? 0
      const available = calculateAvailable(u.category_id, m, assigned, activity)
      const needed = Math.max(0, +(u.target_amount - available).toFixed(2))
      const [tYear, tMon, tDay] = u.target_date.split('-')
      const dueMonth = new Date(Number(tYear), Number(tMon) - 1).toLocaleString('en-US', { month: 'short' })
      const dueLabel = `${dueMonth} ${Number(tDay)}`
      if (needed > 0) {
        lines.push(`  ${u.category_name}    due ${dueLabel}  — needs EUR ${needed.toFixed(2)}`)
      } else {
        lines.push(`  ${u.category_name}    due ${dueLabel}  — fully funded`)
      }
    }
  }

  lines.push('============================================================')

  return lines.join('\n')
}

export function buildSystemPrompt(context: string): string {
  return `You are a personal finance assistant embedded in a budgeting app.
You have access to the user's live budget data below.

Rules:
- Answer ONLY based on the budget data provided. Do not invent numbers.
- Be concise and direct. No unnecessary preamble.
- When suggesting actions, be specific (category names, exact amounts).
- Use EUR currency. Format amounts as "EUR X.XX".
- If asked about something not in the budget data, say so clearly.
- Do not recommend external financial products or services.

${context}`
}
