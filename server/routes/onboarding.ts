import { Router } from 'express'
import db from '../db'

const router = Router()

interface SalaryEntry { amount: number; paymentDay: number | null }
interface BonusEntry  { name: string; amount: number; expectedMonth: number }
interface OtherIncomeEntry {
  name: string; amount: number
  type: 'bonus' | 'one-off'; isRecurring: boolean; expectedMonth: number | null
}
interface FixedExpenseEntry {
  name: string; amount: number; isShared: boolean
  recurrence: string; dueDay: number | null; dueMonth: number | null
  customSplit: number | null
}
interface IrregularExpenseEntry {
  name: string; amount: number; expectedMonth: number; isShared: boolean
  customSplit: number | null
}

interface OnboardingBody {
  settings: {
    currency: string
    shared_split_user: number
    savings_target: number
    share_expenses: string
  }
  income: {
    salary: SalaryEntry
    bonuses: BonusEntry[]
    otherIncome: OtherIncomeEntry[]
  }
  fixedExpenses: FixedExpenseEntry[]
  irregularExpenses: IrregularExpenseEntry[]
}

function isValidBody(b: unknown): b is OnboardingBody {
  if (!b || typeof b !== 'object') return false
  const body = b as Record<string, unknown>
  return (
    body.settings !== undefined &&
    body.income !== undefined &&
    Array.isArray(body.fixedExpenses) &&
    Array.isArray(body.irregularExpenses)
  )
}

// POST /api/onboarding
router.post('/', (req, res) => {
  // Guard: already complete
  const existing = db
    .prepare("SELECT value FROM settings WHERE key = 'onboarding_complete'")
    .get() as { value: string } | undefined

  if (existing?.value === 'true') {
    return res.status(409).json({ ok: false, error: 'Onboarding already complete' })
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({ ok: false, error: 'Invalid request body' })
  }

  const { settings, income, fixedExpenses, irregularExpenses } = req.body

  // Validate critical fields
  if (!income.salary || income.salary.amount <= 0) {
    return res.status(400).json({ ok: false, error: 'Salary amount must be > 0' })
  }
  if (settings.shared_split_user <= 0 || settings.shared_split_user > 1) {
    if (settings.share_expenses === 'true') {
      return res.status(400).json({ ok: false, error: 'shared_split_user must be between 0 and 1' })
    }
  }

  // Prepared statements
  const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const insertIncome = db.prepare(`
    INSERT INTO income (name, amount, type, expected_month, is_recurring, due_day, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertExpense = db.prepare(`
    INSERT INTO expenses (name, amount, category, is_shared, recurrence, due_day, due_month, status, custom_split)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    // Settings
    upsertSetting.run('currency', settings.currency)
    upsertSetting.run('shared_split_user', String(settings.shared_split_user))
    upsertSetting.run('savings_target', String(settings.savings_target))
    upsertSetting.run('share_expenses', settings.share_expenses)

    // Salary
    insertIncome.run(
      'Salary',
      income.salary.amount,
      'salary',
      null,
      1,
      income.salary.paymentDay ?? null,
      null
    )

    // Bonuses
    for (const b of income.bonuses) {
      insertIncome.run(b.name, b.amount, 'bonus', b.expectedMonth, 0, null, null)
    }

    // Other income
    for (const o of income.otherIncome) {
      insertIncome.run(
        o.name, o.amount, o.type,
        o.expectedMonth ?? null,
        o.isRecurring ? 1 : 0,
        null, null
      )
    }

    // Fixed expenses
    for (const e of fixedExpenses) {
      const category = e.isShared ? 'fixed_shared' : 'fixed_personal'
      insertExpense.run(
        e.name, e.amount, category,
        e.isShared ? 1 : 0,
        e.recurrence,
        e.dueDay ?? null,
        e.dueMonth ?? null,
        'active',
        e.customSplit ?? null
      )
    }

    // Irregular expenses
    for (const e of irregularExpenses) {
      const category = e.isShared ? 'fixed_shared' : 'irregular'
      insertExpense.run(
        e.name, e.amount, category,
        e.isShared ? 1 : 0,
        'specific_month',
        null,
        e.expectedMonth,
        'upcoming',
        e.customSplit ?? null
      )
    }

    // Mark complete (last — if anything above throws, we rollback)
    upsertSetting.run('onboarding_complete', 'true')

    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: message })
  }
})

// ── POST /api/onboarding/skip ─────────────────────────────────────────────────
// User wants to set up data manually later — mark complete, leave tables empty.

router.post('/skip', (_req, res) => {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_complete', 'true')").run()
  res.json({ ok: true })
})

// ── POST /api/onboarding/demo ─────────────────────────────────────────────────
// Populate with realistic dummy data so the user can explore immediately.

router.post('/demo', (_req, res) => {
  const upsertSetting  = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const insertIncome   = db.prepare(`
    INSERT INTO income (name, amount, type, expected_month, is_recurring, due_day, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertExpense  = db.prepare(`
    INSERT INTO expenses (name, amount, category, is_shared, recurrence, due_day, due_month, status, custom_split)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    // Settings
    upsertSetting.run('currency',           'EUR')
    upsertSetting.run('shared_split_user',  '0.5')
    upsertSetting.run('savings_target',     '200')
    upsertSetting.run('share_expenses',     'true')

    // Income — salary €2,500 paid on the 25th
    insertIncome.run('Salary', 2500, 'salary', null, 1, 25, null)
    // Bonuses
    insertIncome.run('Easter Bonus',    500,  'bonus', 4,  0, null, null)
    insertIncome.run('Christmas Bonus', 1000, 'bonus', 12, 0, null, null)

    // Fixed shared — Rent uses 60% custom split, others use global 50%
    insertExpense.run('Rent',           900, 'fixed_shared',    1, 'monthly',        1,    null, 'active',   0.6)
    insertExpense.run('Internet',        40, 'fixed_shared',    1, 'monthly',        5,    null, 'active',   null)
    insertExpense.run('Groceries',      300, 'fixed_shared',    1, 'monthly',        null, null, 'active',   null)
    insertExpense.run('Electricity',     80, 'fixed_shared',    1, 'monthly',        null, null, 'active',   null)
    // Fixed personal — monthly
    insertExpense.run('Gym',             35, 'fixed_personal',  0, 'monthly',        1,    null, 'active',   null)
    insertExpense.run('Phone plan',      20, 'fixed_personal',  0, 'monthly',        null, null, 'active',   null)
    insertExpense.run('Spotify',         11, 'fixed_personal',  0, 'monthly',        null, null, 'active',   null)
    insertExpense.run('Netflix',         18, 'fixed_shared',    1, 'monthly',        null, null, 'active',   null)
    // Irregular
    insertExpense.run('Car insurance',  450, 'irregular',       0, 'specific_month', null, 6,    'upcoming', null)
    insertExpense.run('Summer holiday', 800, 'fixed_shared',    1, 'specific_month', null, 8,    'upcoming', null)
    insertExpense.run('Dentist',        150, 'fixed_personal',  0, 'specific_month', null, 10,   'upcoming', null)

    upsertSetting.run('onboarding_complete', 'true')
    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: message })
  }
})

// ── POST /api/onboarding/reset ────────────────────────────────────────────────
// Wipe all user data and reset onboarding so the wizard runs again.

router.post('/reset', (_req, res) => {
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM stress_tests')
    db.exec('DELETE FROM transactions')
    db.exec('DELETE FROM expenses')
    db.exec('DELETE FROM income')
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_complete', 'false')").run()
    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: message })
  }
})

export default router
