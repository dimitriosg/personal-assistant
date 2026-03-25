// ── Budget page types ─────────────────────────────────────────────────────────

export interface CategoryTarget {
  id: number
  target_type: 'monthly' | 'by_date' | 'savings_goal'
  target_amount: number
  target_date: string | null
  is_recurring: boolean
}

export interface BudgetCategory {
  id: number
  name: string
  group_id: number
  is_shared: boolean
  custom_split: number | null
  sort_order: number
  assigned: number
  activity: number
  available: number
  target: CategoryTarget | null
}

export interface GroupTotals {
  assigned: number
  activity: number
  available: number
}

export interface BudgetGroup {
  id: number
  name: string
  sort_order: number
  is_collapsed: boolean
  categories: BudgetCategory[]
  totals: GroupTotals
}

export interface BudgetData {
  month: string
  readyToAssign: number
  totalAssigned: number
  totalIncome: number
  groups: BudgetGroup[]
}

export interface SummaryData {
  month: string
  leftOverFromLastMonth: number
  assignedThisMonth: number
  activityThisMonth: number
  available: number
  targetsThisMonth: number
  expectedIncome: number
  underfunded: number
  assignedLastMonth: number
  spentLastMonth: number
  averageAssigned: number
  averageSpent: number
}
