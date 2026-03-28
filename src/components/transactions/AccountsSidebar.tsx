import { useState } from 'react'
import { patch, del } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
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

// ── Currency formatters ────────────────────────────────────────────────────────

// Cache formatters by currency code to avoid repeated Intl.NumberFormat construction
const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string): Intl.NumberFormat {
  let fmt = formatterCache.get(currency)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-IE', { style: 'currency', currency, minimumFractionDigits: 2 })
    formatterCache.set(currency, fmt)
  }
  return fmt
}

function fmtBalance(n: number, currency: string): string {
  return getFormatter(currency).format(n)
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AccountsSidebarProps {
  accounts: Account[]
  activeAccountId: string
  onSelect: (id: string) => void
  onAddAccount: () => void
  onAccountUpdated: (account: Account) => void
  onAccountDeleted: (id: number) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccountsSidebar({
  accounts,
  activeAccountId,
  onSelect,
  onAddAccount,
  onAccountUpdated,
  onAccountDeleted,
}: AccountsSidebarProps) {
  const { showToast } = useToast()

  // Edit modal state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState('')
  const [editBalance, setEditBalance] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)

  const budgetAccounts = accounts.filter(a => a.type === 'budget')
  const trackingAccounts = accounts.filter(a => a.type === 'tracking')

  const budgetTotal = budgetAccounts.reduce((sum, a) => sum + a.balance, 0)
  const trackingTotal = trackingAccounts.reduce((sum, a) => sum + a.balance, 0)

  function openEdit(account: Account) {
    setEditingAccount(account)
    setEditName(account.name)
    setEditBalance(String(account.balance))
  }

  function openDelete(account: Account) {
    // Guard: cannot delete the last budget account
    if (account.type === 'budget' && budgetAccounts.length === 1) {
      showToast({ message: 'You must keep at least one budget account', type: 'error' })
      return
    }
    setDeletingAccount(account)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAccount) return
    setSaving(true)
    try {
      const updated = await patch<Account>(`/accounts/${editingAccount.id}`, {
        name: editName.trim(),
        balance: parseFloat(editBalance) || 0,
      })
      onAccountUpdated(updated)
      showToast({ message: 'Account updated', type: 'success' })
      setEditingAccount(null)
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to update account',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAccount) return
    setDeleting(true)
    try {
      await del(`/accounts/${deletingAccount.id}`)
      onAccountDeleted(deletingAccount.id)
      showToast({ message: 'Account deleted', type: 'success' })
      setDeletingAccount(null)
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to delete account',
        type: 'error',
      })
    } finally {
      setDeleting(false)
    }
  }

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
            <SectionLabel total={budgetTotal}>BUDGET ACCOUNTS</SectionLabel>
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
                onEdit={() => openEdit(a)}
                onDelete={() => openDelete(a)}
              />
            ))}
          </>
        )}

        {/* Tracking Accounts */}
        {trackingAccounts.length > 0 && (
          <>
            <SectionLabel total={trackingTotal}>TRACKING ACCOUNTS</SectionLabel>
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
                onEdit={() => openEdit(a)}
                onDelete={() => openDelete(a)}
              />
            ))}
          </>
        )}

        {accounts.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-6">No accounts yet</p>
        )}
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────────── */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-100">Edit Account</h2>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Account name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Balance</label>
                <input
                  type="number"
                  value={editBalance}
                  onChange={e => setEditBalance(e.target.value)}
                  step="0.01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                    text-sm text-gray-200 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Currency</label>
                <div className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2
                  text-sm text-gray-500 cursor-not-allowed select-none">
                  {editingAccount.currency}
                </div>
                <p className="text-[11px] text-gray-600">Currency cannot be changed after creation</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
                    disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm
                    font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-100">Delete Account</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-300">
                Delete{' '}
                <span className="font-medium text-gray-100">{deletingAccount.name}</span>?
                Its transactions will be kept.
              </p>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingAccount(null)}
                  className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500
                    disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm
                    font-medium transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children, total }: { children: React.ReactNode; total: number }) {
  return (
    <div className="px-2 pt-3 pb-1 flex items-center justify-between">
      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
        {children}
      </span>
      <span className={`text-[10px] tabular-nums font-medium ${total < 0 ? 'text-red-400' : 'text-gray-500'}`}>
        {fmtBalance(total, 'EUR')}
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
  onEdit,
  onDelete,
}: {
  label: string
  emoji: string
  balance: number | null
  currency: string
  isActive: boolean
  isBudget: boolean
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
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
    <div
      className={`group flex items-center w-full rounded-md transition-colors ${
        isActive
          ? 'bg-[#2a2a4a] text-gray-200'
          : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
      }`}
    >
      {/* Navigation button — takes all available space */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-left flex items-center gap-1.5 px-2 py-1.5 text-xs min-w-0"
      >
        <span className="shrink-0">{emoji}</span>
        <span className="flex-1 truncate">{label}</span>
        {balance !== null && (
          <span className={`text-[10px] tabular-nums shrink-0 ${balanceColor}`}>
            {fmtBalance(balance, currency)}
          </span>
        )}
      </button>

      {/* Edit / Delete icons — visible only on hover, only for named accounts */}
      {onEdit && onDelete && (
        <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-0.5 rounded text-gray-600 hover:text-indigo-400 transition-colors leading-none"
            title="Edit account"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-0.5 rounded text-gray-600 hover:text-red-400 transition-colors leading-none"
            title="Delete account"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}
