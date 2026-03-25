import { useState } from 'react'
import type { GroupEntry, CategoryEntry } from './types'
import { DEFAULT_GROUP_DEFS } from './types'

interface Props {
  groups: GroupEntry[]
  onChange: (groups: GroupEntry[], categories: CategoryEntry[]) => void
  categories: CategoryEntry[]
}

let nextId = 0
function genId() { return `new-grp-${++nextId}` }

export default function StepGroups({ groups, categories, onChange }: Props) {
  const [newGroupName, setNewGroupName] = useState('')

  function toggleGroup(id: string) {
    const updated = groups.map(g =>
      g.id === id ? { ...g, enabled: !g.enabled } : g
    )
    onChange(updated, categories)
  }

  function renameGroup(id: string, name: string) {
    const updated = groups.map(g =>
      g.id === id ? { ...g, name } : g
    )
    onChange(updated, categories)
  }

  function addGroup() {
    if (!newGroupName.trim()) return
    const newGroup: GroupEntry = {
      id: genId(),
      name: newGroupName.trim(),
      enabled: true,
    }
    onChange([...groups, newGroup], categories)
    setNewGroupName('')
  }

  function removeGroup(id: string) {
    // Only allow removing custom groups (not in defaults)
    const updated = groups.filter(g => g.id !== id)
    const updatedCats = categories.filter(c => c.groupId !== id)
    onChange(updated, updatedCats)
  }

  const isDefaultGroup = (name: string) =>
    DEFAULT_GROUP_DEFS.some(d => d.name === name)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">Category Groups</h2>
        <p className="text-sm text-gray-500">
          Select which groups you want to use. You can rename them or add your own.
          Don't worry, you can change all of this later.
        </p>
      </div>

      <div className="space-y-2">
        {groups.map(g => (
          <div
            key={g.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              g.enabled
                ? 'border-indigo-600/40 bg-indigo-950/20'
                : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={g.enabled}
              onChange={() => toggleGroup(g.id)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500/50"
            />
            <input
              type="text"
              value={g.name}
              onChange={e => renameGroup(g.id, e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-200 border-none outline-none placeholder-gray-600 focus:ring-0"
              placeholder="Group name"
            />
            {!isDefaultGroup(g.name) && (
              <button
                type="button"
                onClick={() => removeGroup(g.id)}
                className="text-gray-600 hover:text-red-400 text-sm"
                title="Remove group"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add custom group */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addGroup()}
          placeholder="Add custom group…"
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={addGroup}
          disabled={!newGroupName.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          + Add
        </button>
      </div>

      <div className="text-xs text-gray-600">
        {groups.filter(g => g.enabled).length} of {groups.length} groups selected
      </div>
    </div>
  )
}
