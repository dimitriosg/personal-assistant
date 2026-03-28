import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryRow {
  id: number
  name: string
  group_id: number
  is_shared: number
  custom_split: number | null
  sort_order: number
  hidden: number
}

interface GroupRow {
  id: number
  name: string
  sort_order: number
  is_collapsed: number
}

interface RunResult { lastInsertRowid: number | bigint }

// ── GET /api/categories ───────────────────────────────────────────────────────
// Returns categories grouped by their category_group

router.get('/', (_req, res) => {
  const groups = db.prepare(
    'SELECT * FROM category_groups ORDER BY sort_order, id'
  ).all() as GroupRow[]

  const categories = db.prepare(
    'SELECT * FROM categories WHERE hidden = 0 ORDER BY sort_order, id'
  ).all() as CategoryRow[]

  const grouped = groups.map(g => ({
    ...g,
    categories: categories.filter(c => c.group_id === g.id),
  }))

  res.json(grouped)
})

// ── POST /api/categories ──────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name, group_id, is_shared, custom_split, sort_order } =
    req.body as Record<string, unknown>

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }
  if (!group_id) {
    return res.status(400).json({ error: 'group_id is required' })
  }

  // Validate group exists
  if (!db.prepare('SELECT id FROM category_groups WHERE id = ?').get(Number(group_id))) {
    return res.status(400).json({ error: 'group_id does not exist' })
  }

  // Default sort_order: next within group
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories WHERE group_id = ?'
  ).get(Number(group_id)) as { next: number }
  const order = sort_order !== undefined ? Number(sort_order) : maxRow.next

  const result = db.prepare(
    'INSERT INTO categories (name, group_id, is_shared, custom_split, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(
    String(name).trim(),
    Number(group_id),
    is_shared ? 1 : 0,
    custom_split != null ? Number(custom_split) : null,
    order
  ) as RunResult

  const created = db.prepare('SELECT * FROM categories WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as CategoryRow
  res.status(201).json(created)
})

// ── PUT /api/categories/:id ───────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow | undefined
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { name, group_id, is_shared, custom_split, hidden } =
    req.body as Record<string, unknown>

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }

  const gid = group_id !== undefined ? Number(group_id) : existing.group_id
  if (!db.prepare('SELECT id FROM category_groups WHERE id = ?').get(gid)) {
    return res.status(400).json({ error: 'group_id does not exist' })
  }

  db.prepare(`
    UPDATE categories
    SET name = ?, group_id = ?, is_shared = ?, custom_split = ?, hidden = ?
    WHERE id = ?
  `).run(
    String(name).trim(),
    gid,
    is_shared ? 1 : 0,
    custom_split != null ? Number(custom_split) : null,
    hidden ? 1 : 0,
    id
  )

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow
  res.json(updated)
})

// ── DELETE /api/categories/bulk ───────────────────────────────────────────────

router.delete('/bulk', (req, res) => {
  const { ids } = req.body as { ids?: unknown }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' })
  }

  const numIds = ids.map(Number).filter(n => !isNaN(n) && n > 0)
  if (numIds.length === 0) {
    return res.status(400).json({ error: 'ids must contain valid positive integers' })
  }

  const placeholders = numIds.map(() => '?').join(', ')

  // Delete monthly_budgets first (explicitly, before deleting categories)
  db.prepare(`DELETE FROM monthly_budgets WHERE category_id IN (${placeholders})`).run(...numIds)

  const result = db.prepare(`DELETE FROM categories WHERE id IN (${placeholders})`).run(...numIds) as { changes: number }

  res.json({ deleted: result.changes })
})

// ── DELETE /api/categories/:id ────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM monthly_budgets WHERE category_id = ?').run(id)
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  res.json({ ok: true })
})

// ── PATCH /api/categories/:id/sort ────────────────────────────────────────────

router.patch('/:id/sort', (req, res) => {
  const id = Number(req.params.id)
  const { sort_order } = req.body as { sort_order?: number }

  if (sort_order === undefined || sort_order === null) {
    return res.status(400).json({ error: 'sort_order is required' })
  }

  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(sort_order, id)
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as CategoryRow
  res.json(updated)
})

// ── PATCH /api/categories/:id/snooze ──────────────────────────────────────────

router.patch('/:id/snooze', (req, res) => {
  const id = Number(req.params.id)

  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const { snoozed } = req.body as { snoozed?: boolean }
  db.prepare('UPDATE categories SET snoozed = ? WHERE id = ?').run(snoozed ? 1 : 0, id)
  res.json({ id, snoozed: !!snoozed })
})

// ── PATCH /api/categories/:id/emoji ───────────────────────────────────────────

router.patch('/:id/emoji', (req, res) => {
  const id = Number(req.params.id)

  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  const { emoji } = req.body as { emoji?: string | null }
  db.prepare('UPDATE categories SET emoji = ? WHERE id = ?').run(emoji ?? null, id)
  res.json({ id, emoji: emoji ?? null })
})

export default router
