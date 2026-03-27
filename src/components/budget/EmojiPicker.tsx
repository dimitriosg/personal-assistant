import { useEffect, useRef } from 'react'

const EMOJIS = [
  '🏠','🔌','💧','📡','🛒','🏦','💳','🚗',
  '⛽','🔧','📱','💊','🎓','✈️','☕','🍕',
  '🍺','🎮','💇','💄','💰','🎯','📊','🛡️',
  '🎁','🏋️','🎵','📚','🌴','🐾','⚡','🔑',
  '💡','🧾','🏪','🛍️','🎬','🍔','🚀','💎',
]

interface EmojiPickerProps {
  currentEmoji: string | null
  onSelect: (emoji: string | null) => void
  onClose: () => void
}

export default function EmojiPicker({ currentEmoji, onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (currentEmoji !== null) {
          onSelect(null)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentEmoji, onSelect, onClose])

  function handleClick(emoji: string) {
    onSelect(emoji === currentEmoji ? null : emoji)
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 p-3 min-w-[320px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
    >
      <div className="grid grid-cols-8 gap-2 overflow-visible">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            className={`w-10 h-10 flex items-center justify-center rounded text-xl hover:bg-gray-700 transition-colors
              ${emoji === currentEmoji ? 'bg-indigo-500/30 ring-1 ring-indigo-500' : ''}`}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
