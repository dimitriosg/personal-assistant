import { useState } from 'react'

const QUICK_ACTIONS = [
  { label: 'Where am I overspending?', message: 'Where am I overspending this month? Show me the categories that are over budget and suggest how to fix them.' },
  { label: 'Can I afford something?', message: null, promptUser: true },
  { label: 'What should I postpone?', message: 'Based on my current budget, which categories or targets should I postpone this month to reduce financial stress?' },
  { label: 'Am I on track?', message: 'Give me a brief overall assessment of my budget this month. Am I on track, overspending, or doing well?' },
  { label: 'Review my subscriptions', message: 'List all my subscription categories, their assigned amounts, and flag any that I haven\'t actually spent money on this month.' },
] as const

const MODELS = [
  { value: 'gpt4o_mini', label: 'GPT-4o Mini' },
  { value: 'haiku', label: 'Claude Haiku' },
] as const

export default function Assistant() {
  const [model, setModel] = useState<string>('gpt4o_mini')
  const [compareMode, setCompareMode] = useState(false)
  const [input, setInput] = useState('')

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <h1 className="text-sm font-semibold text-gray-100">AI Assistant</h1>
        <div className="flex items-center gap-3">
          {!compareMode && (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setCompareMode(c => !c)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              compareMode
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
            }`}
          >
            {compareMode ? '← Single Mode' : '⇄ Compare Mode'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel: Conversation History (desktop only, hidden in compare mode) ── */}
        {!compareMode && (
          <aside className="hidden md:flex flex-col w-[200px] shrink-0 bg-gray-900/60 border-r border-gray-800">
            <div className="p-3">
              <button
                type="button"
                className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                + New Conversation
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <p className="text-xs text-gray-600 text-center mt-6">No conversations yet</p>
            </div>
          </aside>
        )}

        {/* ── Main chat area ── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Chat messages (empty state with quick actions) */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <p className="text-gray-500 text-sm">Ask anything about your budget</p>
              </div>

              {/* Quick action chips */}
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Input bar ── */}
          <div className="shrink-0 border-t border-gray-800 px-4 py-3 bg-gray-900/40">
            <form
              onSubmit={e => { e.preventDefault() }}
              className="flex items-center gap-2 max-w-3xl mx-auto"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={compareMode ? 'Type a question for both models…' : 'Type a question…'}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
