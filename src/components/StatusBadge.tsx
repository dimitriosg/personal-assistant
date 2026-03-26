// ── Status badge for budget categories ────────────────────────────────────────
//
// Shows a compact, color-coded badge indicating the funding status of a category.

export type BadgeStatus = 'funded' | 'underfunded' | 'overspent' | 'spent' | 'idle'

const STYLES: Record<BadgeStatus, string> = {
  funded:      'bg-green-950/60 border-green-900 text-green-400',
  underfunded: 'bg-yellow-950/60 border-yellow-900 text-yellow-400',
  overspent:   'bg-red-950/60 border-red-900 text-red-400',
  spent:       'bg-gray-800 border-gray-700 text-gray-500',
  idle:        'bg-gray-800 border-gray-700 text-gray-600',
}

const LABELS: Record<BadgeStatus, string> = {
  funded:      'Funded',
  underfunded: 'Underfunded',
  overspent:   'Overspent',
  spent:       'Fully Spent',
  idle:        '—',
}

interface Props {
  status: BadgeStatus
}

export default function StatusBadge({ status }: Props) {
  if (status === 'idle') return null
  return (
    <span className={`text-[10px] leading-none px-1.5 py-0.5 rounded border whitespace-nowrap ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}

/**
 * Derives the badge status from category data.
 * - available > 0 && target met → funded
 * - available > 0 && target exists but not met → underfunded
 * - available < 0 → overspent
 * - available === 0 && activity < 0 → fully spent
 * - otherwise → idle (no badge shown)
 */
export function deriveStatus(
  available: number,
  assigned: number,
  activity: number,
  targetAmount: number | null,
): BadgeStatus {
  if (available < 0) return 'overspent'
  if (targetAmount != null && assigned < targetAmount) return 'underfunded'
  if (available > 0) return 'funded'
  if (available === 0 && activity < 0) return 'spent'
  return 'idle'
}
