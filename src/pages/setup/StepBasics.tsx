import type { BasicsData, SplitPreset } from './types'

interface Props {
  data: BasicsData
  onChange: (data: BasicsData) => void
}

const SPLIT_OPTIONS: { label: string; value: SplitPreset }[] = [
  { label: '50 / 50', value: '50' },
  { label: '60 / 40', value: '60' },
  { label: '40 / 60', value: '40' },
  { label: 'Custom', value: 'custom' },
]

const input = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors'
const label = 'block text-sm text-gray-400 mb-1.5'

export default function StepBasics({ data, onChange }: Props) {
  const set = <K extends keyof BasicsData>(key: K, value: BasicsData[K]) =>
    onChange({ ...data, [key]: value })

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Let's set up the basics</h2>
        <p className="text-sm text-gray-500">These settings shape how your money is calculated.</p>
      </div>

      {/* Currency */}
      <div>
        <label className={label}>Currency</label>
        <select
          value={data.currency}
          onChange={e => set('currency', e.target.value as 'EUR')}
          className={input}
        >
          <option value="EUR">EUR — Euro</option>
        </select>
        <p className="text-xs text-gray-600 mt-1">More currencies can be added later.</p>
      </div>

      {/* Share expenses */}
      <div>
        <label className={label}>Do you share expenses with someone?</label>
        <div className="flex gap-3">
          {[true, false].map(val => (
            <button
              key={String(val)}
              type="button"
              onClick={() => set('shareExpenses', val)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                ${data.shareExpenses === val
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Split percentage — only shown when sharing */}
      {data.shareExpenses && (
        <div>
          <label className={label}>Your share of shared expenses</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {SPLIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('splitPreset', opt.value)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors
                  ${data.splitPreset === opt.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {data.splitPreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={data.splitCustomValue}
                onChange={e => set('splitCustomValue', Math.min(99, Math.max(1, Number(e.target.value))))}
                className={`${input} w-24`}
              />
              <span className="text-gray-400 text-sm">% is your share</span>
            </div>
          )}
          {data.splitPreset !== 'custom' && (
            <p className="text-xs text-gray-500">
              Your share: {data.splitPreset}% &nbsp;·&nbsp; Partner's share: {100 - parseInt(data.splitPreset, 10)}%
            </p>
          )}
        </div>
      )}

      {/* Savings target */}
      <div>
        <label className={label}>Monthly savings target (EUR)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
          <input
            type="number"
            min={0}
            step={10}
            value={data.savingsTarget}
            onChange={e => set('savingsTarget', Math.max(0, Number(e.target.value)))}
            className={`${input} pl-7`}
            placeholder="100"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          The minimum buffer you want left after all expenses. Can be 0.
        </p>
      </div>
    </div>
  )
}
