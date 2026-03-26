interface ChatMessageProps {
  role: 'user' | 'gpt4o_mini' | 'haiku'
  content: string
  isStreaming?: boolean
}

const ROLE_CONFIG = {
  user: {
    label: 'You',
    labelColor: 'text-gray-400',
    bg: 'bg-[#2a2a4a]',
    align: 'items-end',
  },
  gpt4o_mini: {
    label: '◆ GPT-4o Mini',
    labelColor: 'text-blue-400',
    bg: 'bg-[#1e1e36]',
    align: 'items-start',
  },
  haiku: {
    label: '◆ Claude Haiku',
    labelColor: 'text-purple-400',
    bg: 'bg-[#1e1e36]',
    align: 'items-start',
  },
} as const

export default function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const config = ROLE_CONFIG[role]

  return (
    <div className={`flex flex-col ${config.align} w-full`}>
      <span className={`text-[11px] font-semibold ${config.labelColor} mb-1`}>
        {config.label}
      </span>
      <div
        className={`${config.bg} rounded-lg px-3 py-2 max-w-[80%] text-sm text-gray-100 whitespace-pre-wrap break-words`}
      >
        {content}
        {isStreaming && (
          <span className="inline-block animate-pulse ml-0.5">▌</span>
        )}
      </div>
    </div>
  )
}
