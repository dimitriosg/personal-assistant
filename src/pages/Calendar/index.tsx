import { useEffect, useState, useCallback } from 'react'
import { get } from '../../lib/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Math.abs(n))

type EventType = 'income' | 'target' | 'transaction'

interface CalendarEvent {
  day:    number
  type:   EventType
  label:  string
  amount: number
  color:  string
}

interface CalendarData {
  month:          string
  year:           number
  monthNum:       number
  daysInMonth:    number
  firstDayOfWeek: number
  events:         CalendarEvent[]
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DOT_COLORS: Record<string, string> = {
  red:    'bg-red-500',
  green:  'bg-green-500',
  blue:   'bg-blue-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
}

export default function Calendar() {
  const [data, setData]             = useState<CalendarData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const loadData = useCallback(() => {
    setLoading(true)
    get<CalendarData>(`/calendar/${monthStr}`)
      .then(d => { setData(d); setError(null) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [monthStr])

  useEffect(() => { loadData() }, [loadData])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const eventsForDay = (day: number) =>
    data?.events.filter(e => e.day === day) ?? []

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : []

  // Build calendar grid
  const cells: Array<{ day: number | null }> = []
  if (data) {
    // Empty cells before first day
    for (let i = 0; i < data.firstDayOfWeek; i++) {
      cells.push({ day: null })
    }
    for (let d = 1; d <= data.daysInMonth; d++) {
      cells.push({ day: d })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Calendar</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          See when money moves — bills, income, and targets.
        </p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        <button
          type="button"
          onClick={prevMonth}
          className="px-3 py-1 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm font-semibold text-gray-200">
          {MONTHS[month - 1]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="px-3 py-1 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Expenses</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Income</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Targets</span>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600 text-sm py-12 text-center">Loading…</div>
      ) : data && (
        <>
          {/* Calendar grid */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 text-center text-xs text-gray-500 border-b border-gray-800">
              {DAY_HEADERS.map(d => (
                <div key={d} className="py-2 font-medium">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
                const dayEvents = cell.day ? eventsForDay(cell.day) : []
                const isToday = cell.day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear()
                const isSelected = cell.day === selectedDay

                return (
                  <div
                    key={idx}
                    onClick={() => cell.day && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
                    className={`
                      min-h-[72px] p-1.5 border-b border-r border-gray-800/50 cursor-pointer
                      transition-colors hover:bg-gray-800/40
                      ${isSelected ? 'bg-indigo-950/40 ring-1 ring-indigo-500' : ''}
                      ${!cell.day ? 'bg-gray-950/30' : ''}
                    `}
                  >
                    {cell.day && (
                      <>
                        <div className={`text-xs mb-1 ${
                          isToday ? 'text-indigo-400 font-bold' : 'text-gray-500'
                        }`}>
                          {cell.day}
                        </div>
                        {/* Event dots */}
                        <div className="flex flex-wrap gap-0.5">
                          {dayEvents.slice(0, 5).map((e, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[e.color] ?? 'bg-gray-600'}`}
                              title={e.label}
                            />
                          ))}
                          {dayEvents.length > 5 && (
                            <span className="text-[10px] text-gray-600">+{dayEvents.length - 5}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {MONTHS[month - 1]} {selectedDay}, {year}
              </h2>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-600">No events on this day.</p>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                  {selectedEvents.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[e.color] ?? 'bg-gray-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200">{e.label}</div>
                        <div className="text-xs text-gray-500 capitalize">{e.type}</div>
                      </div>
                      <div className={`text-sm font-medium tabular-nums ${
                        e.amount < 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {e.amount < 0 ? '-' : '+'}{fmt(e.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
