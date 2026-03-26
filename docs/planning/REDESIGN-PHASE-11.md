# Personal Assistant - Money Module v2
# REDESIGN-PHASE-11.md — Current Goal, Future Months & Extended Sharing

<!--
  COPILOT INSTRUCTIONS
  =====================
  Standalone spec for Phase 11 ONLY.
  Phases 1–10 must be complete before starting.
  Each step = one commit. Work in exact step order.

  How to focus Copilot:
    "Implement Phase 11 Step 1 — add pinned_category to settings"
    "Implement Phase 11 Step 4 — build Future Months panel"
-->

---

## Goal

Three features inspired by recent YNAB updates (2025–2026):

1. **Current Goal (Pinned Category)** — highlight one focus
   category on the Budget page right sidebar
2. **Future Months Panel** — see money pre-assigned to April,
   May, etc. with a month-ahead progress tracker
3. **Extended Shareable Card** — add a Net Worth chart variant
   to the existing shareable card from Phase 6

Excluded from this phase: Siri/Shortcuts, in-app content feed.

---

## Feature 1: Current Goal (Pinned Category)

### Concept

The user picks one category as their current focus goal.
It appears as a prominent widget in the Budget page right
sidebar, above Monthly Summary. Shows progress, amount
remaining, and a motivational message.

---

### Schema addition

```sql
ALTER TABLE settings ADD COLUMN pinned_category_id INTEGER DEFAULT NULL;
```

### Endpoint additions
GET /api/settings — already exists, now includes pinned_category_id
PUT /api/settings — already exists, now accepts pinned_category_id
GET /api/categories/:id/goal-progress — returns progress toward the category's target

text

**`GET /api/categories/:id/goal-progress` response:**
```json
{
  "category_id": 42,
  "category_name": "PS5",
  "emoji": "🎮",
  "assigned_total": 60.00,
  "target_amount": 449.00,
  "progress_pct": 13.4,
  "remaining": 389.00,
  "target_date": null,
  "months_to_goal": 7,
  "message": "At EUR 60/mo you'll reach your goal in ~7 months."
}
```

**`months_to_goal` calculation:**
months_to_goal = CEIL(remaining / avg_monthly_assigned)
avg_monthly_assigned = average of last 3 months assigned to this category

text

---

### UI: Current Goal widget

Location: top of right sidebar on Budget page, above Monthly Summary.
Collapsed by default if no goal is pinned.
+──────────────────────────────────────+

+──────────────────────────────────────+

🎯 CURRENT GOAL [✎]
🎮 PS5
████░░░░░░░░░░░░░░░░ 13%
EUR 60 of EUR 449
At EUR 60/mo — goal in ~7 months
EUR 389.00 remaining
[+ Assign more this month →]
+──────────────────────────────────────+

text

**States:**

| State | UI |
|---|---|
| No goal pinned | Widget shows "No goal set. [Pin a category →]" |
| Goal set, in progress | Progress bar + months estimate |
| Goal reached (100%) | `🎉 Goal reached! [View next goal →]` |

**[✎] edit button:** Opens a modal to pick a new pinned category.

**Category picker for goal:**
- Shows only categories with a target_amount set
- Grouped dropdown, same style as category picker elsewhere

**"+ Assign more this month" button:**
Opens the Category Inspector (Phase 8) for the pinned category.

---

## Feature 2: Future Months Panel

### Concept

Shows money already assigned to future months (April, May, etc.)
and tracks progress toward being "a month ahead." Extends the
Month-Ahead widget from Phase 6 with a multi-month view.

---

### Endpoint: `GET /api/budget/future-months`

```json
{
  "current_month": "2026-03",
  "cost_to_be_me": 1613.29,
  "months": [
    {
      "month": "2026-04",
      "label": "April 2026",
      "assigned": 165.50,
      "cost_to_be_me": 1613.29,
      "progress_pct": 10.3,
      "fully_funded": false,
      "surplus": 0
    },
    {
      "month": "2026-05",
      "label": "May 2026",
      "assigned": 0,
      "cost_to_be_me": 1613.29,
      "progress_pct": 0,
      "fully_funded": false,
      "surplus": 0
    }
  ],
  "overall_months_ahead": 0.1
}
```

**Logic:**
- `assigned` = SUM of monthly_budgets.assigned WHERE month = future month
- `progress_pct` = (assigned / cost_to_be_me) * 100
- `fully_funded` = assigned >= cost_to_be_me
- `overall_months_ahead` = SUM of all future progress_pct / 100

---

### UI: Future Months panel

New page section accessible from two places:
1. **Button on Budget toolbar:** `[📅 Future Months]`
   → opens a slide-in panel (same style as Recent Moves)
2. **Month-Ahead widget on Reflect page** (Phase 6):
   "View all future months →" link at the bottom
Future Months [✕]
────────────────────────────────────────
Overall progress toward month-ahead
████░░░░░░░░░░░░░░░░░░░░░░ 10%

April 2026
████░░░░░░░░░░░░░░░░░░░░░░ 10% EUR 165.50 of EUR 1,613.29
[+ Assign to April →]

May 2026
░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% EUR 0 of EUR 1,613.29
[+ Assign to May →]

June 2026
░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% EUR 0 of EUR 1,613.29
[+ Assign to June →]
────────────────────────────────────────
💡 Tip: Assign your next month first.
Even EUR 50/mo compounds into peace
of mind quickly.
────────────────────────────────────────

text

**"+ Assign to [Month] →" behavior:**
Navigates to the Budget page for that future month
(month selector jumps to that month) so the user can
assign directly.

---

## Feature 3: Extended Shareable Card

Phase 6 built a shareable card for monthly budget status.
This extends it with a Net Worth variant.

### New card type: Net Worth Progress

Add a second card option in the Share modal on the Reflect page:
[ Budget Summary] [ Net Worth Progress] ← toggle

text

**Net Worth card (600×340px):**
+──────────────────────────────────────────+

💜 My Net Worth — March 2026
████████████████████░░░░ +129% this year
From EUR ████ → EUR ████
(amounts hidden in share mode)
✦ Built with Personal Assistant
+──────────────────────────────────────────+

text

**"Hide amounts" toggle** (same as Phase 6 card):
- ON: shows progress % and direction only, amounts blurred
- OFF: shows exact EUR amounts

**Data source:** `net_worth_snapshots` table from Phase 10.
If no snapshots exist, show:
"No net worth data yet. Add your first snapshot in Reports → Net Worth."
[Go to Reports →]

text

### New endpoint
GET /api/share/net-worth-card?month=2026-03

text

```json
{
  "current_net_worth": 4821.00,
  "year_start_net_worth": 2103.00,
  "pct_change": 129.4,
  "direction": "up",
  "snapshot_count": 3
}
```

---

## Phase 11 Build Order
Step 1 — Schema: add pinned_category_id to settings table
Step 2 — Backend: GET /api/categories/:id/goal-progress endpoint
Step 3 — Frontend: Current Goal widget in right sidebar
(pin picker modal, progress bar, assign shortcut)
Step 4 — Backend: GET /api/budget/future-months endpoint
Step 5 — Frontend: Future Months slide-in panel
(toolbar button, per-month bars, assign links)
Step 6 — Frontend: "View all future months" link on Reflect
Month-Ahead widget (Phase 6 component — small addition)
Step 7 — Backend: GET /api/share/net-worth-card endpoint
Step 8 — Frontend: Net Worth card variant in Share modal
(card toggle, hide amounts, html2canvas export)

text

---

## Success Criteria

✅ Pinned category saves to settings and persists on reload
✅ Current Goal widget shows correct progress % and months estimate
✅ Widget shows "No goal set" when nothing is pinned
✅ "Goal reached" state renders when progress = 100%
✅ Future Months panel loads data for next 3 months
✅ Progress bars reflect actual assigned amounts from DB
✅ "Assign to [Month]" navigates to correct future month
✅ Net Worth card renders correctly with Phase 10 snapshot data
✅ "Hide amounts" blurs EUR values in net worth card
✅ Card exports as PNG via html2canvas
✅ Missing net worth data shows graceful fallback message
✅ All 3 features work on mobile (stacked/responsive layout)
