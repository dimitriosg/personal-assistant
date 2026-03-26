import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, put, patch, del, post } from '../../lib/api'

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Group {
  id: number
  name: string
  sort_order: number
  is_collapsed: boolean
}

type SettingsMap = Record<string, string>

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'es-LATAM', label: 'Español (LATAM)' },
]

const COST_PER_MILLION_TOKENS = 0.40

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function Settings() {
  const navigate = useNavigate()

  // ── General settings state ──────────────────────────────────────────────
  const [settings, setSettings] = useState<SettingsMap>({
    currency: 'EUR',
    shared_split_user: '0.50',
    savings_target: '100',
    language: 'en',
  })
  const [savedSettings, setSavedSettings] = useState<SettingsMap>({})
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // ── Groups state ────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Export state ────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // ── Reset state ─────────────────────────────────────────────────────────
  const [resetting, setResetting] = useState(false)

  // ── AI settings state ──────────────────────────────────────────────────
  const [aiModel, setAiModel] = useState(() => {
    const v = localStorage.getItem('ai_default_model')
    return v === 'gpt4o_mini' || v === 'haiku' ? v : 'gpt4o_mini'
  })
  const [aiMode, setAiMode] = useState(() => {
    const v = localStorage.getItem('ai_default_mode')
    return v === 'single' || v === 'compare' ? v : 'single'
  })
  const [tokenUsage, setTokenUsage] = useState<number>(0)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  /* ── Load data on mount ─────────────────────────────────────────────── */

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    setSettingsError('')
    try {
      const data = await get<SettingsMap>('/settings')
      setSettings(prev => ({ ...prev, ...data }))
      setSavedSettings(data)
    } catch (err) {
      setSettingsError(errMsg(err))
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError('')
    try {
      const data = await get<Group[]>('/groups')
      setGroups(data.sort((a, b) => a.sort_order - b.sort_order))
    } catch (err) {
      setGroupsError(errMsg(err))
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  const loadTokenUsage = useCallback(async () => {
    setTokenLoading(true)
    try {
      const now = new Date()
      const y = now.getUTCFullYear()
      const m = now.getUTCMonth()
      const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const toYear = m === 11 ? y + 1 : y
      const toMonth = m === 11 ? 0 : m + 1
      const to = `${toYear}-${String(toMonth + 1).padStart(2, '0')}-01`
      const { total_tokens } = await get<{ total_tokens: number }>(
        `/ai/token-usage?from=${from}&to=${to}`,
      )
      setTokenUsage(total_tokens)
    } catch {
      setTokenUsage(0)
    } finally {
      setTokenLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
    void loadGroups()
    void loadTokenUsage()
  }, [loadSettings, loadGroups, loadTokenUsage])

  /* ── General settings handlers ──────────────────────────────────────── */

  function updateSetting(key: string, value: string) {
    setSettingsSaved(false)
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function splitDisplayToStored(display: string): string {
    const n = Math.min(100, Math.max(0, Number(display) || 0))
    return (n / 100).toFixed(2)
  }

  function splitStoredToDisplay(stored: string): string {
    return String(Math.round(Number(stored) * 100))
  }

  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  async function saveSettings() {
    setSettingsSaving(true)
    setSettingsError('')
    setSettingsSaved(false)
    try {
      await patch<SettingsMap>('/settings', settings)
      setSavedSettings({ ...settings })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (err) {
      setSettingsError(errMsg(err))
    } finally {
      setSettingsSaving(false)
    }
  }

  /* ── Group handlers ─────────────────────────────────────────────────── */

  function startEditGroup(group: Group) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  async function saveGroupName(id: number) {
    const trimmed = editingGroupName.trim()
    if (!trimmed) {
      setEditingGroupId(null)
      return
    }
    try {
      setGroupsError('')
      const target = groups.find(g => g.id === id)
      await put<Group>(`/groups/${id}`, { name: trimmed, is_collapsed: target?.is_collapsed ?? false })
      setGroups(prev => prev.map(g => (g.id === id ? { ...g, name: trimmed } : g)))
    } catch (err) {
      setGroupsError(errMsg(err))
    } finally {
      setEditingGroupId(null)
    }
  }

  async function moveGroup(id: number, direction: 'up' | 'down') {
    const sorted = [...groups].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(g => g.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const currentOrder = sorted[idx].sort_order
    const swapOrder = sorted[swapIdx].sort_order

    try {
      setGroupsError('')
      await Promise.all([
        patch<Group>(`/groups/${sorted[idx].id}/sort`, { sort_order: swapOrder }),
        patch<Group>(`/groups/${sorted[swapIdx].id}/sort`, { sort_order: currentOrder }),
      ])
      setGroups(prev =>
        prev
          .map(g => {
            if (g.id === sorted[idx].id) return { ...g, sort_order: swapOrder }
            if (g.id === sorted[swapIdx].id) return { ...g, sort_order: currentOrder }
            return g
          })
          .sort((a, b) => a.sort_order - b.sort_order),
      )
    } catch (err) {
      setGroupsError(errMsg(err))
    }
  }

  async function deleteGroup(group: Group) {
    const confirmed = window.confirm(
      `Delete "${group.name}"?\n\nThis will also delete all categories, budgets, and targets in this group.`,
    )
    if (!confirmed) return
    try {
      setGroupsError('')
      await del(`/groups/${group.id}`)
      setGroups(prev => prev.filter(g => g.id !== group.id))
    } catch (err) {
      setGroupsError(errMsg(err))
    }
  }

  async function addGroup() {
    const trimmed = newGroupName.trim()
    if (!trimmed) return
    setAddingGroup(true)
    try {
      setGroupsError('')
      const created = await post<Group>('/groups', { name: trimmed })
      setGroups(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
      setNewGroupName('')
    } catch (err) {
      setGroupsError(errMsg(err))
    } finally {
      setAddingGroup(false)
    }
  }

  /* ── Export handler ─────────────────────────────────────────────────── */

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const [expSettings, expGroups, expCategories, expTransactions, expIncome, expExpenses] =
        await Promise.all([
          get<SettingsMap>('/settings'),
          get<unknown[]>('/groups'),
          get<unknown[]>('/categories'),
          get<unknown>('/transactions'),
          get<unknown[]>('/income'),
          get<unknown>('/expenses'),
        ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        settings: expSettings,
        groups: expGroups,
        categories: expCategories,
        transactions: expTransactions,
        income: expIncome,
        expenses: expExpenses,
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `personal-assistant-export-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(errMsg(err))
    } finally {
      setExporting(false)
    }
  }

  /* ── Reset handler ──────────────────────────────────────────────────── */

  async function handleReset() {
    const confirmed = window.confirm(
      'This will delete ALL your data (income, expenses, transactions, stress tests) and restart the setup wizard.\n\nAre you sure?',
    )
    if (!confirmed) return

    setResetting(true)
    try {
      const r = await fetch('/api/onboarding/reset', { method: 'POST' })
      if (!r.ok) throw new Error(await r.text())
      navigate('/setup', { replace: true })
    } catch (err) {
      alert(errMsg(err))
      setResetting(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  const sectionHeader = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'
  const card = 'bg-gray-900 border border-gray-800 rounded-xl p-4'
  const label = 'block text-xs font-medium text-gray-400 mb-1'
  const input =
    'w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors'
  const btnPrimary =
    'px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors'
  const btnGhost =
    'p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors'
  const errorBox = 'text-xs text-red-400 mt-2'

  return (
    <div className="space-y-8 max-w-lg">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">App configuration and data management.</p>
      </div>

      {/* ── Section 1: General Settings ─────────────────────────────────── */}
      <section>
        <h2 className={sectionHeader}>General</h2>
        <div className={card}>
          {settingsLoading ? (
            <p className="text-xs text-gray-500">Loading settings…</p>
          ) : (
            <div className="space-y-4">
              {/* Currency */}
              <div>
                <label className={label}>Currency</label>
                <input
                  type="text"
                  className={input}
                  value={settings.currency ?? 'EUR'}
                  onChange={e => updateSetting('currency', e.target.value)}
                />
              </div>

              {/* Shared split */}
              <div>
                <label className={label}>Shared expense default split %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={input}
                  value={splitStoredToDisplay(settings.shared_split_user ?? '0.50')}
                  onChange={e =>
                    updateSetting('shared_split_user', splitDisplayToStored(e.target.value))
                  }
                />
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Your share of shared expenses (0–100%)
                </p>
              </div>

              {/* Savings target */}
              <div>
                <label className={label}>Monthly savings target</label>
                <input
                  type="number"
                  min={0}
                  className={input}
                  value={settings.savings_target ?? '100'}
                  onChange={e => updateSetting('savings_target', e.target.value)}
                />
              </div>

              {/* Language */}
              <div>
                <label className={label}>Language</label>
                <select
                  className={input}
                  value={settings.language ?? 'en'}
                  onChange={e => updateSetting('language', e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Language support coming soon — display only for now.
                </p>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!settingsDirty || settingsSaving}
                  onClick={saveSettings}
                >
                  {settingsSaving ? 'Saving…' : 'Save'}
                </button>
                {settingsSaved && (
                  <span className="text-xs text-green-400">✓ Saved</span>
                )}
              </div>

              {settingsError && <p className={errorBox}>{settingsError}</p>}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Category Group Management ───────────────────────── */}
      <section>
        <h2 className={sectionHeader}>Category Groups</h2>
        <div className={card}>
          {groupsLoading ? (
            <p className="text-xs text-gray-500">Loading groups…</p>
          ) : (
            <div className="space-y-1">
              {groups.length === 0 && (
                <p className="text-xs text-gray-500">No groups yet.</p>
              )}
              {groups.map((group, idx) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 py-1.5 group"
                >
                  {/* Group name (inline edit) */}
                  {editingGroupId === group.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      className="flex-1 bg-gray-950 border border-indigo-500 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none"
                      value={editingGroupName}
                      onChange={e => setEditingGroupName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void saveGroupName(group.id)
                        if (e.key === 'Escape') setEditingGroupId(null)
                      }}
                      onBlur={() => void saveGroupName(group.id)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex-1 text-left text-sm text-gray-200 hover:text-indigo-400 transition-colors truncate"
                      onClick={() => startEditGroup(group)}
                      title="Click to rename"
                    >
                      {group.name}
                    </button>
                  )}

                  {/* Reorder buttons */}
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={idx === 0}
                    onClick={() => void moveGroup(group.id, 'up')}
                    title="Move up"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={idx === groups.length - 1}
                    onClick={() => void moveGroup(group.id, 'down')}
                    title="Move down"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                    onClick={() => void deleteGroup(group)}
                    title="Delete group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 01.78.72l.5 6a.75.75 0 01-1.49.12l-.5-6a.75.75 0 01.71-.84zm2.84 0a.75.75 0 01.71.84l-.5 6a.75.75 0 11-1.49-.12l.5-6a.75.75 0 01.78-.72z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Add new group */}
              <div className="flex items-center gap-2 pt-3 mt-2 border-t border-gray-800">
                <input
                  type="text"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  placeholder="New group name…"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void addGroup()
                  }}
                />
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!newGroupName.trim() || addingGroup}
                  onClick={() => void addGroup()}
                >
                  {addingGroup ? 'Adding…' : 'Add'}
                </button>
              </div>

              {groupsError && <p className={errorBox}>{groupsError}</p>}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Data Export ──────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeader}>Data Export</h2>
        <div className={card}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Export all data</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Download settings, groups, categories, transactions, income, and expenses
                as a JSON file.
              </p>
            </div>
            <button
              type="button"
              className={btnPrimary}
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
          {exportError && <p className={errorBox}>{exportError}</p>}
        </div>
      </section>

      {/* ── Section 4: AI ──────────────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeader}>AI</h2>
        <div className={card}>
          <div className="space-y-4">
            {/* Default model */}
            <div>
              <label className={label}>Default model</label>
              <select
                className={input}
                value={aiModel}
                onChange={e => {
                  setAiModel(e.target.value)
                  localStorage.setItem('ai_default_model', e.target.value)
                }}
              >
                <option value="gpt4o_mini">GPT-4o Mini</option>
                <option value="haiku">Claude Haiku</option>
              </select>
            </div>

            {/* Default mode */}
            <div>
              <label className={label}>Default mode</label>
              <select
                className={input}
                value={aiMode}
                onChange={e => {
                  setAiMode(e.target.value)
                  localStorage.setItem('ai_default_mode', e.target.value)
                }}
              >
                <option value="single">Single</option>
                <option value="compare">Compare</option>
              </select>
            </div>

            {/* API keys note */}
            <p className="text-xs text-gray-500 italic">
              API keys are configured in .env (not stored here)
            </p>

            {/* Token usage */}
            <div>
              <label className={label}>Token usage this month</label>
              <p className="text-sm text-gray-200">
                {tokenLoading
                  ? 'Loading…'
                  : `${tokenUsage.toLocaleString()} tokens (~$${(tokenUsage / 1_000_000 * COST_PER_MILLION_TOKENS).toFixed(4)})`}
              </p>
            </div>

            {/* Clear history */}
            <div className="flex items-start justify-between gap-4 pt-2 border-t border-gray-800">
              <div>
                <p className="text-sm font-medium text-gray-200">Clear conversation history</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Permanently deletes all AI conversation history.
                </p>
              </div>
              <button
                type="button"
                disabled={clearing}
                onClick={async () => {
                  if (!window.confirm('Delete all AI conversation history? This cannot be undone.')) return
                  setClearing(true)
                  try {
                    await del('/ai/conversations')
                    setTokenUsage(0)
                  } catch (err) {
                    alert(errMsg(err))
                  } finally {
                    setClearing(false)
                  }
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 disabled:opacity-50 transition-colors"
              >
                {clearing ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Danger Zone ─────────────────────────────────────── */}
      <section>
        <h2 className={sectionHeader}>Danger zone</h2>
        <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Reset &amp; re-run setup</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Deletes all income, expenses, transactions, and stress tests, then
                restarts the onboarding wizard. Settings are preserved.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
