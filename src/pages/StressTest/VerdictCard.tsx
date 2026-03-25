import { type StressTestResult, VERDICT_STYLES } from './types'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

export default function VerdictCard({ result }: { result: StressTestResult }) {
  const style = VERDICT_STYLES[result.verdict]

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${style.bg} ${style.border}`}>
      {/* Verdict header */}
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-bold ${style.text}`}>{style.label}</span>
        {result.rule && (
          <span className="text-xs text-gray-600 border border-gray-800 rounded px-1.5 py-0.5">
            Rule {result.rule}
          </span>
        )}
      </div>

      {/* Context bar */}
      {result.context && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
          <span>Category: <span className="text-gray-300">{result.context.categoryName}</span></span>
          <span>Available: <span className="text-gray-300">{fmt(result.context.categoryAvailable)}</span></span>
          <span>After purchase: <span className="text-gray-300">{fmt(result.context.afterPurchase)}</span></span>
          <span>Ready to Assign: <span className="text-gray-300">{fmt(result.context.readyToAssign)}</span></span>
          {result.context.sameGroupTargets > 0 && (
            <span>Targets in group (30d): <span className="text-amber-400">{result.context.sameGroupTargets}</span></span>
          )}
          {result.context.bonusNextMonth && (
            <span>Bonus next month: <span className="text-amber-400">{result.context.bonusNextMonth.label} {fmt(result.context.bonusNextMonth.amount)}</span></span>
          )}
        </div>
      )}

      {/* Why */}
      {result.why && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Why</p>
          <p className="text-sm text-gray-200">{result.why}</p>
        </div>
      )}

      {/* Risk */}
      {result.risk && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Risk</p>
          <p className="text-sm text-gray-300">{result.risk}</p>
        </div>
      )}

      {/* Next move */}
      {result.nextMove && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next move</p>
          <p className="text-sm text-gray-300">{result.nextMove}</p>
        </div>
      )}
    </div>
  )
}
