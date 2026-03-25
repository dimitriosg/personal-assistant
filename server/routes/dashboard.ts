import { Router } from 'express'
import db from '../db'

const router = Router()

// ── DB row types ──────────────────────────────────────────────────────────────

interface IncomeRow {
  id: number; name: string; amount: number; type: string
  expected_month: number | null; is_recurring: number; due_day: number | null
}

interface ExpenseRow {
  id: number; name: string; amount: number; category: string
  is_shared: number; recurrence: string; due_day: number | null
  due_month: number | null; status: string; custom_split: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dueMonth: number, dueDay: number | null, now: Date): number {
  const cm = now.getMonth() + 1
  const cy = now.getFullYear()
  let year = cy
  if (dueMonth < cm) year = cy + 1
  else if (dueMonth === cm && dueDay && dueDay < now.getDate()) year = cy + 1
  const target = new Date(year, dueMonth - 1, dueDay ?? 1)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

const PERIODS = [
  { label: 'Next 30 days', from: 1,   to: 30  },
  { label: '31–60 days',   from: 31,  to: 60  },
  { label: '61–90 days',   from: 61,  to: 90  },
  { label: '91–120 days',  from: 91,  to: 120 },
  { label: '121–150 days', from: 121, to: 150 },
  { label: '151–180 days', from: 151, to: 180 },
]

// ── GET /api/dashboard ────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const now = new Date()
  const cm = now.getMonth() + 1        // current month 1-12
  const cy = now.getFullYear()
  const monthStr = `${cy}-${String(cm).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // ── Settings
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const s = Object.fromEntries(settingsRows.map(r => [r.key, r.value]))
  const splitUser = parseFloat(s.shared_split_user ?? '0.5')
  const savingsTarget = parseFloat(s.savings_target ?? '100')

  // ── Income this month
  const allIncome = db.prepare('SELECT * FROM income').all() as IncomeRow[]
  const salaries    = allIncome.filter(i => i.type === 'salary' && i.is_recurring)
  const monthlyOther = allIncome.filter(i => i.type !== 'salary' && i.is_recurring)
  const oneOffThisMonth = allIncome.filter(i => !i.is_recurring && i.expected_month === cm)

  const salaryTotal  = salaries.reduce((sum, i) => sum + i.amount, 0)
  const extrasThisMonth = [...monthlyOther, ...oneOffThisMonth]
  const extrasTotal  = extrasThisMonth.reduce((sum, i) => sum + i.amount, 0)
  const incomeTotal  = salaryTotal + extrasTotal

  const incomeExtras = extrasThisMonth.map(i => ({ id: i.id, name: i.name, amount: i.amount, type: i.type }))

  // ── Fixed expenses this month (monthly recurring + annual/specific due this month)
  const allExpenses = db.prepare(
    "SELECT * FROM expenses WHERE status NOT IN ('paid', 'paused')"
  ).all() as ExpenseRow[]

  const fixedRows = allExpenses.filter(e =>
    e.recurrence === 'monthly' ||
    (e.recurrence !== 'monthly' && e.due_month === cm)
  )

  const fixedItems = fixedRows.map(e => {
    const split = e.is_shared ? (e.custom_split ?? splitUser) : 1
    return {
      id: e.id,
      name: e.name,
      amount: e.amount,
      isShared: Boolean(e.is_shared),
      myShare: e.is_shared ? +(e.amount * split).toFixed(2) : e.amount,
      customSplitPercent: e.custom_split != null ? Math.round(e.custom_split * 100) : null,
      recurrence: e.recurrence,
      category: e.category,
    }
  })

  const fixedTotal   = fixedItems.reduce((sum, i) => sum + i.amount, 0)
  const fixedMyShare = fixedItems.reduce((sum, i) => sum + i.myShare, 0)

  // ── Already spent (transactions this month)
  const txRow = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date LIKE ?"
  ).get(monthStr + '-%') as { total: number }
  const alreadySpent = txRow.total

  // ── Remaining
  const remaining = +(incomeTotal - fixedMyShare - alreadySpent).toFixed(2)
  const remainingSafe = +(remaining - savingsTarget).toFixed(2)

  // ── Upcoming pressure (non-monthly, due_month set, not current month)
  const upcomingCandidates = allExpenses.filter(e =>
    e.recurrence !== 'monthly' &&
    e.due_month !== null &&
    e.due_month !== cm      // current month already in fixed
  )

  const upcomingItems = upcomingCandidates
    .map(e => {
      const split = e.is_shared ? (e.custom_split ?? splitUser) : 1
      return {
        id: e.id,
        name: e.name,
        amount: e.amount,
        isShared: Boolean(e.is_shared),
        myShare: e.is_shared ? +(e.amount * split).toFixed(2) : e.amount,
        daysAway: daysUntil(e.due_month!, e.due_day, now),
        dueMonth: e.due_month!,
        dueDay: e.due_day,
        category: e.category,
      }
    })
    .filter(e => e.daysAway >= 1 && e.daysAway <= 180)
    .sort((a, b) => a.daysAway - b.daysAway)

  const upcoming = PERIODS.map(p => {
    const items = upcomingItems.filter(e => e.daysAway >= p.from && e.daysAway <= p.to)
    return {
      label: p.label,
      from: p.from,
      to: p.to,
      items,
      myShareTotal: +items.reduce((sum, i) => sum + i.myShare, 0).toFixed(2),
    }
  })

  // ── Bonus flags (next 2 months, used by stress test + dashboard)
  const nextMonth     = (cm % 12) + 1
  const monthAfter    = ((cm + 1) % 12) + 1
  const bonusNextMonth = allIncome.find(i =>
    i.type === 'bonus' && Number(i.expected_month) === nextMonth
  )
  const bonusMonthAfter = allIncome.find(i =>
    i.type === 'bonus' && Number(i.expected_month) === monthAfter
  )
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const upcomingBonuses = [
    bonusNextMonth  ? { name: bonusNextMonth.name,  amount: bonusNextMonth.amount,  month: nextMonth,  label: MONTHS_SHORT[nextMonth - 1],  monthsAway: 1 } : null,
    bonusMonthAfter ? { name: bonusMonthAfter.name, amount: bonusMonthAfter.amount, month: monthAfter, label: MONTHS_SHORT[monthAfter - 1], monthsAway: 2 } : null,
  ].filter(Boolean)

  // ── Verdict
  const upcoming30Sum = upcoming[0].myShareTotal
  let verdict: 'green' | 'yellow' | 'red'
  let verdictReason: string

  if (remaining < 0) {
    verdict = 'red'
    verdictReason = 'Over budget this month'
  } else if (remaining < savingsTarget) {
    verdict = 'red'
    verdictReason = `Below your €${savingsTarget.toFixed(0)} savings target`
  } else if (upcoming30Sum > 0 && remaining - upcoming30Sum < savingsTarget) {
    verdict = 'yellow'
    verdictReason = 'Upcoming expenses in 30 days will eat your buffer'
  } else if (remaining < savingsTarget * 2 && savingsTarget > 0) {
    verdict = 'yellow'
    verdictReason = 'Tight but manageable'
  } else {
    verdict = 'green'
    verdictReason = "You're comfortable this month"
  }

  res.json({
    month: monthLabel,
    splitPercent: Math.round(splitUser * 100),
    savingsTarget,
    income: {
      salary: salaryTotal,
      extras: incomeExtras,
      total: incomeTotal,
    },
    fixed: {
      items: fixedItems,
      total: +fixedTotal.toFixed(2),
      myShare: +fixedMyShare.toFixed(2),
    },
    alreadySpent,
    remaining,
    remainingSafe,
    upcoming,
    upcomingBonuses,
    verdict,
    verdictReason,
  })
})

export default router
