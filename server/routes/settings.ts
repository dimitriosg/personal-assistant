import { Router } from 'express'
import db from '../db'

const router = Router()

// GET /api/settings — all settings as { key: value } map
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }
  res.json(map)
})

// GET /api/settings/:key — single setting
router.get('/:key', (req, res) => {
  const row = db
    .prepare('SELECT key, value FROM settings WHERE key = ?')
    .get(req.params.key) as { key: string; value: string } | undefined

  if (!row) {
    return res.status(404).json({ error: 'Setting not found' })
  }
  res.json(row)
})

// PUT /api/settings/:key — upsert single setting
router.put('/:key', (req, res) => {
  const { value } = req.body as { value?: string }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value is required' })
  }
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    req.params.key,
    String(value)
  )
  res.json({ key: req.params.key, value: String(value) })
})

// PATCH /api/settings — bulk upsert { key: value, ... }
router.patch('/', (req, res) => {
  const updates = req.body as Record<string, string>
  if (typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ error: 'Body must be a key/value object' })
  }
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  db.exec('BEGIN')
  try {
    for (const [k, v] of Object.entries(updates)) {
      upsert.run(k, String(v))
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  res.json({ updated: Object.keys(updates).length })
})

export default router
