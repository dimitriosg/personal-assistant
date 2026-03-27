// ── Emoji picker popover ──────────────────────────────────────────────────────
//
// A fixed grid of 40 finance-oriented emojis (8 columns × 5 rows).
// Closes on outside click (mousedown listener) or Escape key.
// Pressing Escape or clicking the currently active emoji clears the selection.

import { useEffect, useRef } from 'react'

const EMOJIS: string[] = [
  '🏠','🔌','💧','📡','🛒','🏦','💳','🚗',
  '⛽','🔧','📱','💊','🎓','✈️','☕','🍕',
  '🍺','🎮','💇','💄','💰','🎯','📊','🛡️',
  '🎁','🏋️','🎵','📚','🌴','🐾','⚡','🔑',
  '💡','🧾','🏪','🛍️','🎬','🍔','🚀','💎',
]

interface EmojiPickerProps {
  /** Currently selected emoji for this category, or null if none. */
  currentEmoji: string | null
  /**
   * Called when the user picks an emoji or clears the selection.
   * Receives null when the active emoji is clicked again or Escape is pressed.
   */
  onSelect: (emoji: string | null) => void
  /** Called when the picker should close without changing the emoji (outside click). */
  onClose: () => void
}

export default function EmojiPicker({ currentEmoji, onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside mousedown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Escape: clear emoji if one is set, otherwise just close
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
    // Clicking the currently active emoji clears it
    onSelect(emoji === currentEmoji ? null : emoji)
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl"
    >
      <div className="grid grid-cols-8 gap-2">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleClick(emoji)}
            className={`w-10 h-10 p-0.5 flex items-center justify-center rounded text-xl hover:bg-gray-700 transition-colors
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
