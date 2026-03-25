export interface IncomeEntry {
  id: number
  name: string
  amount: number
  type: 'salary' | 'bonus' | 'one-off'
  expected_month: number | null
  isRecurring: boolean
  due_day: number | null
  notes: string | null
  created_at: string
}

export interface ForecastPeriod {
  months: number
  total: number
  bonusMonths: { month: number; label: string; amount: number }[]
}

export interface NextBonus {
  month: number; label: string; name: string; amount: number; monthsAway: number
}

export interface IncomeApiResponse {
  income: IncomeEntry[]
  summary: { monthlyBase: number; annualExtras: number }
  forecast: ForecastPeriod[]
  nextBonus: NextBonus | null
}

export const TYPE_LABELS: Record<string, string> = {
  salary:   'Salary',
  bonus:    'Bonus',
  'one-off': 'One-off',
}

export const TYPE_STYLES: Record<string, string> = {
  salary:   'bg-blue-950/60 text-blue-400 border-blue-900',
  bonus:    'bg-amber-950/60 text-amber-400 border-amber-900',
  'one-off': 'bg-purple-950/60 text-purple-400 border-purple-900',
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
