// ── Transaction page types ────────────────────────────────────────────────────

export interface Account {
  id: number
  name: string
  type: 'budget' | 'tracking'
  account_type: string
  balance: number
  currency: string
  is_closed: number
  sort_order: number
  created_at: string
}

export interface Transaction {
  id: number
  date: string
  payee: string | null
  category_id: number | null
  memo: string | null
  amount: number
  cleared: boolean
  created_at: string
  runningBalance: number
}

export interface CategoryOption {
  id: number
  name: string
  group_id: number
  is_shared: number
  custom_split: number | null
  sort_order: number
  hidden: number
}

export interface CategoryGroup {
  id: number
  name: string
  sort_order: number
  is_collapsed: number
  categories: CategoryOption[]
}

export type SortField = 'date' | 'payee' | 'category' | 'memo' | 'amount' | 'runningBalance'
export type SortDir = 'asc' | 'desc'

export interface Filters {
  month: string
  category_id: string
  account_id: string
  payee: string
  type: '' | 'inflow' | 'outflow'
  search: string
}
