import { useEffect, useState, useCallback } from 'react'
import { get } from '../../lib/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n)

interface GroupData {
  name: string
  categories: Array<{ name: string; assigned: number; activity: number; available: number }>
  totals: { assigned: number; activity: number; available: number }
}

interface PromptData {
  month: string
  readyToAssign: number
  groups: GroupData[]
  overspent: Array<{ name: string; group: string; available: number }>
  unfundedTargets: Array<{ name: string; group: string; target_amount: number; available: number; gap: number }>
  forecast: Array<{ months: number; total: number }>
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function Prompt() {
  const [data, setData]       = useState<PromptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const loadData = useCallback(() => {
    setLoading(true)
    get<PromptData>(`/prompt?month=${month}`)
      .then(d => { setData(d); setError(null) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [month])

  useEffect(() => { loadData() }, [loadData])

  function generatePrompt(): string {
    if (!data) return ''

    const lines: string[] = []
    lines.push(`# My Budget Snapshot — ${monthLabel}`)
    lines.push('')
    lines.push(`**Ready to Assign:** ${fmt(data.readyToAssign)}`)
    lines.push('')

    // Category groups
    lines.push('## Budget by Category Group')
    lines.push('')
    for (const g of data.groups) {
      lines.push(`### ${g.name}`)
      lines.push(`| Category | Assigned | Activity | Available |`)
      lines.push(`|----------|----------|----------|-----------|`)
      for (const c of g.categories) {
        const avail = c.available < 0 ? `**${fmt(c.available)}** ⚠️` : fmt(c.available)
        lines.push(`| ${c.name} | ${fmt(c.assigned)} | ${fmt(c.activity)} | ${avail} |`)
      }
      lines.push(`| **Group Total** | **${fmt(g.totals.assigned)}** | **${fmt(g.totals.activity)}** | **${fmt(g.totals.available)}** |`)
      lines.push('')
    }

    // Overspent
    if (data.overspent.length > 0) {
      lines.push('## ⚠️ Overspent Categories')
      lines.push('')
      for (const o of data.overspent) {
        lines.push(`- **${o.name}** (${o.group}): ${fmt(o.available)}`)
      }
      lines.push('')
    }

    // Unfunded targets
    if (data.unfundedTargets.length > 0) {
      lines.push('## 🎯 Unfunded Targets')
      lines.push('')
      for (const t of data.unfundedTargets) {
        lines.push(`- **${t.name}** (${t.group}): needs ${fmt(t.gap)} more (target: ${fmt(t.target_amount)}, available: ${fmt(t.available)})`)
      }
      lines.push('')
    }

    // Forecast
    if (data.forecast.length > 0) {
      lines.push('## 📊 Income Forecast')
      lines.push('')
      for (const f of data.forecast) {
        lines.push(`- Next ${f.months} months: ${fmt(f.total)}`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
    lines.push('Based on this budget data, please help me with:')
    lines.push('1. Am I on track for the month?')
    lines.push('2. Which categories need attention?')
    lines.push('3. Any reallocation suggestions?')

    return lines.join('\n')
  }

  async function handleCopy() {
    const text = generatePrompt()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return <div className="text-gray-600 text-sm py-12 text-center">Loading…</div>
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
        {error}
      </div>
    )
  }

  const promptText = generatePrompt()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Prompt Generator</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Generate a pre-filled prompt with your real budget data for Claude.ai.
        </p>
      </div>

      {/* Quick stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-500">Ready to Assign</div>
            <div className={`text-sm font-bold ${data.readyToAssign >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(data.readyToAssign)}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-500">Groups</div>
            <div className="text-sm font-bold text-gray-200">{data.groups.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-500">Overspent</div>
            <div className={`text-sm font-bold ${data.overspent.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {data.overspent.length}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-500">Unfunded Targets</div>
            <div className={`text-sm font-bold ${data.unfundedTargets.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {data.unfundedTargets.length}
            </div>
          </div>
        </div>
      )}

      {/* Generated prompt */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Generated Prompt
          </h2>
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              copied
                ? 'bg-green-600/20 text-green-400 border border-green-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
        <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto leading-relaxed">
          {promptText}
        </pre>
      </div>

      {/* Overspent highlight */}
      {data && data.overspent.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            ⚠️ Overspent Categories
          </h2>
          <div className="bg-red-950/30 border border-red-900 rounded-xl divide-y divide-red-900/50">
            {data.overspent.map((o, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm text-gray-200">{o.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{o.group}</span>
                </div>
                <span className="text-sm text-red-400 font-medium tabular-nums">{fmt(o.available)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unfunded targets */}
      {data && data.unfundedTargets.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            🎯 Unfunded Targets
          </h2>
          <div className="bg-amber-950/30 border border-amber-900 rounded-xl divide-y divide-amber-900/50">
            {data.unfundedTargets.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm text-gray-200">{t.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{t.group}</span>
                </div>
                <span className="text-sm text-amber-400 font-medium tabular-nums">
                  needs {fmt(t.gap)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
