interface ComparePanelsProps {
  gptContent: string
  haikuContent: string
  gptDone: boolean
  haikuDone: boolean
  gptStarted: boolean
  haikuStarted: boolean
  isStreaming: boolean
  error: string | null
  onSelectAnswer: (model: 'gpt4o_mini' | 'haiku', content: string) => void
}

export default function ComparePanels({
  gptContent,
  haikuContent,
  gptDone,
  haikuDone,
  gptStarted,
  haikuStarted,
  isStreaming,
  error,
  onSelectAnswer,
}: ComparePanelsProps) {
  const bothDone = gptDone && haikuDone && !isStreaming

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full">
      {/* GPT-4o Mini column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-semibold text-blue-400">◆ GPT-4o Mini</span>
          {isStreaming && !gptDone && !gptStarted && (
            <span className="text-[10px] text-blue-300/60 animate-pulse">Thinking...</span>
          )}
        </div>
        <div className="flex-1 bg-[#1e1e36] rounded-lg px-3 py-2 text-sm text-gray-100 whitespace-pre-wrap break-words min-h-[100px]">
          {gptContent}
          {isStreaming && !gptDone && gptStarted && (
            <span className="inline-block animate-pulse ml-0.5">▌</span>
          )}
          {!gptStarted && !gptDone && !isStreaming && !error && (
            <span className="text-gray-600 text-xs">Waiting for response...</span>
          )}
        </div>
        {bothDone && (
          <button
            type="button"
            onClick={() => onSelectAnswer('gpt4o_mini', gptContent)}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-blue-500/40 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors"
          >
            👍 Use this answer
          </button>
        )}
      </div>

      {/* Claude Haiku column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-semibold text-purple-400">◆ Claude Haiku</span>
          {isStreaming && !haikuDone && !haikuStarted && (
            <span className="text-[10px] text-purple-300/60 animate-pulse">Thinking...</span>
          )}
        </div>
        <div className="flex-1 bg-[#1e1e36] rounded-lg px-3 py-2 text-sm text-gray-100 whitespace-pre-wrap break-words min-h-[100px]">
          {haikuContent}
          {isStreaming && !haikuDone && haikuStarted && (
            <span className="inline-block animate-pulse ml-0.5">▌</span>
          )}
          {!haikuStarted && !haikuDone && !isStreaming && !error && (
            <span className="text-gray-600 text-xs">Waiting for response...</span>
          )}
        </div>
        {bothDone && (
          <button
            type="button"
            onClick={() => onSelectAnswer('haiku', haikuContent)}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-colors"
          >
            👍 Use this answer
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm text-center py-2 w-full">
          {error}
        </div>
      )}
    </div>
  )
}
