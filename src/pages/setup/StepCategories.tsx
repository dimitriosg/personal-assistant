import { useState } from 'react'
import type { GroupEntry, CategoryEntry } from './types'

interface Props {
  groups: GroupEntry[]
  categories: CategoryEntry[]
  shareExpenses: boolean
  onChange: (categories: CategoryEntry[]) => void
}

let nextId = 0
function genId() { return `new-cat-${++nextId}` }

export default function StepCategories({ groups, categories, shareExpenses, onChange }: Props) {
  const enabledGroups = groups.filter(g => g.enabled)

  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')

  function toggleCategory(id: string) {
    onChange(categories.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))
  }

  function renameCategory(id: string, name: string) {
    onChange(categories.map(c => c.id === id ? { ...c, name } : c))
  }

  function toggleShared(id: string) {
    onChange(categories.map(c => c.id === id ? { ...c, isShared: !c.isShared } : c))
  }

  function setTarget(id: string, value: string) {
    const num = value === '' ? null : parseFloat(value)
    onChange(categories.map(c => c.id === id ? { ...c, targetAmount: num } : c))
  }

  function addCategory(groupId: string) {
    if (!newCatName.trim()) return
    const newCat: CategoryEntry = {
      id: genId(),
      groupId,
      name: newCatName.trim(),
      enabled: true,
      isShared: false,
      customSplit: null,
      targetAmount: null,
    }
    onChange([...categories, newCat])
    setNewCatName('')
    setAddingFor(null)
  }

  function removeCategory(id: string) {
    onChange(categories.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Categories</h2>
        <p className="text-sm text-gray-500">
          For each group, select the categories you use. You can add new ones, set targets,
          and mark shared expenses. Don't worry, you can change all of this later.
        </p>
      </div>

      {enabledGroups.map(group => {
        const groupCats = categories.filter(c => c.groupId === group.id)

        return (
          <div key={group.id} className="space-y-2">
            <h3 className="text-sm font-semibold text-indigo-400">{group.name}</h3>

            <div className="space-y-1">
              {groupCats.map(c => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    c.enabled
                      ? 'border-gray-700 bg-gray-900/60'
                      : 'border-gray-800/50 bg-gray-950/30 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={() => toggleCategory(c.id)}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/50 shrink-0"
                  />

                  <input
                    type="text"
                    value={c.name}
                    onChange={e => renameCategory(c.id, e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 border-none outline-none placeholder-gray-600"
                    placeholder="Category name"
                  />

                  {shareExpenses && c.enabled && (
                    <button
                      type="button"
                      onClick={() => toggleShared(c.id)}
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                        c.isShared
                          ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                          : 'bg-gray-800 text-gray-500 border border-gray-700/40 hover:text-gray-300'
                      }`}
                      title={c.isShared ? 'Shared expense' : 'Click to mark as shared'}
                    >
                      {c.isShared ? 'shared' : 'personal'}
                    </button>
                  )}

                  {c.enabled && (
                    <input
                      type="number"
                      value={c.targetAmount ?? ''}
                      onChange={e => setTarget(c.id, e.target.value)}
                      placeholder="Target €"
                      className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-300 text-right placeholder-gray-600 focus:border-indigo-500 focus:outline-none shrink-0"
                      min={0}
                      step={0.01}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => removeCategory(c.id)}
                    className="text-gray-600 hover:text-red-400 text-xs shrink-0"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add category */}
            {addingFor === group.id ? (
              <div className="flex gap-2 pl-6">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCategory(group.id)}
                  placeholder="New category name…"
                  autoFocus
                  className="flex-1 px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addCategory(group.id)}
                  disabled={!newCatName.trim()}
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingFor(null); setNewCatName('') }}
                  className="px-2 py-1.5 text-gray-500 hover:text-gray-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAddingFor(group.id); setNewCatName('') }}
                className="text-xs text-indigo-400 hover:text-indigo-300 pl-6"
              >
                + Add Category
              </button>
            )}
          </div>
        )
      })}

      <div className="text-xs text-gray-600">
        {categories.filter(c => c.enabled && enabledGroups.some(g => g.id === c.groupId)).length} categories selected across {enabledGroups.length} groups
      </div>
    </div>
  )
}
