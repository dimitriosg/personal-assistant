# Personal Assistant - Money Module v2
# REDESIGN-PHASE-10.md — Export & History

<!--
  COPILOT INSTRUCTIONS
  =====================
  Standalone spec for Phase 10 ONLY.
  Phases 1–9 must be complete before starting.
  Each step = one commit. Work in exact step order.

  How to focus Copilot:
    "Implement Phase 10 Step 1 — build annual spending breakdown endpoint"
    "Implement Phase 10 Step 5 — build PDF export for monthly summary"
-->

---

## Goal

Add the ability to look back, analyze patterns over time,
and export data. Four features:

1. **Year-in-Review** — annual spending breakdown by category
2. **Budget vs Actual report** — category performance over 12 months
3. **Net Worth Tracker** — assets vs liabilities trend over time
4. **Export** — PDF monthly summary + CSV transactions

---

## New Page: Reports (`/reports`)

Add "Reports" to the left sidebar between Reflect and Settings.

### Sub-pages (tabs at top of Reports page)
[Year in Review] [Budget vs Actual] [Net Worth] [Export]

text

---

## Feature 1: Year-in-Review

### Endpoint: `GET /api/reports/year-in-review?year=2026`

```json
{
  "year": 2026,
  "total_income": 15000.00,
  "total_spent": 14821.50,
  "net": 178.50,
  "by_group": [
    {
      "group_name": "Shared Expenses",
      "total": 6768.00,
      "pct_of_total": 45.7,
      "by_month": 
    }
  ],
  "top_categories": [
    { "name": "Rent", "total": 3600.00, "pct": 24.3 },
    { "name": "Food Delivery", "total": 1332.00, "pct": 9.0 }
  ],
  "best_month": { "month": "2026-02", "spent": 1101.20 },
  "worst_month": { "month": "2026-01", "spent": 1890.40 }
}
```

### UI
Year in Review — 2026 [2025 ▼] [2026 ▼]
─────────────────────────────────────────────
Total Income EUR 15,000
Total Spent EUR 14,821 98.8% of income
Net EUR 178 ↑ you saved money

TOP SPENDING GROUPS (bar chart)
Shared Expenses ████████████████████████ 45.7% EUR 6,768
True Expenses ████████████ 18.2% EUR 2,698
Just for Fun ███████ 10.8% EUR 1,601

TOP 10 CATEGORIES (table)

Category Total % of year
1 Rent EUR 3,600 24.3%
2 Food Delivery EUR 1,332 9.0%
...

MONTHLY HEATMAP
Jan Feb Mar Apr May Jun ...
€1890 €1101 €1653 - - -
🔴 🟢 🟡

text

**Heatmap colors:**
- `bg-green-500/40` = below average month
- `bg-yellow-500/40` = near average
- `bg-red-500/40` = above average month

---

## Feature 2: Budget vs Actual

### Endpoint: `GET /api/reports/budget-vs-actual?months=12`

```json
{
  "months": ["2025-04", "2025-05", ..., "2026-03"],
  "categories": [
    {
      "id": 5,
      "name": "Food Delivery",
      "group": "Just for Fun",
      "rows": [
        { "month": "2025-04", "assigned": 95, "spent": 87, "variance": +8 },
        { "month": "2025-05", "assigned": 95, "spent": 111, "variance": -16 }
      ],
      "avg_assigned": 95.0,
      "avg_spent": 98.5,
      "overspent_months": 4,
      "underspent_months": 8
    }
  ]
}
```

### UI

Scrollable table, one row per category, one column per month.
Category Apr May Jun Jul ... Mar Avg Assigned Avg Spent
Food Delivery +8 -16 +3 -5 ... -16 €95 €98.50
Coffee & Drink +12 -8 +1 +4 ... -20 €76 €84.20

Color: green cell = positive variance, red cell = negative

text

Filter by group dropdown at top.

---

## Feature 3: Net Worth Tracker

### Schema addition

```sql
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,  -- YYYY-MM-DD (first of month)
  assets      REAL NOT NULL DEFAULT 0,
  liabilities REAL NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Endpoints
GET /api/net-worth — all snapshots
POST /api/net-worth — create snapshot
PUT /api/net-worth/:id — update snapshot
DELETE /api/net-worth/:id — delete snapshot

text

### UI

**Left: manual entry form**
Add Snapshot — March 2026
Assets: [EUR ________]
Liabilities: [EUR ________]
Notes: [optional]
[Save →]

text

**Right: line chart (last 12 months)**
EUR
12,000 ┤ ···
10,000 ┤ ····
8,000 ┤ ···
6,000 ┤ ··
4,000 ┼──────────────────── months
Oct Nov Dec Jan Feb Mar
── Assets ── Liabilities ── Net Worth

text

**Summary below chart:**
Net Worth today: EUR 4,821
12 months ago: EUR 2,103
Change: +EUR 2,718 (+129%)

text

---

## Feature 4: Export

### 4A. CSV Export — Transactions
GET /api/export/transactions?month=2026-03&format=csv

text

Returns CSV with columns:
Date,Payee,Category,Group,Memo,Outflow,Inflow,Balance
2026-03-25,Starbucks,Coffee & Drink,Just for Fun,,5.30,,

text

**UI button:** On Transactions page top bar:
`[⬇ Export CSV]` → calls endpoint with current filters

---

### 4B. PDF Export — Monthly Summary
GET /api/export/monthly-summary?month=2026-03

text

**Uses:** `puppeteer` (server-side HTML → PDF) or
`jsPDF` + `html2canvas` (client-side).

**Recommendation:** Use client-side `html2canvas` + `jsPDF`
since Puppeteer requires a separate process.

```bash
npm install jspdf html2canvas
```

**PDF content (one page, A4):**
Personal Assistant — March 2026

SUMMARY
Ready to Assign: EUR 165.50
Total Assigned: EUR 1,496.12
Total Spent: EUR 1,653.08
Expected Income: EUR 1,250.00
Cost to Be Me: EUR 1,613.29

CATEGORY BREAKDOWN
[table: group | assigned | spent | available]

OVERSPENT CATEGORIES
[list with amounts]

Generated: March 26, 2026

text

**UI button:** On Budget page right sidebar:
`[⬇ Export PDF]` below Monthly Summary

---

### 4C. JSON Export — Full Data Backup
GET /api/export/backup

text

Returns a full JSON dump of all tables for backup/portability.

**UI:** In Settings → Data section:
`[⬇ Download backup (JSON)]`

---

## Phase 10 Build Order
Step 1 — Backend: /api/reports/year-in-review endpoint
Step 2 — Frontend: Year in Review UI (bar chart + top categories table + heatmap)
Step 3 — Backend: /api/reports/budget-vs-actual endpoint
Step 4 — Frontend: Budget vs Actual table UI
Step 5 — Schema: net_worth_snapshots table + CRUD endpoints
Step 6 — Frontend: Net Worth tracker (form + line chart)
Step 7 — Backend: /api/export/transactions CSV endpoint
Step 8 — Frontend: CSV export button on Transactions page
Step 9 — Frontend: PDF export (jsPDF + html2canvas) on Budget page
Step 10 — Backend + Frontend: JSON backup export in Settings
Step 11 — Frontend: Reports page shell + tab navigation + /reports route

text

---

## Success Criteria

✅ Year-in-Review loads data for selected year
✅ Monthly heatmap colors reflect above/below average correctly
✅ Budget vs Actual table shows correct variance per cell
✅ Net worth snapshots save and display on line chart
✅ CSV export downloads correctly formatted file
✅ PDF export renders clean single-page summary
✅ JSON backup contains all tables and can be inspected
✅ /reports route accessible from sidebar navigation
✅ All charts handle empty data (< 2 months) gracefully
