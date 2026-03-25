import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'

const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const DB_PATH = path.join(dataDir, 'personal-assistant.db')
const db = new DatabaseSync(DB_PATH)

// ── Pragmas ───────────────────────────────────────────────────────────────────
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS income (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    amount         REAL    NOT NULL,
    type           TEXT    NOT NULL CHECK (type IN ('salary', 'bonus', 'one-off')),
    expected_month INTEGER CHECK (expected_month BETWEEN 1 AND 12),
    is_recurring   INTEGER NOT NULL DEFAULT 1,
    notes          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    category    TEXT    NOT NULL CHECK (category IN (
                  'fixed_shared', 'fixed_personal',
                  'variable_shared', 'variable_personal', 'irregular'
                )),
    is_shared   INTEGER NOT NULL DEFAULT 0,
    recurrence  TEXT    NOT NULL CHECK (recurrence IN (
                  'monthly', 'annual', 'one_time', 'specific_month'
                )),
    due_day     INTEGER CHECK (due_day BETWEEN 1 AND 31),
    due_month   INTEGER CHECK (due_month BETWEEN 1 AND 12),
    status      TEXT    NOT NULL DEFAULT 'active' CHECK (status IN (
                  'active', 'paid', 'upcoming', 'paused'
                )),
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
    amount     REAL    NOT NULL,
    date       TEXT    NOT NULL,
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS stress_tests (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    item     TEXT    NOT NULL,
    price    REAL    NOT NULL,
    category TEXT    NOT NULL CHECK (category IN ('need', 'useful', 'comfort', 'impulse')),
    urgency  TEXT    NOT NULL CHECK (urgency IN ('high', 'medium', 'low')),
    verdict  TEXT    NOT NULL CHECK (verdict IN ('buy', 'wait', 'reject')),
    reason   TEXT    NOT NULL,
    date     TEXT    NOT NULL DEFAULT (date('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

// ── Schema migrations (safe to run on existing DBs) ──────────────────────────
try { db.exec("ALTER TABLE income ADD COLUMN due_day INTEGER") } catch { /* already exists */ }
try { db.exec("ALTER TABLE expenses ADD COLUMN custom_split REAL") } catch { /* already exists */ }

// ── Default settings (INSERT OR IGNORE — never overwrite user data) ────────────
db.exec(`
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shared_split_user', '0.50');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('savings_target', '100');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'EUR');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('onboarding_complete', 'false');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'en');
`)

export default db
