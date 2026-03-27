// ── Available amount badge ────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

interface AvailableBadgeProps {
  amount: number
  isFunded: boolean   // assigned >= target_amount (target must exist)
  hasTarget: boolean  // whether category has a target set
}

/**
 * Renders the available amount with contextual styling:
 * - amount < 0:                         red pill
 * - amount > 0, funded, has target:     green pill
 * - amount > 0, not funded or no target: plain green text
 * - amount === 0:                        plain gray text
 */
export default function AvailableBadge({ amount, isFunded, hasTarget }: AvailableBadgeProps) {
  if (amount < 0) {
    return (
      <span className="rounded-full bg-red-500/20 text-red-400 px-2 py-0.5 text-sm font-medium tabular-nums">
        {fmt(amount)}
      </span>
    )
  }

  if (amount > 0 && isFunded && hasTarget) {
    return (
      <span className="rounded-full bg-green-500/20 text-green-400 px-2 py-0.5 text-sm font-medium tabular-nums">
        {fmt(amount)}
      </span>
    )
  }

  if (amount > 0) {
    return (
      <span className="text-green-400 text-sm tabular-nums">
        {fmt(amount)}
      </span>
    )
  }

  // amount === 0 (all other cases are handled above)
  return (
    <span className="text-gray-500 text-sm tabular-nums">
      {fmt(amount)}
    </span>
  )
}
