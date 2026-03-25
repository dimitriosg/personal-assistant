export type Verdict = 'buy' | 'wait' | 'reject'
export type Category = 'need' | 'useful' | 'comfort' | 'impulse'
export type Urgency = 'high' | 'medium' | 'low'

export interface StressTestResult {
  id: number
  item: string
  price: number
  category: string
  urgency: string
  verdict: Verdict
  reason: string
  date: string
  category_id: number | null
  budgetCategoryName?: string | null
  // expanded fields
  rule?: number
  why?: string
  risk?: string
  nextMove?: string
  context?: {
    categoryAvailable: number
    categoryName: string
    readyToAssign: number
    afterPurchase: number
    sameGroupTargets: number
    bonusNextMonth: { name: string; amount: number; label: string } | null
  }
}

export interface CategoryGroup {
  id: number
  name: string
  categories: Array<{ id: number; name: string }>
}

export const CATEGORY_LABELS: Record<Category, string> = {
  need:    'Need',
  useful:  'Useful',
  comfort: 'Comfort',
  impulse: 'Impulse',
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

export const VERDICT_STYLES: Record<Verdict, { bg: string; border: string; text: string; label: string }> = {
  buy:    { bg: 'bg-green-950/60',  border: 'border-green-800',  text: 'text-green-400',  label: 'Buy' },
  wait:   { bg: 'bg-amber-950/60',  border: 'border-amber-800',  text: 'text-amber-400',  label: 'Wait' },
  reject: { bg: 'bg-red-950/60',    border: 'border-red-800',    text: 'text-red-400',    label: "Don't Buy" },
}
