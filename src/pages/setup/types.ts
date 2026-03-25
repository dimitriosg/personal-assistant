export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export type Currency = 'EUR'
export type SplitPreset = '50' | '60' | '40' | 'custom'
export type Recurrence = 'monthly' | 'annual' | 'one_time' | 'specific_month'

// ── Step 1 ────────────────────────────────────────────────────────────────────

export interface BasicsData {
  currency: Currency
  shareExpenses: boolean
  splitPreset: SplitPreset
  splitCustomValue: number   // 0–100, used when splitPreset === 'custom'
  savingsTarget: number
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

export interface SalaryEntry {
  amount: number
  paymentDay: number | null   // 1–31
}

export interface BonusEntry {
  id: string
  name: string
  amount: number
  expectedMonth: number   // 1–12
}

export interface OtherIncomeEntry {
  id: string
  name: string
  amount: number
  type: 'bonus' | 'one-off'
  isRecurring: boolean
  expectedMonth: number | null   // null = every month
}

export interface IncomeData {
  salary: SalaryEntry
  hasBonus: boolean
  bonuses: BonusEntry[]
  otherIncome: OtherIncomeEntry[]
}

// ── Step 3: Category Groups ───────────────────────────────────────────────────

export interface GroupEntry {
  id: string          // temp client id
  name: string
  enabled: boolean    // whether user wants this group
}

// ── Step 4: Categories ────────────────────────────────────────────────────────

export interface CategoryEntry {
  id: string          // temp client id
  groupId: string     // references GroupEntry.id
  name: string
  enabled: boolean
  isShared: boolean
  customSplit: number | null   // 0–1 decimal override
  targetAmount: number | null  // optional monthly target
}

// ── Legacy types (kept for backward compat) ───────────────────────────────────

export interface FixedExpenseEntry {
  id: string
  name: string
  amount: number
  isShared: boolean
  customSplit: number | null
  recurrence: Recurrence
  dueDay: number | null
  dueMonth: number | null
}

export interface IrregularExpenseEntry {
  id: string
  name: string
  amount: number
  expectedMonth: number
  isShared: boolean
  customSplit: number | null
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface WizardData {
  basics: BasicsData
  income: IncomeData
  groups: GroupEntry[]
  categories: CategoryEntry[]
  // Legacy fields (unused by new flow but kept for type compat)
  fixedExpenses: FixedExpenseEntry[]
  irregularExpenses: IrregularExpenseEntry[]
}

// ── Default groups and categories ─────────────────────────────────────────────

let nextId = 1
function genId() { return `tmp-${nextId++}` }

export interface DefaultGroupDef {
  name: string
  categories: Array<{ name: string; isShared: boolean }>
}

export const DEFAULT_GROUP_DEFS: DefaultGroupDef[] = [
  {
    name: 'Shared Expenses',
    categories: [
      { name: 'Rent', isShared: true },
      { name: 'Electricity', isShared: true },
      { name: 'Water', isShared: true },
      { name: 'Internet + TV + Netflix', isShared: true },
      { name: 'Groceries', isShared: true },
      { name: 'Building Fees', isShared: true },
      { name: 'House Cleaning', isShared: true },
    ],
  },
  {
    name: 'Debt',
    categories: [
      { name: 'Personal Loan', isShared: false },
      { name: 'Car Installment', isShared: false },
    ],
  },
  {
    name: 'Immediate Obligations',
    categories: [
      { name: 'Vodafone Mobile', isShared: false },
      { name: 'Cosmote Mobile', isShared: false },
      { name: 'Interest & Fees', isShared: false },
    ],
  },
  {
    name: 'Car',
    categories: [
      { name: 'Gas', isShared: false },
      { name: 'Car Expenses', isShared: false },
      { name: 'KTEO', isShared: false },
      { name: 'Car Insurance', isShared: false },
      { name: 'Car Service', isShared: false },
    ],
  },
  {
    name: 'Subscriptions',
    categories: [
      { name: 'Revolut Metal', isShared: false },
      { name: 'AI (GPT)', isShared: false },
      { name: 'YouTube', isShared: false },
      { name: 'Spotify', isShared: false },
      { name: 'YNAB', isShared: false },
    ],
  },
  {
    name: 'Savings & Investment',
    categories: [
      { name: 'Savings', isShared: false },
      { name: 'Emergency Fund', isShared: false },
    ],
  },
  {
    name: 'Goals',
    categories: [
      { name: 'PS5', isShared: false },
      { name: 'Boat License', isShared: false },
    ],
  },
  {
    name: 'True Expenses',
    categories: [
      { name: 'Haircut', isShared: false },
      { name: 'Home & Office', isShared: false },
      { name: 'Medical', isShared: false },
      { name: 'Nutritionist', isShared: false },
      { name: 'Transportation', isShared: false },
    ],
  },
  {
    name: 'Just for Fun',
    categories: [
      { name: 'Coffee & Drink', isShared: false },
      { name: 'Food Out', isShared: false },
      { name: 'Drink Out', isShared: false },
      { name: 'Food Delivery', isShared: false },
      { name: 'Dining Out', isShared: false },
      { name: 'Temu/Impulse', isShared: false },
      { name: 'Fun Money', isShared: false },
    ],
  },
  {
    name: 'Personal Care',
    categories: [
      { name: 'Nails', isShared: false },
      { name: 'Face & Body', isShared: false },
    ],
  },
  {
    name: 'Quality of Life',
    categories: [
      { name: 'Education', isShared: false },
      { name: 'Vacation', isShared: false },
    ],
  },
  {
    name: 'Additional Expenses',
    categories: [
      { name: 'Other', isShared: false },
    ],
  },
]

export function buildDefaultGroups(): GroupEntry[] {
  return DEFAULT_GROUP_DEFS.map(g => ({
    id: genId(),
    name: g.name,
    enabled: true,
  }))
}

export function buildDefaultCategories(groups: GroupEntry[]): CategoryEntry[] {
  const cats: CategoryEntry[] = []
  for (let i = 0; i < groups.length; i++) {
    const groupDef = DEFAULT_GROUP_DEFS.find(d => d.name === groups[i].name)
    if (!groupDef) continue
    for (const c of groupDef.categories) {
      cats.push({
        id: genId(),
        groupId: groups[i].id,
        name: c.name,
        enabled: true,
        isShared: c.isShared,
        customSplit: null,
        targetAmount: null,
      })
    }
  }
  return cats
}

const defaultGroups = buildDefaultGroups()
const defaultCategories = buildDefaultCategories(defaultGroups)

export const DEFAULT_WIZARD_DATA: WizardData = {
  basics: {
    currency: 'EUR',
    shareExpenses: true,
    splitPreset: '50',
    splitCustomValue: 50,
    savingsTarget: 100,
  },
  income: {
    salary: { amount: 0, paymentDay: null },
    hasBonus: false,
    bonuses: [],
    otherIncome: [],
  },
  groups: defaultGroups,
  categories: defaultCategories,
  fixedExpenses: [],
  irregularExpenses: [],
}

export function getSplitDecimal(basics: BasicsData): number {
  if (!basics.shareExpenses) return 1
  const val = basics.splitPreset === 'custom'
    ? basics.splitCustomValue
    : parseInt(basics.splitPreset, 10)
  return val / 100
}

// ── API payload (what gets sent to POST /api/onboarding) ─────────────────────

export interface OnboardingPayload {
  settings: {
    currency: string
    shared_split_user: number
    savings_target: number
    share_expenses: string
  }
  income: {
    salary: SalaryEntry
    bonuses: Omit<BonusEntry, 'id'>[]
    otherIncome: Omit<OtherIncomeEntry, 'id'>[]
  }
  groups: Array<{
    name: string
    categories: Array<{
      name: string
      isShared: boolean
      customSplit: number | null
      targetAmount: number | null
    }>
  }>
}


export function buildPayload(data: WizardData): OnboardingPayload {
  const enabledGroups = data.groups.filter(g => g.enabled)
  return {
    settings: {
      currency: data.basics.currency,
      shared_split_user: getSplitDecimal(data.basics),
      savings_target: data.basics.savingsTarget,
      share_expenses: String(data.basics.shareExpenses),
    },
    income: {
      salary: data.income.salary,
      bonuses: data.income.hasBonus
        ? data.income.bonuses.map(({ id: _id, ...b }) => b)
        : [],
      otherIncome: data.income.otherIncome.map(({ id: _id, ...o }) => o),
    },
    groups: enabledGroups.map(g => ({
      name: g.name,
      categories: data.categories
        .filter(c => c.groupId === g.id && c.enabled)
        .map(c => ({
          name: c.name,
          isShared: c.isShared,
          customSplit: c.customSplit,
          targetAmount: c.targetAmount,
        })),
    })),
  }
}

export function canProceed(step: number, data: WizardData): boolean {
  switch (step) {
    case 1:
      return data.basics.savingsTarget >= 0 &&
        (!data.basics.shareExpenses || getSplitDecimal(data.basics) > 0)
    case 2:
      return data.income.salary.amount > 0 &&
        (!data.income.hasBonus ||
          (data.income.bonuses.length > 0 &&
            data.income.bonuses.every(b => b.name.trim() !== '' && b.amount > 0)))
    case 3:
      return data.groups.some(g => g.enabled)
    case 4:
      return data.categories.some(c => c.enabled)
    case 5:
      return true
    default:
      return false
  }
}
