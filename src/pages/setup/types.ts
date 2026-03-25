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

// ── Step 3 ────────────────────────────────────────────────────────────────────

export interface FixedExpenseEntry {
  id: string
  name: string
  amount: number
  isShared: boolean
  customSplit: number | null   // 0–1 decimal, null = use global
  recurrence: Recurrence
  dueDay: number | null
  dueMonth: number | null
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

export interface IrregularExpenseEntry {
  id: string
  name: string
  amount: number
  expectedMonth: number   // 1–12
  isShared: boolean
  customSplit: number | null   // 0–1 decimal, null = use global
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface WizardData {
  basics: BasicsData
  income: IncomeData
  fixedExpenses: FixedExpenseEntry[]
  irregularExpenses: IrregularExpenseEntry[]
}

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
  fixedExpenses: Omit<FixedExpenseEntry, 'id'>[]
  irregularExpenses: Omit<IrregularExpenseEntry, 'id'>[]
}


export function buildPayload(data: WizardData): OnboardingPayload {
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
    fixedExpenses: data.fixedExpenses.map(({ id: _id, ...e }) => e),
    irregularExpenses: data.irregularExpenses.map(({ id: _id, ...e }) => e),
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
      return data.fixedExpenses.every(e => e.name.trim() !== '' && e.amount > 0)
    case 4:
      return data.irregularExpenses.every(e => e.name.trim() !== '' && e.amount > 0)
    case 5:
      return true
    default:
      return false
  }
}
