import { useEffect, useState, useCallback } from 'react'

interface ConversationItem {
  conversation_id: string
  preview: string | null
  model: string
  created_at: string
  message_count: number
}

interface ConversationHistoryProps {
  activeConversationId: string
  onSelect: (id: string) => void
  onNew: () => void
  refreshTrigger: number
}

function modelBadge(model: string) {
  if (model === 'compare') return { label: 'Compare', color: 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300' }
  if (model === 'claude-haiku-3-5' || model === 'haiku') return { label: 'Haiku', color: 'bg-purple-500/20 text-purple-400' }
  return { label: 'GPT', color: 'bg-blue-500/20 text-blue-400' }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ConversationHistory({ activeConversationId, onSelect, onNew, refreshTrigger }: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch {
      // Silently fail — sidebar is non-critical
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations, refreshTrigger])

  const handleDelete = async (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation()
    try {
      await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.conversation_id !== id))
    } catch {
      // Silently fail
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-[200px] shrink-0 bg-gray-900/60 border-r border-gray-800">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="text-xs text-gray-600 text-center mt-6">No conversations yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map(c => {
              const badge = modelBadge(c.model)
              const isActive = c.conversation_id === activeConversationId
              const isHovered = hoveredId === c.conversation_id
              return (
                <button
                  key={c.conversation_id}
                  type="button"
                  onClick={() => onSelect(c.conversation_id)}
                  onMouseEnter={() => setHoveredId(c.conversation_id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors relative group ${
                    isActive
                      ? 'bg-[#2a2a4a] text-gray-200'
                      : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-gray-600">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="truncate text-[11px] leading-tight pr-4">
                    {c.preview ? c.preview.slice(0, 40) : 'Empty conversation'}
                  </p>
                  {isHovered && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDelete(e, c.conversation_id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e, c.conversation_id) }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 text-xs cursor-pointer"
                    >
                      ×
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
