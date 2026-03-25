import { NavLink, Outlet, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Budget',           path: '/',              end: true },
  { label: 'Transactions',     path: '/transactions',  end: false },
  { label: 'Income',           path: '/income',        end: false },
  { label: 'Stress Test',      path: '/stress-test',   end: false },
  { label: 'Postpone',         path: '/postpone',      end: false },
  { label: 'Calendar',         path: '/calendar',      end: false },
  { label: 'Prompt',           path: '/prompt',        end: false },
  { label: 'Settings',         path: '/settings',      end: false },
]

// Bottom tabs shown on mobile (the 4 most-used pages)
const MOBILE_TABS = [
  { label: 'Budget',  path: '/',              end: true,  icon: HomeIcon },
  { label: 'Trans',   path: '/transactions',  end: false, icon: ListIcon },
  { label: 'Income',  path: '/income',        end: false, icon: CashIcon },
  { label: 'Settings',path: '/settings',      end: false, icon: GearIcon },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return `block px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
    isActive
      ? 'bg-indigo-600/20 text-indigo-400 font-medium'
      : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
  }`
}

function tabClass({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
    isActive ? 'text-indigo-400' : 'text-gray-600'
  }`
}

// Pages that manage their own layout (no max-width container / padding)
const FULL_BLEED_PAGES = ['/']

export default function Layout() {
  const location = useLocation()
  const isFullBleed = FULL_BLEED_PAGES.includes(location.pathname)

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* ── Left sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col w-[200px] shrink-0 bg-gray-900 border-r border-gray-800">
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-sm font-semibold text-gray-100 tracking-tight">Personal Assistant</span>
          <div className="text-xs text-gray-600 mt-0.5">Money module v2</div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden shrink-0 flex items-center px-4 py-3 bg-gray-900 border-b border-gray-800">
          <span className="text-sm font-semibold text-gray-100">Personal Assistant</span>
        </header>

        {/* Page content — full-bleed for budget page, contained for others */}
        {isFullBleed ? (
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
              <Outlet />
            </div>
          </main>
        )}

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden shrink-0 flex items-center justify-around px-2 py-2
          bg-gray-900 border-t border-gray-800">
          {MOBILE_TABS.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end} className={tabClass}>
              <item.icon />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

// ── Minimal inline SVG icons ──────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0v7a1 1 0 001 1h3m10-11l2 2m-2-2v7a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function CashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
