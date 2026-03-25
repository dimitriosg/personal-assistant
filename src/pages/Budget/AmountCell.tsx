// ── Color-coded amount cell ───────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

type Variant = 'default' | 'available' | 'activity'

interface Props {
  value: number
  variant?: Variant
  bold?: boolean
}

/**
 * Renders a color-coded EUR amount.
 *
 * - variant="available": green > 0, red < 0, gray = 0
 * - variant="activity":  red < 0 (spending), green > 0 (inflow), gray = 0
 * - variant="default":   plain text, no coloring
 */
export default function AmountCell({ value, variant = 'default', bold = false }: Props) {
  let colorClass = 'text-gray-300'

  if (variant === 'available') {
    if (value > 0) colorClass = 'text-green-400'
    else if (value < 0) colorClass = 'text-red-400'
    else colorClass = 'text-gray-600'
  } else if (variant === 'activity') {
    if (value < 0) colorClass = 'text-red-400'
    else if (value > 0) colorClass = 'text-green-400'
    else colorClass = 'text-gray-600'
  }

  return (
    <span className={`tabular-nums text-right ${colorClass} ${bold ? 'font-semibold' : ''}`}>
      {fmt(value)}
    </span>
  )
}
