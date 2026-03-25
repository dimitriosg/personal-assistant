import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  payees: string[]
  onChange: (v: string) => void
  className?: string
}

export default function PayeeInput({ value, payees, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? payees.filter(p => p.toLowerCase().includes(value.toLowerCase()))
    : payees

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      onChange(filtered[highlighted])
      setOpen(false)
      setHighlighted(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Payee"
        className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
          text-sm text-gray-200 outline-none focus:border-indigo-500 ${className}`}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-700
          bg-gray-800 shadow-lg">
          {filtered.slice(0, 20).map((p, i) => (
            <li
              key={p}
              onMouseDown={() => { onChange(p); setOpen(false) }}
              className={`px-3 py-1.5 text-sm cursor-pointer ${
                i === highlighted ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-300 hover:bg-gray-700/60'
              }`}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
