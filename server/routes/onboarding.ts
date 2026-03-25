import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalaryEntry { amount: number; paymentDay: number | null }
interface BonusEntry  { name: string; amount: number; expectedMonth: number }
interface OtherIncomeEntry {
  name: string; amount: number
  type: 'bonus' | 'one-off'; isRecurring: boolean; expectedMonth: number | null
}

interface CategoryEntry {
  name: string
  isShared: boolean
  customSplit: number | null
  targetAmount: number | null
}

interface GroupEntry {
  name: string
  categories: CategoryEntry[]
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
  groups: GroupEntry[]
}

// Legacy support — keep old body shape working too
interface LegacyOnboardingBody {
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
  fixedExpenses: Array<{
    name: string; amount: number; isShared: boolean
    recurrence: string; dueDay: number | null; dueMonth: number | null
    customSplit: number | null
  }>
  irregularExpenses: Array<{
    name: string; amount: number; expectedMonth: number; isShared: boolean
    customSplit: number | null
  }>
}

interface RunResult { lastInsertRowid: number | bigint }

function isNewBody(b: unknown): b is OnboardingBody {
  if (!b || typeof b !== 'object') return false
  const body = b as Record<string, unknown>
  return (
    body.settings !== undefined &&
    body.income !== undefined &&
    Array.isArray(body.groups)
  )
}

function isLegacyBody(b: unknown): b is LegacyOnboardingBody {
  if (!b || typeof b !== 'object') return false
  const body = b as Record<string, unknown>
  return (
    body.settings !== undefined &&
    body.income !== undefined &&
    Array.isArray(body.fixedExpenses) &&
    Array.isArray(body.irregularExpenses)
  )
}

// ── Default category groups ───────────────────────────────────────────────────

const DEFAULT_GROUPS: GroupEntry[] = [
  {
    name: 'Shared Expenses',
    categories: [
      { name: 'Rent', isShared: true, customSplit: null, targetAmount: null },
      { name: 'Electricity', isShared: true, customSplit: null, targetAmount: null },
      { name: 'Water', isShared: true, customSplit: null, targetAmount: null },
      { name: 'Internet + TV + Netflix', isShared: true, customSplit: null, targetAmount: null },
      { name: 'Groceries', isShared: true, customSplit: null, targetAmount: null },
      { name: 'Building Fees', isShared: true, customSplit: null, targetAmount: null },
      { name: 'House Cleaning', isShared: true, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Debt',
    categories: [
      { name: 'Personal Loan', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Car Installment', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Immediate Obligations',
    categories: [
      { name: 'Vodafone Mobile', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Cosmote Mobile', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Interest & Fees', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Car',
    categories: [
      { name: 'Gas', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Car Expenses', isShared: false, customSplit: null, targetAmount: null },
      { name: 'KTEO', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Car Insurance', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Car Service', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Subscriptions',
    categories: [
      { name: 'Revolut Metal', isShared: false, customSplit: null, targetAmount: null },
      { name: 'AI (GPT)', isShared: false, customSplit: null, targetAmount: null },
      { name: 'YouTube', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Spotify', isShared: false, customSplit: null, targetAmount: null },
      { name: 'YNAB', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Savings & Investment',
    categories: [
      { name: 'Savings', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Emergency Fund', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Goals',
    categories: [
      { name: 'PS5', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Boat License', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'True Expenses',
    categories: [
      { name: 'Haircut', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Home & Office', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Medical', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Nutritionist', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Transportation', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Just for Fun',
    categories: [
      { name: 'Coffee & Drink', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Food Out', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Drink Out', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Food Delivery', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Dining Out', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Temu/Impulse', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Fun Money', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Personal Care',
    categories: [
      { name: 'Nails', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Face & Body', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Quality of Life',
    categories: [
      { name: 'Education', isShared: false, customSplit: null, targetAmount: null },
      { name: 'Vacation', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
  {
    name: 'Additional Expenses',
    categories: [
      { name: 'Other', isShared: false, customSplit: null, targetAmount: null },
    ],
  },
]

// ── Helper: insert groups and categories ──────────────────────────────────────

function insertGroupsAndCategories(groups: GroupEntry[]) {
  const insertGroup = db.prepare(
    'INSERT INTO category_groups (name, sort_order) VALUES (?, ?)'
  )
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, group_id, is_shared, custom_split, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
  const insertTarget = db.prepare(
    'INSERT INTO category_targets (category_id, target_type, target_amount, is_recurring) VALUES (?, ?, ?, ?)'
  )

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    const gResult = insertGroup.run(g.name, gi) as RunResult
    const groupId = Number(gResult.lastInsertRowid)

    for (let ci = 0; ci < g.categories.length; ci++) {
      const c = g.categories[ci]
      const cResult = insertCategory.run(
        c.name, groupId, c.isShared ? 1 : 0, c.customSplit, ci
      ) as RunResult
      const categoryId = Number(cResult.lastInsertRowid)

      if (c.targetAmount && c.targetAmount > 0) {
        insertTarget.run(categoryId, 'monthly', c.targetAmount, 1)
      }
    }
  }
}

// ── POST /api/onboarding (new version) ────────────────────────────────────────

router.post('/', (req, res) => {
  // Guard: already complete
  const existing = db
    .prepare("SELECT value FROM settings WHERE key = 'onboarding_complete'")
    .get() as { value: string } | undefined

  if (existing?.value === 'true') {
    return res.status(409).json({ ok: false, error: 'Onboarding already complete' })
  }

  // Accept both new and legacy body formats
  const isNew = isNewBody(req.body)
  const isLegacy = isLegacyBody(req.body)

  if (!isNew && !isLegacy) {
    return res.status(400).json({ ok: false, error: 'Invalid request body' })
  }

  const body = req.body as OnboardingBody | LegacyOnboardingBody
  const { settings, income } = body

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

  db.exec('BEGIN')
  try {
    // Settings
    upsertSetting.run('currency', settings.currency)
    upsertSetting.run('shared_split_user', String(settings.shared_split_user))
    upsertSetting.run('savings_target', String(settings.savings_target))
    upsertSetting.run('share_expenses', settings.share_expenses)

    // Salary
    insertIncome.run(
      'Salary', income.salary.amount, 'salary',
      null, 1, income.salary.paymentDay ?? null, null
    )

    // Bonuses
    for (const b of income.bonuses) {
      insertIncome.run(b.name, b.amount, 'bonus', b.expectedMonth, 0, null, null)
    }

    // Other income
    for (const o of income.otherIncome) {
      insertIncome.run(
        o.name, o.amount, o.type,
        o.expectedMonth ?? null, o.isRecurring ? 1 : 0, null, null
      )
    }

    // Category groups and categories
    if (isNew) {
      const newBody = body as OnboardingBody
      insertGroupsAndCategories(newBody.groups)
    } else {
      // Legacy: create default groups and categories
      insertGroupsAndCategories(DEFAULT_GROUPS)

      // Also insert legacy expenses for backward compat
      const insertExpense = db.prepare(`
        INSERT INTO expenses (name, amount, category, is_shared, recurrence, due_day, due_month, status, custom_split)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const legacyBody = body as LegacyOnboardingBody
      for (const e of legacyBody.fixedExpenses) {
        const category = e.isShared ? 'fixed_shared' : 'fixed_personal'
        insertExpense.run(
          e.name, e.amount, category, e.isShared ? 1 : 0,
          e.recurrence, e.dueDay ?? null, e.dueMonth ?? null, 'active', e.customSplit ?? null
        )
      }
      for (const e of legacyBody.irregularExpenses) {
        const category = e.isShared ? 'fixed_shared' : 'irregular'
        insertExpense.run(
          e.name, e.amount, category, e.isShared ? 1 : 0,
          'specific_month', null, e.expectedMonth, 'upcoming', e.customSplit ?? null
        )
      }
    }

    // Mark complete
    upsertSetting.run('onboarding_complete', 'true')

    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: message })
  }
})

// ── GET /api/onboarding/defaults ──────────────────────────────────────────────
// Returns default category groups/categories for the onboarding wizard

router.get('/defaults', (_req, res) => {
  res.json({ groups: DEFAULT_GROUPS })
})

// ── POST /api/onboarding/skip ─────────────────────────────────────────────────

router.post('/skip', (_req, res) => {
  db.exec('BEGIN')
  try {
    // Even when skipping, create default groups and categories so the budget page works
    insertGroupsAndCategories(DEFAULT_GROUPS)
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_complete', 'true')").run()
    db.exec('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    db.exec('ROLLBACK')
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: message })
  }
})

// ── POST /api/onboarding/demo ─────────────────────────────────────────────────

router.post('/demo', (_req, res) => {
  const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const insertIncome = db.prepare(`
    INSERT INTO income (name, amount, type, expected_month, is_recurring, due_day, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertBudget = db.prepare(`
    INSERT INTO monthly_budgets (category_id, month, assigned)
    VALUES (?, ?, ?)
  `)
  const insertTarget = db.prepare(`
    INSERT INTO category_targets (category_id, target_type, target_amount, is_recurring)
    VALUES (?, ?, ?, ?)
  `)
  const insertTx = db.prepare(`
    INSERT INTO transactions (date, payee, category_id, memo, amount, cleared)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  db.exec('BEGIN')
  try {
    // Settings
    upsertSetting.run('currency', 'EUR')
    upsertSetting.run('shared_split_user', '0.5')
    upsertSetting.run('savings_target', '200')
    upsertSetting.run('share_expenses', 'true')

    // Income
    insertIncome.run('Salary', 2500, 'salary', null, 1, 25, null)
    insertIncome.run('Easter Bonus', 500, 'bonus', 4, 0, null, null)
    insertIncome.run('Christmas Bonus', 1000, 'bonus', 12, 0, null, null)

    // Create demo category groups with realistic categories
    const demoGroups: GroupEntry[] = [
      {
        name: 'Shared Expenses',
        categories: [
          { name: 'Rent', isShared: true, customSplit: 0.6, targetAmount: 500 },
          { name: 'Electricity', isShared: true, customSplit: null, targetAmount: 140 },
          { name: 'Water', isShared: true, customSplit: null, targetAmount: 10 },
          { name: 'Internet + TV + Netflix', isShared: true, customSplit: null, targetAmount: 52 },
          { name: 'Groceries', isShared: true, customSplit: null, targetAmount: 350 },
          { name: 'Building Fees', isShared: true, customSplit: null, targetAmount: null },
          { name: 'House Cleaning', isShared: true, customSplit: null, targetAmount: null },
        ],
      },
      {
        name: 'Debt',
        categories: [
          { name: 'Personal Loan', isShared: false, customSplit: null, targetAmount: 40 },
          { name: 'Car Installment', isShared: false, customSplit: null, targetAmount: 101 },
        ],
      },
      {
        name: 'Immediate Obligations',
        categories: [
          { name: 'Vodafone Mobile', isShared: false, customSplit: null, targetAmount: 57 },
          { name: 'Cosmote Mobile', isShared: false, customSplit: null, targetAmount: 13 },
          { name: 'Interest & Fees', isShared: false, customSplit: null, targetAmount: 5 },
        ],
      },
      {
        name: 'Car',
        categories: [
          { name: 'Gas', isShared: false, customSplit: null, targetAmount: 60 },
          { name: 'Car Expenses', isShared: false, customSplit: null, targetAmount: 54 },
          { name: 'KTEO', isShared: false, customSplit: null, targetAmount: 74 },
          { name: 'Car Insurance', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Car Service', isShared: false, customSplit: null, targetAmount: null },
        ],
      },
      {
        name: 'Subscriptions',
        categories: [
          { name: 'Revolut Metal', isShared: false, customSplit: null, targetAmount: 17 },
          { name: 'AI (GPT)', isShared: false, customSplit: null, targetAmount: 18 },
          { name: 'YouTube', isShared: false, customSplit: null, targetAmount: 8.50 },
          { name: 'Spotify', isShared: false, customSplit: null, targetAmount: 2.50 },
          { name: 'YNAB', isShared: false, customSplit: null, targetAmount: 24 },
        ],
      },
      {
        name: 'Savings & Investment',
        categories: [
          { name: 'Savings EUR 100', isShared: false, customSplit: null, targetAmount: 100 },
          { name: 'Emergency Fund', isShared: false, customSplit: null, targetAmount: null },
        ],
      },
      {
        name: 'Goals',
        categories: [
          { name: 'PS5', isShared: false, customSplit: null, targetAmount: 60 },
          { name: 'Boat License', isShared: false, customSplit: null, targetAmount: null },
        ],
      },
      {
        name: 'True Expenses',
        categories: [
          { name: 'Haircut', isShared: false, customSplit: null, targetAmount: 14 },
          { name: 'Home & Office', isShared: false, customSplit: null, targetAmount: 206 },
          { name: 'Medical', isShared: false, customSplit: null, targetAmount: 13 },
          { name: 'Nutritionist', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Transportation', isShared: false, customSplit: null, targetAmount: 61 },
        ],
      },
      {
        name: 'Just for Fun',
        categories: [
          { name: 'Coffee & Drink', isShared: false, customSplit: null, targetAmount: 76 },
          { name: 'Food Out', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Drink Out', isShared: false, customSplit: null, targetAmount: 21 },
          { name: 'Food Delivery', isShared: false, customSplit: null, targetAmount: 95 },
          { name: 'Dining Out', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Temu/Impulse', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Fun Money', isShared: false, customSplit: null, targetAmount: 47 },
        ],
      },
      {
        name: 'Personal Care',
        categories: [
          { name: 'Nails', isShared: false, customSplit: null, targetAmount: null },
          { name: 'Face & Body', isShared: false, customSplit: null, targetAmount: 25 },
        ],
      },
      {
        name: 'Quality of Life',
        categories: [
          { name: 'Education', isShared: false, customSplit: null, targetAmount: 40 },
          { name: 'Vacation', isShared: false, customSplit: null, targetAmount: null },
        ],
      },
      {
        name: 'Additional Expenses',
        categories: [
          { name: 'Other', isShared: false, customSplit: null, targetAmount: null },
        ],
      },
    ]

    insertGroupsAndCategories(demoGroups)

    // Now add demo monthly budget assignments and transactions for the current month
    // Get all categories we just inserted
    const allCats = db.prepare('SELECT id, name FROM categories').all() as Array<{ id: number; name: string }>
    const catByName = new Map(allCats.map(c => [c.name, c.id]))

    // Helper: assign budget for current month
    function assignBudget(catName: string, amount: number) {
      const catId = catByName.get(catName)
      if (catId) insertBudget.run(catId, currentMonth, amount)
    }

    // Helper: add transaction (outflow = negative amount)
    function addTx(date: string, payee: string, catName: string, amount: number, memo?: string) {
      const catId = catByName.get(catName)
      if (catId) insertTx.run(date, payee, catId, memo ?? null, amount, 1)
    }

    const monthPrefix = currentMonth

    // Assign budgets matching REDESIGN.md example
    assignBudget('Rent', 300)
    assignBudget('Electricity', 70)
    assignBudget('Water', 5)
    assignBudget('Internet + TV + Netflix', 26)
    assignBudget('Groceries', 175)
    assignBudget('Personal Loan', 40)
    assignBudget('Car Installment', 101)
    assignBudget('Gas', 60)
    assignBudget('Car Expenses', 54)
    assignBudget('KTEO', 74)
    assignBudget('Vodafone Mobile', 57)
    assignBudget('Cosmote Mobile', 13)
    assignBudget('Interest & Fees', 5)
    assignBudget('Revolut Metal', 17)
    assignBudget('AI (GPT)', 18)
    assignBudget('YouTube', 8.50)
    assignBudget('Spotify', 2.50)
    assignBudget('YNAB', 24)
    assignBudget('PS5', 60)
    assignBudget('Haircut', 14)
    assignBudget('Home & Office', 206)
    assignBudget('Medical', 13)
    assignBudget('Transportation', 61)
    assignBudget('Coffee & Drink', 76)
    assignBudget('Drink Out', 21)
    assignBudget('Food Delivery', 95)
    assignBudget('Fun Money', 47)
    assignBudget('Face & Body', 25)
    assignBudget('Education', 40)

    // Demo transactions (outflows are negative)
    addTx(`${monthPrefix}-01`, 'Landlord', 'Rent', -300, 'Monthly rent')
    addTx(`${monthPrefix}-02`, 'DEI', 'Electricity', -41, 'Electricity bill')
    addTx(`${monthPrefix}-03`, 'ISP Provider', 'Internet + TV + Netflix', -26, 'Internet bill')
    addTx(`${monthPrefix}-04`, 'Supermarket', 'Groceries', -97, 'Weekly shop')
    addTx(`${monthPrefix}-08`, 'Supermarket', 'Groceries', -62, 'Midweek shop')
    addTx(`${monthPrefix}-12`, 'Supermarket', 'Groceries', -38, 'Top-up shop')
    addTx(`${monthPrefix}-05`, 'Bank', 'Personal Loan', -40, 'Loan payment')
    addTx(`${monthPrefix}-05`, 'Car Dealer', 'Car Installment', -101, 'Car payment')
    addTx(`${monthPrefix}-06`, 'Shell', 'Gas', -35, 'Gas fill-up')
    addTx(`${monthPrefix}-14`, 'Shell', 'Gas', -23, 'Gas top-up')
    addTx(`${monthPrefix}-07`, 'Mechanic', 'Car Expenses', -54, 'Oil change')
    addTx(`${monthPrefix}-07`, 'KTEO', 'KTEO', -74, 'Road worthiness')
    addTx(`${monthPrefix}-03`, 'Vodafone', 'Vodafone Mobile', -57, 'Phone bill')
    addTx(`${monthPrefix}-03`, 'Cosmote', 'Cosmote Mobile', -13, 'Phone bill')
    addTx(`${monthPrefix}-04`, 'Bank', 'Interest & Fees', -0.60, 'Monthly fee')
    addTx(`${monthPrefix}-01`, 'Revolut', 'Revolut Metal', -17, 'Metal plan')
    addTx(`${monthPrefix}-01`, 'OpenAI', 'AI (GPT)', -17, 'ChatGPT Plus')
    addTx(`${monthPrefix}-08`, 'Barber', 'Haircut', -14, 'Haircut')
    addTx(`${monthPrefix}-10`, 'IKEA', 'Home & Office', -122, 'Office supplies')
    addTx(`${monthPrefix}-15`, 'Hardware Store', 'Home & Office', -100, 'Home repair')
    addTx(`${monthPrefix}-09`, 'Doctor', 'Medical', -13, 'Check-up')
    addTx(`${monthPrefix}-06`, 'Bus', 'Transportation', -61, 'Monthly pass')
    addTx(`${monthPrefix}-05`, 'Starbucks', 'Coffee & Drink', -5.30, 'Morning coffee')
    addTx(`${monthPrefix}-07`, 'Coffee Island', 'Coffee & Drink', -4.20, 'Afternoon coffee')
    addTx(`${monthPrefix}-10`, 'Café', 'Coffee & Drink', -6.50, 'Weekend coffee')
    addTx(`${monthPrefix}-12`, 'Local Bar', 'Coffee & Drink', -8, 'Evening drinks')
    addTx(`${monthPrefix}-15`, 'Café', 'Coffee & Drink', -72, 'Misc coffees')
    addTx(`${monthPrefix}-08`, 'Wolt', 'Food Delivery', -16.45, 'Wolt order')
    addTx(`${monthPrefix}-11`, 'Wolt', 'Food Delivery', -22.55, 'Wolt order')
    addTx(`${monthPrefix}-14`, 'efood', 'Food Delivery', -18, 'eFood order')
    addTx(`${monthPrefix}-17`, 'Wolt', 'Food Delivery', -54, 'Wolt orders')
    addTx(`${monthPrefix}-09`, 'Fun stuff', 'Fun Money', -47, 'Fun spending')
    addTx(`${monthPrefix}-12`, 'Nail salon', 'Face & Body', -25, 'Facial')
    addTx(`${monthPrefix}-08`, 'Udemy', 'Education', -40, 'Course purchase')

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

router.post('/reset', (_req, res) => {
  db.exec('BEGIN')
  try {
    // Clean new tables
    db.exec('DELETE FROM transactions')
    db.exec('DELETE FROM monthly_budgets')
    db.exec('DELETE FROM category_targets')
    db.exec('DELETE FROM categories')
    db.exec('DELETE FROM category_groups')

    // Clean legacy tables
    db.exec('DELETE FROM stress_tests')
    try { db.exec('DELETE FROM expenses') } catch { /* table may not exist */ }
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
