export interface Expense {
  id: number
  name: string
  amount: number
  myShare: number
  category: string
  isShared: boolean
  recurrence: string
  due_day: number | null
  due_month: number | null
  status: string
  notes: string | null
  custom_split: number | null
  created_at: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  fixed_shared:     'Fixed · Shared',
  fixed_personal:   'Fixed · Personal',
  variable_shared:  'Variable · Shared',
  variable_personal:'Variable · Personal',
  irregular:        'Irregular / One-off',
}

// Display order for category groups
export const CATEGORY_ORDER = [
  'fixed_shared',
  'fixed_personal',
  'variable_shared',
  'variable_personal',
  'irregular',
]

export const RECURRENCE_LABELS: Record<string, string> = {
  monthly:        'Monthly',
  annual:         'Annual',
  specific_month: 'Specific month',
  one_time:       'One-time',
}

export const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-950/60 text-green-400 border-green-900',
  upcoming: 'bg-yellow-950/60 text-yellow-400 border-yellow-900',
  paused:   'bg-gray-800 text-gray-500 border-gray-700',
  paid:     'bg-blue-950/60 text-blue-400 border-blue-900',
}

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Derive sensible is_shared default from category
export function defaultIsShared(category: string): boolean {
  return category === 'fixed_shared' || category === 'variable_shared'
}
