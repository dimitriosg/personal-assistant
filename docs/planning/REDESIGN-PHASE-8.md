# Personal Assistant - Money Module v2
# REDESIGN-PHASE-8.md — YNAB Visual Parity

<!--
  COPILOT INSTRUCTIONS
  =====================
  Standalone spec for Phase 8 ONLY.
  Phases 1–7 must be complete before starting.
  Do NOT modify existing pages unless explicitly stated.
  Each step = one commit. Work in exact step order.

  How to focus Copilot:
    "Implement Phase 8 Step 1 — add filter chips to Budget page"
    "Implement Phase 8 Step 5 — build Category Inspector panel"
-->

---

## Goal

Make the Budget page look and feel like YNAB's Plan view.
No new data model features — this is a frontend-heavy phase
with minimal backend additions.

Visual benchmark: the YNAB screenshot with filter chips,
progress bars, colored pill badges, emoji icons, undo/redo,
Recent Moves, and the category inspector panel.

---

## Schema Changes (minimal)

```sql
-- Add to categories table
ALTER TABLE categories ADD COLUMN emoji TEXT DEFAULT NULL;
ALTER TABLE categories ADD COLUMN snoozed INTEGER DEFAULT 0;

-- New table: budget move log (for Recent Moves + Undo/Redo)
CREATE TABLE IF NOT EXISTS budget_moves (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  month         TEXT NOT NULL,
  from_category_id INTEGER,   -- NULL = Ready to Assign
  to_category_id   INTEGER,   -- NULL = Ready to Assign
  amount        REAL NOT NULL,
  moved_at      TEXT NOT NULL DEFAULT (datetime('now')),
  undone        INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_budget_moves_month
  ON budget_moves(month);
```

---

## New API Endpoints

### `POST /api/budget/move`
Log a money move and persist to `budget_moves`.
```json
Request:  { "month": "2026-03", "fromCategoryId": 5, "toCategoryId": 12, "amount": 20 }
Response: { "id": 1, "from": "Coffee & Drink", "to": "Food Delivery", "amount": 20 }
```

### `GET /api/budget/moves?month=2026-03`
Returns last 20 moves for the month, newest first.
```json
[
  { "id": 1, "from": "Coffee & Drink", "to": "Food Delivery",
    "amount": 20, "moved_at": "2026-03-26T18:00:00", "undone": false }
]
```

### `POST /api/budget/moves/:id/undo`
Reverses the move: swaps from/to, updates monthly_budgets.
```json
Response: { "undone": true }
```

### `PATCH /api/categories/:id/snooze`
```json
Request:  { "snoozed": true }
Response: { "id": 5, "snoozed": true }
```

### `PATCH /api/categories/:id/emoji`
```json
Request:  { "emoji": "☕" }
Response: { "id": 5, "emoji": "☕" }
```

---

## Component: Filter Chips Bar

> Location: above category list in Budget page
[All] [Snoozed] [Underfunded] [Overfunded] [Money Available]

text

**Filter logic:**

| Chip | Shows categories where |
|---|---|
| All | everything (default) |
| Snoozed | `snoozed = 1` |
| Underfunded | `available < target AND available >= 0` |
| Overfunded | `available > target` |
| Money Available | `available > 0` |

- Active chip: `bg-[#6366f1] text-white`
- Inactive chip: `bg-[#2a2a4a] text-gray-400 hover:bg-[#3a3a5a]`
- When filter is active: show below list:
  `"Some categories are hidden by your current view."  [View All]`
- "View All" resets to "All" filter

---

## Component: Progress Bar on Category Rows

Each category row with a target gets an inline progress bar
below the category name.

**Visual:**
Savings €100 [███████░░░░░░░░░░░░░] €143.79 more needed by the 10th
Groceries [████████████████████] Fully funded ✓
Coffee & Drink [████████████████████] Overspent -€20.00

text

**Bar color rules:**
| State | Bar color | Text |
|---|---|---|
| Fully funded | `bg-green-500` | "Fully funded ✓" |
| On track (>= 50%) | `bg-blue-500` | "€X more needed by [date]" |
| Behind (< 50%) | `bg-yellow-500` | "€X more needed" |
| Overspent | `bg-red-500` | "Overspent -€X" |
| No target | no bar | — |

**Progress %:**
pct = Math.min(100, (assigned / target_amount) * 100)

text

Bar height: `h-1.5`, rounded, full width of category name cell.

---

## Component: Available Amount Badge

Replace plain amount text in the AVAILABLE column with
a colored pill badge.

```tsx
interface AvailableBadgeProps {
  amount: number;
  isFunded: boolean;
  isOverspent: boolean;
}
```

| State | Style |
|---|---|
| `amount > 0` and fully funded | `rounded-full bg-green-500/20 text-green-400 px-2 py-0.5` |
| `amount > 0` not fully funded | plain `text-green-400` (no pill) |
| `amount === 0` | `text-gray-500` |
| `amount < 0` | `rounded-full bg-red-500/20 text-red-400 px-2 py-0.5` |

**"All Money Assigned" state:**
When Ready to Assign === 0, replace the top banner with:
✓ All Money Assigned [green pill badge, full width of banner]

text
`bg-green-500/20 border border-green-500/30 text-green-400`

---

## Component: Emoji Picker on Category

- Clicking the category name area reveals a small emoji
  button to the left: `[☕]` or `[+]` if no emoji set
- Clicking the emoji opens a small popover with an emoji
  grid (use `emoji-picker-react` or a simple inline grid
  of 40 common finance emojis)
- Selected emoji is saved via `PATCH /api/categories/:id/emoji`
- Emoji displayed at 16px, left of the category name

**Suggested emoji set (hardcode these 40, no external picker):**
🏠 🔌 💧 📡 🛒 🏦 💳 🚗 ⛽ 🔧 📱 💊 🎓 ✈️
☕ 🍕 🍺 🎮 💇 💄 💰 🎯 📊 🛡️ 🎁 🏋️ 🎵
📚 🌴 🐾 ⚡ 🔑 💡 🧾 🏪 🛍️ 🎬 🍔 🚀 💎

text

---

## Component: Checkbox + Bulk Actions

- Add a checkbox column as the first column (hidden by
  default, appears on row hover)
- Selecting 1+ categories reveals a bulk action bar
  above the list:
3 selected [Move Money] [Snooze] [Hide] [Clear]

text

| Action | Behavior |
|---|---|
| Move Money | Opens Move Money modal with selected categories as sources |
| Snooze | Calls `PATCH /api/categories/:id/snooze` for each |
| Hide | Sets `hidden = 1` for each |
| Clear | Deselects all |

---

## Component: Undo / Redo Toolbar

Add to the Budget page toolbar (next to month selector):
< Mar 2026 > [↩ Undo] [↪ Redo] ⏱ Recent Moves

text

**Undo:**
- Calls `POST /api/budget/moves/:id/undo` for the last
  non-undone move in the current month
- Re-fetches budget data
- Shows a brief toast: "Move undone: €20 back to Coffee & Drink"

**Redo:**
Not a server operation — keep a client-side stack of
undone moves and re-apply them locally.

**Toast component:**
Small banner at bottom of screen, auto-dismisses after 3s:
`bg-[#2a2a4a] text-white text-sm px-4 py-2 rounded-lg`

---

## Component: Recent Moves Panel

Button: `⏱ Recent Moves` in toolbar → opens a slide-in
panel from the right (over the right sidebar, 300px wide).
Recent Moves — March 2026
────────────────────────────────
↕ €20 Coffee & Drink → Food Delivery 18:00 [Undo]
↕ €50 Ready to Assign → Savings €100 17:45 [Undo]
↕ €16 Drink Out → Home & Office 16:30 [Undo ✓ done]
────────────────────────────────
[Close]

text

- Shows last 20 moves via `GET /api/budget/moves?month=`
- Each row has an inline [Undo] button
- Already-undone moves shown with strikethrough + `text-gray-500`
- Auto-refreshes after each undo

---

## Component: Category Inspector Panel

Clicking a category row opens a panel in the **right sidebar**
area (replaces Monthly Summary while open).
+──────────────────────────────────+

+──────────────────────────────────+

| ☕ Coffee & Drink [✕] |

| Assigned EUR 76.00 |

| Activity -EUR 96.00 |

Available -EUR 20.00 ●
TARGET
Monthly target: EUR 76.00
Status: Overspent -EUR 20.00
[████████████████████] 100%+
QUICK ASSIGN
[EUR ____] [Assign]
[Move money from another cat.]
RECENT TRANSACTIONS
Mar 24 Starbucks -€5.30
Mar 22 Costa Coffee -€6.20
Mar 20 Freddo Espresso -€2.10
Mar 18 Starbucks -€4.80
[View all →]
+──────────────────────────────────+

text

**Behavior:**
- Opens by clicking anywhere on a category row
- Closes with ✕ button or clicking another row
- Monthly Summary re-appears when inspector closes
- Quick Assign saves via `POST /api/budget/assign`
- "Move money" opens Move Money modal pre-filled with
  this category as destination
- "View all →" navigates to `/transactions?category_id=X`

**Recent transactions:** `GET /api/transactions?category_id=X&month=2026-03&limit=5`

---

## Phase 8 Build Order
Step 1 — Schema migration: add emoji, snoozed to categories; create budget_moves table
Step 2 — Backend: POST /api/budget/move + GET /api/budget/moves + POST /api/budget/moves/:id/undo
Step 3 — Backend: PATCH /api/categories/:id/snooze + PATCH /api/categories/:id/emoji
Step 4 — Frontend: Filter chips bar + snoozed logic + "hidden by filter" message
Step 5 — Frontend: Progress bars under category names (target-aware)
Step 6 — Frontend: AvailableBadge component + "All Money Assigned" banner state
Step 7 — Frontend: Emoji picker popover + save
Step 8 — Frontend: Checkbox column + bulk action bar (Move, Snooze, Hide, Clear)
Step 9 — Frontend: Undo/Redo toolbar buttons + Toast component
Step 10 — Frontend: Recent Moves slide-in panel
Step 11 — Frontend: Category Inspector panel (replaces right sidebar on click)
Step 12 — Frontend: Wire Inspector Quick Assign + Move Money modal + View all link

text

---

## Success Criteria

✅ Filter chips correctly show/hide categories per filter state
✅ "All" filter restores full list; "View All" resets active filter
✅ Progress bars show on all categories with targets
✅ AvailableBadge shows green pill when funded, red when overspent
✅ "All Money Assigned" banner appears when Ready to Assign = €0
✅ Emoji appears on category rows; picker saves to DB
✅ Checkbox select works; bulk snooze + hide calls correct endpoints
✅ Undo reverses the last move; budget data refreshes
✅ Recent Moves panel shows last 20 moves with inline undo
✅ Inspector opens on category click, shows correct data
✅ Inspector Quick Assign updates assigned amount immediately
✅ Monthly Summary reappears when Inspector is closed
✅ All new DB columns have migrations that run without errors
