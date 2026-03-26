# Personal Assistant - Money Module v2
# REDESIGN-PHASE-9.md — Polish, Budget Intelligence & Automation

<!--
  COPILOT INSTRUCTIONS
  =====================
  Standalone spec for Phase 9 ONLY.
  Phases 1–8 must be complete before starting.
  Each step = one commit. Work in exact step order.

  How to focus Copilot:
    "Implement Phase 9 Step 1 — add markdown rendering to AI responses"
    "Implement Phase 9 Step 8 — build end-of-month forecast endpoint"
-->

---

## Goal

Phase 9 has three tracks running in parallel:
- **Track A — Polish:** Make everything feel production-quality
- **Track B — Budget Intelligence:** Proactive AI-powered insights
- **Track C — Automation:** Recurring transactions + auto-assign rules

Build in the order shown (A first, then B, then C).

---

## Track A — Polish

### A1. Markdown rendering in AI responses

AI responses currently show raw `**bold**`, `\n`, and
numbered lists as plain text. Render them properly.

**Install:**
```bash
npm install react-markdown
```

**Apply to:** `src/components/assistant/ChatMessage.tsx`
Replace the plain `<p>` text render with:
```tsx
import ReactMarkdown from 'react-markdown'
<ReactMarkdown className="prose prose-invert prose-sm max-w-none">
  {content}
</ReactMarkdown>
```

Add to `tailwind.config.ts`:
```ts
plugins: [require('@tailwindcss/typography')]
```
```bash
npm install @tailwindcss/typography
```

---

### A2. Skeleton loading states

Replace blank page flashes with skeleton loaders on:
- Budget page (category rows)
- Transactions page (table rows)
- Reflect page (charts)
- AI Assistant (conversation history sidebar)

**Skeleton component:**
```tsx
// src/components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[#2a2a4a] ${className}`} />
  )
}
```

**Usage in Budget page (while loading):**
```tsx
{loading ? (
  Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="flex items-center gap-4 px-4 py-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-16 ml-auto" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
    </div>
  ))
) : ( ... )}
```

Apply consistently across all 4 pages listed above.

---

### A3. Toast notification system

Currently there is no feedback for successful actions
(assigned, deleted, moved, etc.).

**Build:** `src/components/ui/Toast.tsx` + `src/hooks/useToast.ts`

```tsx
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // default 3000ms
}
```

**Visual:**
Bottom-center of screen, z-50
[✓ EUR 20 moved from Coffee & Drink to Savings]
bg-[#2a2a4a] border border-[#3a3a5a] text-white
rounded-lg px-4 py-2 shadow-lg
Auto-dismisses after 3s, slides in from bottom

text

**Trigger toast on:**
- Assign money to category → "EUR X assigned to [category]"
- Move money between categories → "EUR X moved: [from] → [to]"
- Delete transaction → "Transaction deleted" + [Undo] link
- Flag a transaction → "Transaction flagged [color]"
- Clear conversation history → "Conversation history cleared"
- Undo move → "Move undone"

---

### A4. Empty states

Every list/table should have a proper empty state instead of
blank space or "No data".

| Page | Empty trigger | Message |
|---|---|---|
| Transactions | No transactions this month | "No transactions in [month]. [+ Add one →]" |
| AI Conversations | No history | "No conversations yet. Ask anything about your budget." |
| Recent Moves | No moves this month | "No money moved yet in [month]." |
| Stress Test history | No tests run | "No stress tests yet. Try one above." |
| Reflect | No data | "Not enough data yet. Add transactions to see insights." |

Each empty state has: an icon (emoji), a headline, a subline,
and optionally a CTA button.

---

### A5. Mobile responsiveness audit

Review and fix layout issues on screens < 768px:

- **Budget page:** Category row numbers must not overflow.
  Assigned/Activity columns collapse to a single "Assigned"
  column on mobile. Available column stays visible.
- **Reflect page:** Charts stack vertically (already specced
  in Phase 6 — verify it works correctly).
- **AI Assistant:** Compare mode stacks vertically on mobile
  (already specced in Phase 7 — verify it works).
- **Transactions:** Table horizontally scrollable on mobile,
  not wrapping.
- **Settings:** All sections full-width on mobile.

---

### A6. Error boundaries with recovery UI

Wrap all major page components in an ErrorBoundary that
shows a recovery screen instead of a blank white crash.

```tsx
// src/components/ui/ErrorBoundary.tsx
<ErrorBoundary fallback={
  <div className="flex flex-col items-center justify-center h-64 gap-4">
    <p className="text-gray-400">Something went wrong on this page.</p>
    <button onClick={() => window.location.reload()}
      className="btn-primary">Reload page</button>
  </div>
}>
  <PageComponent />
</ErrorBoundary>
```

Apply to: Budget, Transactions, Reflect, Assistant, Settings.
(Already applied to Assistant in Phase 7 — verify and extend.)

---

## Track B — Budget Intelligence

### B1. Spending trend endpoint
GET /api/intelligence/trends?months=3

text

**Response:**
```json
{
  "trends": [
    {
      "category_id": 5,
      "category_name": "Food Delivery",
      "group_name": "Just for Fun",
      "avg_3mo": 85.20,
      "current_month": 111.00,
      "pct_change": +30.3,
      "direction": "up",
      "alert": true
    }
  ]
}
```

**Alert threshold:** `pct_change > 20%` triggers `alert: true`.
Return top 5 by `pct_change DESC` where `alert = true`.

---

### B2. End-of-month forecast endpoint
GET /api/intelligence/forecast?month=2026-03

text

**Logic:**
days_elapsed = today's day number
days_in_month = total days in month
daily_rate = total_spent_so_far / days_elapsed
projected_total = daily_rate * days_in_month
projected_overspend = projected_total - total_assigned

text

**Response:**
```json
{
  "month": "2026-03",
  "days_elapsed": 26,
  "days_remaining": 5,
  "spent_so_far": 1653.08,
  "assigned_total": 1496.12,
  "daily_rate": 63.58,
  "projected_total": 1970.98,
  "projected_overspend": 474.86,
  "on_track": false,
  "message": "At this rate you'll overspend by EUR 474.86 by March 31."
}
```

---

### B3. Intelligence widget on Budget right sidebar

Below the Auto-Assign section, add an **Insights** widget.

**Visual:**
Insights [×]
──────────────────────────────────────
📈 Food Delivery up 30% vs last 3mo
📈 Coffee & Drink up 24% vs last 3mo
📅 At this rate: overspend by €475
──────────────────────────────────────
[Ask AI about this →]

text

- Fetches from `/api/intelligence/trends` and `/api/intelligence/forecast`
- "Ask AI about this →" pre-fills the AI Assistant with:
  "Looking at my spending trends, what should I adjust this month?"
- Dismiss (×) hides for the session (localStorage, resets on reload)

---

### B4. Weekly digest (manual trigger, not scheduled)

A "Generate Weekly Digest" button in the AI Assistant
quick actions area.

When clicked, sends this message to the selected model:
Generate a brief weekly budget digest for the week of
[current week dates]. Include:

Top 3 categories by spending this week

Any categories that went overspent this week

Progress toward monthly targets

One specific recommendation for the remaining days
Keep it under 150 words.

text

The budget context (already injected on every AI call)
provides all the data needed — no extra endpoint required.

---

## Track C — Automation

### C1. Schema additions

```sql
-- Recurring transaction templates
CREATE TABLE IF NOT EXISTS recurring_templates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payee           TEXT NOT NULL,
  category_id     INTEGER NOT NULL,
  amount          REAL NOT NULL,
  memo            TEXT,
  frequency       TEXT NOT NULL,
  -- 'monthly' | 'weekly' | 'biweekly' | 'yearly'
  next_due        TEXT NOT NULL,  -- ISO date YYYY-MM-DD
  day_of_month    INTEGER,        -- for monthly recurrence
  active          INTEGER DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Auto-assign rules
CREATE TABLE IF NOT EXISTS auto_assign_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL,
  rule_type       TEXT NOT NULL,
  -- 'fixed_amount' | 'last_month_spent' | 'average_3mo' | 'target_amount'
  fixed_amount    REAL,           -- used if rule_type = 'fixed_amount'
  priority        INTEGER DEFAULT 0,
  active          INTEGER DEFAULT 1
);
```

---

### C2. Recurring transactions API
GET /api/recurring — list all templates
POST /api/recurring — create template
PUT /api/recurring/:id — update template
DELETE /api/recurring/:id — delete template
POST /api/recurring/:id/apply — manually apply one occurrence
GET /api/recurring/due?date=2026-03-27 — list templates due on or before date

text

**`POST /api/recurring/:id/apply`** creates a real transaction
in the `transactions` table and updates `next_due` on the template.

---

### C3. Recurring transactions UI

Add a **"Recurring"** section to the Transactions page
(tab or collapsible section at top):
RECURRING TRANSACTIONS
──────────────────────────────────────────────────────
🔄 Rent Shared Expenses €300.00 Due Apr 1 [Apply] [Edit]
🔄 Vodafone Mobile Obligations €57.00 Due Apr 5 [Apply] [Edit]
🔄 Spotify Subscriptions €2.50 Due Apr 8 [Apply] [Edit]
──────────────────────────────────────────────────────
[+ New Recurring]

text

**Recurring transaction form fields:**
- Payee
- Category (dropdown)
- Amount
- Memo (optional)
- Frequency: Monthly / Weekly / Biweekly / Yearly
- Day of month (for Monthly)
- Start date

**Recurring icon:** Small 🔄 icon on transaction rows in the
main list where the transaction was created from a template.

---

### C4. Auto-assign rules UI

Replace the existing "Auto-Assign" section in the right sidebar
with a configurable version.

Each category can have a rule:

| Rule type | Description |
|---|---|
| `fixed_amount` | Always assign this exact amount |
| `last_month_spent` | Assign what was spent last month |
| `average_3mo` | Assign the 3-month spending average |
| `target_amount` | Assign the full target amount |

**UI:** In the Category Inspector (Phase 8), add an
"Auto-Assign Rule" section at the bottom:
Auto-Assign Rule
[Average 3 months ▼] [Save]

text

**"Auto-Assign All" button behavior (updated):**
Runs each active rule in priority order. Categories with no
rule fall back to `target_amount` if one exists, else skip.

---

## Phase 9 Build Order
── Track A ──
Step 1 — A1: Markdown rendering in AI chat responses
Step 2 — A2: Skeleton loading states (all 4 pages)
Step 3 — A3: Toast notification system + wire to all actions
Step 4 — A4: Empty states (all 5 locations)
Step 5 — A5: Mobile responsiveness audit + fixes
Step 6 — A6: Error boundaries (all 5 pages)

── Track B ──
Step 7 — B1: /api/intelligence/trends endpoint
Step 8 — B2: /api/intelligence/forecast endpoint
Step 9 — B3: Insights widget in right sidebar
Step 10 — B4: Weekly digest quick action in AI Assistant

── Track C ──
Step 11 — C1+C2: Schema + recurring templates backend
Step 12 — C3: Recurring transactions UI in Transactions page
Step 13 — C4: Auto-assign rules + updated Auto-Assign button

text

---

## Success Criteria

✅ AI responses render bold, lists, and newlines correctly
✅ Skeleton loaders appear on all 4 pages while data loads
✅ Toast appears after every assign/move/delete action
✅ Empty states show on all 5 locations
✅ Budget page columns don't overflow on mobile
✅ Page crashes show ErrorBoundary recovery UI
✅ Trends endpoint returns categories with >20% increase
✅ Forecast shows correct projected overspend/surplus
✅ Insights widget updates daily, dismiss works per session
✅ Weekly digest quick action sends correct pre-built prompt
✅ Recurring templates can be created, edited, deleted
✅ "Apply" creates a real transaction + updates next_due
✅ Recurring icon appears on transactions from templates
✅ Auto-assign rules save per category and apply on "Auto-Assign All"
