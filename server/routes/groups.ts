import { Router } from 'express'
import db from '../db'

const router = Router()

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: number
  name: string
  sort_order: number
  is_collapsed: number
}

interface RunResult { lastInsertRowid: number | bigint }

// ── GET /api/groups ───────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  const rows = db.prepare(
    'SELECT * FROM category_groups ORDER BY sort_order, id'
  ).all() as GroupRow[]
  res.json(rows)
})

// ── POST /api/groups ──────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name, sort_order } = req.body as { name?: string; sort_order?: number }

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }

  // Default sort_order: next available
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM category_groups'
  ).get() as { next: number }
  const order = sort_order ?? maxRow.next

  const result = db.prepare(
    'INSERT INTO category_groups (name, sort_order) VALUES (?, ?)'
  ).run(name.trim(), order) as RunResult

  const created = db.prepare(
    'SELECT * FROM category_groups WHERE id = ?'
  ).get(Number(result.lastInsertRowid)) as GroupRow
  res.status(201).json(created)
})

// ── PUT /api/groups/:id ───────────────────────────────────────────────────────

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) as GroupRow | undefined
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { name, is_collapsed } = req.body as { name?: string; is_collapsed?: boolean }

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' })
  }

  db.prepare(
    'UPDATE category_groups SET name = ?, is_collapsed = ? WHERE id = ?'
  ).run(name.trim(), is_collapsed ? 1 : 0, id)

  const updated = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) as GroupRow
  res.json(updated)
})

// ── DELETE /api/groups/:id ────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM category_groups WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }
  db.prepare('DELETE FROM monthly_budgets WHERE category_id IN (SELECT id FROM categories WHERE group_id = ?)').run(id)
  const result = db.prepare('DELETE FROM categories WHERE group_id = ?').run(id) as { changes: number }
  db.prepare('DELETE FROM category_groups WHERE id = ?').run(id)
  res.json({ deleted: true, categoriesRemoved: result.changes })
})

// ── PATCH /api/groups/:id/sort ────────────────────────────────────────────────

router.patch('/:id/sort', (req, res) => {
  const id = Number(req.params.id)
  const { sort_order } = req.body as { sort_order?: number }

  if (sort_order === undefined || sort_order === null) {
    return res.status(400).json({ error: 'sort_order is required' })
  }

  if (!db.prepare('SELECT id FROM category_groups WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Not found' })
  }

  db.prepare('UPDATE category_groups SET sort_order = ? WHERE id = ?').run(sort_order, id)
  const updated = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) as GroupRow
  res.json(updated)
})

export default router
