import { useState, useRef, useEffect, useCallback } from 'react'
import { useAIStream } from '../../hooks/useAIStream'
import { useCompareStream } from '../../hooks/useCompareStream'
import ChatMessage from '../../components/assistant/ChatMessage'
import ConversationHistory from '../../components/assistant/ConversationHistory'
import ComparePanels from '../../components/assistant/ComparePanels'

const QUICK_ACTIONS = [
  { label: 'Where am I overspending?', message: 'Looking at my current budget, which categories am I overspending in and by how much?' },
  { label: 'Can I afford something?', message: null as string | null, promptUser: true },
  { label: 'What should I postpone?', message: 'Based on my current budget, which categories or targets should I postpone this month to reduce financial stress?' },
  { label: 'Am I on track?', message: 'Give me a brief overall assessment of my budget this month. Am I on track, overspending, or doing well?' },
  { label: 'Review my subscriptions', message: 'List all my subscription categories, their assigned amounts, and flag any that I haven\'t actually spent money on this month.' },
] as const

const MODELS = [
  { value: 'gpt4o_mini', label: 'GPT-4o Mini' },
  { value: 'haiku', label: 'Claude Haiku' },
] as const

type ModelRole = 'gpt4o_mini' | 'haiku'

interface Message {
  id: string
  role: 'user' | ModelRole
  content: string
}

export default function Assistant() {
  const [model, setModel] = useState<string>('gpt4o_mini')
  const [compareMode, setCompareMode] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [compareQuestion, setCompareQuestion] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // "Can I afford?" inline form state
  const [showAffordForm, setShowAffordForm] = useState(false)
  const [affordItem, setAffordItem] = useState('')
  const [affordAmount, setAffordAmount] = useState('')

  const { content: streamContent, isStreaming, error, send, reset } = useAIStream('/api/ai/chat')
  const compare = useCompareStream()

  const anyStreaming = isStreaming || compare.isStreaming

  // Auto-scroll to bottom when new messages or streaming content arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent, compare.gptContent, compare.haikuContent])

  // When single-mode streaming finishes, commit the streamed content as a message and refresh sidebar
  const prevStreamingRef = useRef(false)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && streamContent) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: model as ModelRole, content: streamContent }])
      setRefreshTrigger(n => n + 1)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, streamContent, model])

  // When compare-mode streaming finishes, refresh sidebar
  const prevCompareStreamingRef = useRef(false)
  useEffect(() => {
    if (prevCompareStreamingRef.current && !compare.isStreaming) {
      setRefreshTrigger(n => n + 1)
    }
    prevCompareStreamingRef.current = compare.isStreaming
  }, [compare.isStreaming])

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || anyStreaming) return

    if (compareMode) {
      setCompareQuestion(text.trim())
      setInput('')
      compare.send({
        message: text.trim(),
        conversationId,
      })
    } else {
      const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
      setMessages(prev => [...prev, userMessage])
      setInput('')

      // Build history for multi-turn: convert our roles to the API's expected format
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      }))

      send({
        model,
        message: text.trim(),
        conversationId,
        history,
      })
    }
  }, [anyStreaming, compareMode, messages, model, conversationId, send, compare])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (action.promptUser) {
      setShowAffordForm(true)
      return
    }
    if (!action.message) return
    handleSend(action.message)
  }

  const handleAffordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!affordItem.trim() || !affordAmount.trim()) return
    const msg = `Can I afford ${affordItem.trim()} that costs EUR ${affordAmount.trim()} this month?\nWhich category would it come from?`
    setShowAffordForm(false)
    setAffordItem('')
    setAffordAmount('')
    handleSend(msg)
  }

  const handleAffordDismiss = () => {
    setShowAffordForm(false)
    setAffordItem('')
    setAffordAmount('')
  }

  const handleNewConversation = () => {
    setMessages([])
    setInput('')
    setConversationId(crypto.randomUUID())
    setCompareQuestion(null)
    reset()
    compare.reset()
  }

  const handleSelectConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`)
      if (!res.ok) return
      const rows = await res.json() as Array<{ role: string; content: string }>
      setConversationId(id)
      setMessages(rows.map(r => ({
        id: crypto.randomUUID(),
        role: r.role as Message['role'],
        content: r.content,
      })))
      setCompareQuestion(null)
      reset()
      compare.reset()
      if (compareMode) setCompareMode(false)
    } catch {
      // Silently fail
    }
  }

  const handleSelectAnswer = (selectedModel: 'gpt4o_mini' | 'haiku', content: string) => {
    // Switch to single mode with the selected model and add the answer as a message
    const question = compareQuestion || ''
    setMessages([
      { id: crypto.randomUUID(), role: 'user', content: question },
      { id: crypto.randomUUID(), role: selectedModel, content },
    ])
    setModel(selectedModel)
    setCompareMode(false)
    setCompareQuestion(null)
    compare.reset()
  }

  const hasMessages = messages.length > 0 || isStreaming
  const hasCompareContent = compareQuestion !== null

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
              disabled={anyStreaming}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              setCompareMode(c => !c)
              setCompareQuestion(null)
              compare.reset()
            }}
            disabled={anyStreaming}
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
          <ConversationHistory
            activeConversationId={conversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            refreshTrigger={refreshTrigger}
          />
        )}

        {/* ── Main chat area ── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {compareMode ? (
              /* Compare mode */
              !hasCompareContent ? (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Ask a question to compare both models</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                    {showAffordForm ? (
                      <form onSubmit={handleAffordSubmit} className="flex flex-col gap-2 w-full max-w-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Can I afford…</span>
                          <button type="button" onClick={handleAffordDismiss} className="text-gray-500 hover:text-gray-300 text-sm leading-none">✕</button>
                        </div>
                        <input
                          type="text"
                          value={affordItem}
                          onChange={e => setAffordItem(e.target.value)}
                          placeholder="Item name"
                          autoFocus
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="number"
                          value={affordAmount}
                          onChange={e => setAffordAmount(e.target.value)}
                          placeholder="Amount (EUR)"
                          min="0"
                          step="0.01"
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!affordItem.trim() || !affordAmount.trim()}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                        >
                          Ask →
                        </button>
                      </form>
                    ) : (
                      QUICK_ACTIONS.map(action => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => handleQuickAction(action)}
                          className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                        >
                          {action.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 max-w-5xl mx-auto">
                  {/* Show the user's question */}
                  <ChatMessage role="user" content={compareQuestion!} />
                  {/* Side-by-side panels */}
                  <ComparePanels
                    gptContent={compare.gptContent}
                    haikuContent={compare.haikuContent}
                    gptDone={compare.gptDone}
                    haikuDone={compare.haikuDone}
                    gptStarted={compare.gptStarted}
                    haikuStarted={compare.haikuStarted}
                    isStreaming={compare.isStreaming}
                    error={compare.error}
                    onSelectAnswer={handleSelectAnswer}
                  />
                  <div ref={chatEndRef} />
                </div>
              )
            ) : !hasMessages ? (
              /* Empty state with quick actions */
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Ask anything about your budget</p>
                </div>

                {/* Quick action chips */}
                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {showAffordForm ? (
                    <form onSubmit={handleAffordSubmit} className="flex flex-col gap-2 w-full max-w-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Can I afford…</span>
                        <button type="button" onClick={handleAffordDismiss} className="text-gray-500 hover:text-gray-300 text-sm leading-none">✕</button>
                      </div>
                      <input
                        type="text"
                        value={affordItem}
                        onChange={e => setAffordItem(e.target.value)}
                        placeholder="Item name"
                        autoFocus
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <input
                        type="number"
                        value={affordAmount}
                        onChange={e => setAffordAmount(e.target.value)}
                        placeholder="Amount (EUR)"
                        min="0"
                        step="0.01"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!affordItem.trim() || !affordAmount.trim()}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                      >
                        Ask →
                      </button>
                    </form>
                  ) : (
                    QUICK_ACTIONS.map(action => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Messages list */
              <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {isStreaming && (
                  <ChatMessage
                    role={model as ModelRole}
                    content={streamContent}
                    isStreaming
                  />
                )}
                {error && (
                  <div className="text-red-400 text-sm text-center py-2">
                    {error}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          <div className="shrink-0 border-t border-gray-800 px-4 py-3 bg-gray-900/40">
            {(error || compare.error) && (
              <p className="text-red-400 text-xs text-center mb-2">{error || compare.error}</p>
            )}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 max-w-3xl mx-auto"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={compareMode ? 'Type a question for both models…' : 'Type a question…'}
                disabled={anyStreaming}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || anyStreaming}
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
