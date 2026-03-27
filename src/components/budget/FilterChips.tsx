export type BudgetFilter = 'all' | 'snoozed' | 'underfunded' | 'overfunded' | 'money_available'

const FILTERS: { key: BudgetFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'underfunded', label: 'Underfunded' },
  { key: 'overfunded', label: 'Overfunded' },
  { key: 'money_available', label: 'Money Available' },
]

interface Props {
  active: BudgetFilter
  onChange: (filter: BudgetFilter) => void
}

export default function FilterChips({ active, onChange }: Props) {
  const base = 'rounded-full px-3 py-1 text-sm'

  return (
    <div className="flex flex-wrap gap-2 px-3 sm:px-4 py-2">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={
            key === active
              ? `bg-[#6366f1] text-white ${base}`
              : `bg-[#2a2a4a] text-gray-400 hover:bg-[#3a3a5a] cursor-pointer ${base}`
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}
