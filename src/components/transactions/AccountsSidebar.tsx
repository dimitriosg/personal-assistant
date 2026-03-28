import type { Account } from '../../pages/Transactions/types'

// ── Emoji helpers ──────────────────────────────────────────────────────────────

function accountEmoji(account: Account): string {
  const t = account.account_type.toLowerCase()
  if (t === 'checking') return '🏦'
  if (t === 'savings') return '💰'
  if (t === 'cash') return '💵'
  if (t === 'credit_card' || t === 'credit card') return '💳'
  if (t === 'investment') return '📊'
  if (t === 'mortgage') return '🏠'
  if (t === 'loan') return '📋'
  return '📊'
}

function fmtBalance(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AccountsSidebarProps {
  accounts: Account[]
  activeAccountId: string
  onSelect: (id: string) => void
  onAddAccount: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccountsSidebar({
  accounts,
  activeAccountId,
  onSelect,
  onAddAccount,
}: AccountsSidebarProps) {
  const budgetAccounts = accounts.filter(a => a.type === 'budget')
  const trackingAccounts = accounts.filter(a => a.type === 'tracking')

  return (
    <aside className="hidden md:flex flex-col w-[200px] shrink-0 bg-gray-900/60 border-r border-gray-800">
      {/* Add Account button */}
      <div className="p-3">
        <button
          type="button"
          onClick={onAddAccount}
          className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          + Add Account
        </button>
      </div>

      {/* Account list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {/* All Accounts row */}
        <AccountRow
          label="All Accounts"
          emoji="📋"
          balance={null}
          currency="EUR"
          isActive={activeAccountId === ''}
          isBudget={false}
          onClick={() => onSelect('')}
        />

        {/* Budget Accounts */}
        {budgetAccounts.length > 0 && (
          <>
            <SectionLabel>BUDGET ACCOUNTS</SectionLabel>
            {budgetAccounts.map(a => (
              <AccountRow
                key={a.id}
                label={a.name}
                emoji={accountEmoji(a)}
                balance={a.balance}
                currency={a.currency}
                isActive={activeAccountId === String(a.id)}
                isBudget={true}
                onClick={() => onSelect(String(a.id))}
              />
            ))}
          </>
        )}

        {/* Tracking Accounts */}
        {trackingAccounts.length > 0 && (
          <>
            <SectionLabel>TRACKING ACCOUNTS</SectionLabel>
            {trackingAccounts.map(a => (
              <AccountRow
                key={a.id}
                label={a.name}
                emoji={accountEmoji(a)}
                balance={a.balance}
                currency={a.currency}
                isActive={activeAccountId === String(a.id)}
                isBudget={false}
                onClick={() => onSelect(String(a.id))}
              />
            ))}
          </>
        )}

        {accounts.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-6">No accounts yet</p>
        )}
      </div>
    </aside>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1">
      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
        {children}
      </span>
    </div>
  )
}

function AccountRow({
  label,
  emoji,
  balance,
  currency,
  isActive,
  isBudget,
  onClick,
}: {
  label: string
  emoji: string
  balance: number | null
  currency: string
  isActive: boolean
  isBudget: boolean
  onClick: () => void
}) {
  const balanceColor =
    balance === null
      ? ''
      : isBudget
      ? balance < 0
        ? 'text-red-400'
        : 'text-green-400'
      : 'text-gray-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
        isActive
          ? 'bg-[#2a2a4a] text-gray-200'
          : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span>{emoji}</span>
        <span className="flex-1 truncate">{label}</span>
        {balance !== null && (
          <span className={`text-[10px] tabular-nums shrink-0 ${balanceColor}`}>
            {fmtBalance(balance, currency)}
          </span>
        )}
      </div>
    </button>
  )
}
