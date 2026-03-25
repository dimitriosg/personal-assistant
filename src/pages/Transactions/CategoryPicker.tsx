import type { CategoryGroup } from './types'

interface Props {
  value: number | null
  groups: CategoryGroup[]
  onChange: (id: number | null) => void
  className?: string
}

export default function CategoryPicker({ value, groups, onChange, className = '' }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className={`bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
        text-sm text-gray-200 outline-none focus:border-indigo-500 ${className}`}
    >
      <option value="">Uncategorized</option>
      {groups.map(g => (
        <optgroup key={g.id} label={g.name}>
          {g.categories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
