# Personal Assistant - Money Module v2

# REDESIGN.md - Phase 6: Reflect \& Coaching Layer

```
HOW TO USE THIS FILE WITH COPILOT
==================================
This is a standalone spec for Phase 6 ONLY.

Instructions for Copilot:
  "Implement Phase 6 Step 1 from REDESIGN.md"
  "Implement Phase 6 Step 5 - build SpendingBreakdownList component"

Work through the 10 steps in exact order. Each step = one commit.
```


***

## Overview

**Phase 6 transforms the app from a tracker into a coaching tool.**

Adds:

- **Reflect page** (`/reflect`) with Spending Breakdown, Income vs Spending chart, Month-Ahead progress
- **Coaching nudges** in the right sidebar
- **Shareable summary card** (PNG export)
- **Transaction flags** (color-coded review system)

**Visual benchmark:** YNAB's Reflect tab, Spending Breakdown, Income vs Spending chart, Share Your Progress feature, and flag filtering.[^1]

**Tech stack:** React + TypeScript + Tailwind CSS + Node/Express + SQLite + Vite (unchanged).

**Timeline:** 10 steps, 2-3 days total if working sequentially.

***

## Design Principles (Phase 6)

1. **Insights over raw data.** Reflect shows *what it means*, not just numbers.
2. **Coaching, not reporting.** Every chart/panel has a clear next action.
3. **Compact \& scannable.** High information density, no giant charts.
4. **Progressive disclosure.** Start simple, expand on interaction.
5. **Privacy-first sharing.** Shareable card has "hide amounts" toggle.
6. **Dark mode consistency.** All new components use existing color palette.

***

## Layout Changes

### Desktop: Add Reflect to left sidebar

```
LEFT SIDEBAR (updated)
─────────────────────────────
App name
─────────────────────────────
• Budget
• Transactions  
• Stress Test
• Postpone
• Calendar
• Prompt
• Reflect    ← NEW
• Settings
─────────────────────────────
Accounts summary
```


### Mobile: Update bottom tabs

```
Budget | Transactions | Reflect    ← "Tools" → "Reflect"
```


***

## Data Model Changes

### Single migration

```sql
-- Add to existing transactions table (run once)
ALTER TABLE transactions ADD COLUMN flag_color TEXT DEFAULT NULL;
-- Values: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | NULL
```

**No other schema changes.** All analytics are computed from existing tables:

- `transactions` (activity/income)
- `monthly_budgets` (assigned amounts)
- `category_targets` (cost to be me)
- `income` (forecasting)

***

## New API Endpoints

### Base path: `/api/analytics`


***

#### `GET /api/analytics/spending-breakdown`

**Params:**


| Param | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `from` | string | current mo | `YYYY-MM` start date |
| `to` | string | current mo | `YYYY-MM` end date |
| `groupBy` | string | `group` | `group` or `category` |

**Response:**

```json
{
  "period": {"from": "2026-01", "to": "2026-03"},
  "total_spent": 4820.50,
  "avg_per_month": 1606.83,
  "avg_per_day": 53.56,
  "items": [
    {
      "id": 1,
      "name": "Shared Expenses",
      "type": "group", 
      "total": 1692.00,
      "pct_of_total": 35.1,
      "avg_per_month": 564.00,
      "categories": [
        {"id": 3, "name": "Groceries", "total": 591.00, "pct_of_group": 34.9}
      ]
    }
  ]
}
```

**Implementation notes:**

- Filter `t.amount < 0` (outflows only)
- Cache results for 5 minutes (session-level)
- If `groupBy=category`, return flat list (no nested categories array)

***

#### `GET /api/analytics/income-vs-spending`

**Params:**


| Param | Type | Default | Max |
| :-- | :-- | :-- | :-- |
| `months` | number | 6 | 12 |

**Response:**

```json
{
  "months": [
    {"month": "2025-10", "income": 1250.00, "spending": 1580.00, "net": -330.00},
    {"month": "2025-11", "income": 1250.00, "spending": 1210.00, "net": 40.00}
  ],
  "summary": {
    "surplus_months": 2,
    "deficit_months": 4,
    "total_net": -583.00,
    "avg_monthly_income": 1391.67,
    "avg_monthly_spending": 1488.83
  }
}
```


***

#### `GET /api/analytics/month-ahead`

**Response:**

```json
{
  "next_month": "2026-04",
  "assigned_in_future": 165.50,
  "cost_to_be_me": 1613.29, 
  "progress_pct": 10.3,
  "months_to_fully_ahead": 9,
  "message": "You\'ve assigned EUR 165.50 toward April. You need EUR 1,447.79 more."
}
```


***

#### `PATCH /api/transactions/:id/flag`

**Body:** `{"flag_color": "red" | "orange" | "yellow" | "green" | "blue" | "purple" | null}`

**Response:** `{"id": 42, "flag_color": "red"}`

***

## New Components

| Component | Location | Dependencies |
| :-- | :-- | :-- |
| `SpendingBreakdownList` | `/reflect` | `/spending-breakdown` |
| `IncomeVsSpendingChart` | `/reflect` | `/income-vs-spending` |
| `MonthAheadWidget` | `/reflect` | `/month-ahead` |
| `CoachingNudges` | `MonthlySummary` sidebar | Budget data |
| `ShareableCard` | `/reflect` | html2canvas |
| `FlagColorPicker` | `TransactionRow` | `/transactions/:id/flag` |


***

## Page: Reflect (`/reflect`)

### Wireframe (Desktop 1440px)

```
+---------------------------------------------------------------------+
|  REFLECT  [This Month ▼]  [By Group ▼]                           [📱Share ▼] |
+---------------------------------------+──────────────────────────────┐
|                                       |                              │
|  █ SPENDING BREAKDOWN                 |  █ INCOME VS SPENDING       │
|  Jan – Mar 2026                       |  Last 6 months              │
|                                       |                              │
|  #  Name              Total   %       |  EUR                        │
|  ─────────────────────────────────────  2,100 ┤                     │
|  1  Shared Expenses   1,692  35% ████  1,800 ┤  ██                   │
|  2  True Expenses     1,050  22% ███  1,500 ┤  ██  ██                │
|  3  Just for Fun        762  16% ██   1,200 ┤  ██  ██  ██  ██        │
|  4  Car                 561  12% ██    900  ┤                       │
|  5  Obligations         213   4% █     600  ┤                       │
|     Everything else     543  11% ██     300 ┤                       │
|  ─────────────────────────────────────     0 └─Oct Nov Dec─Jan Feb Mar│
|  TOTAL              EUR 4,821              ■ Income ■ Spending        │
|                                       |                              │
|  Avg/mo EUR 1,607 | Avg/day EUR 53.56  |  Last 6 mo: 2 surplus, 4 deficit │
|  Most overspent: Coffee & Drink +€20   |  Net: −EUR 583                    │
+───────────────────────────────────────┼──────────────────────────────┤
|                                                                              │
|  🎯 MONTH-AHEAD PROGRESS                                                        │
|                                                                              │
|  Assigned toward April     EUR 165.50                                        │
|  April\'s Cost to Be Me     EUR 1,613.29                                      │
|                                                                              │
|  ████░░░░░░░░░░░░░░░░░░░░░░ 10%                                               │
|                                                                              │
|  "You need EUR 1,448 more to be a month ahead." [Assign Now →]                │
|                                                                              │
+──────────────────────────────────────────────────────────────────────────────┘
```


***

### Filter Bar Implementation

```tsx
interface Filters {
  period: 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'last_12';
  groupBy: 'group' | 'category';
}

const periodOptions = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3' },
  // ...
];
```

**Share button** (right side): opens `ShareableCard` modal.

***

### Spending Breakdown Panel

**Exact table spec:**


| Column | Width | Content example |
| :-- | :-- | :-- |
| Rank | 24px | `1` `2` `3` |
| Name | 50% | "Shared Expenses" |
| Total | 20% | "EUR 1,692" |
| % | 12% | "35%" |
| Bar | 16% | `███████████████████░░░░░░░░░░` |

**Features:**

- Click row → expand/collapse nested categories (if `groupBy=group`)
- Hover row → tooltip with `avg_per_month`, `avg_per_day`
- Top 5 rows shown + "Everything else" row for remainder
- Mini stats block below table
- Bar color = category group accent color (same palette as Budget page)

***

### Income vs Spending Chart

**Chart requirements:**

```
- 6 bars (or fewer if data < 6 months)
- Grouped: green income bar + red spending bar per month
- X-axis: abbreviated month names (Oct Nov Dec)
- Y-axis: EUR, right-aligned labels, starts at 0
- Hover tooltip: "Oct 2025: Income €1,250 | Spending €1,580 | Net −€330"
- Responsive: stacks to vertical on mobile
```

**Summary below chart:**

```
Last 6 months: 2 surplus months (+EUR 490 total)
               4 deficit months (−EUR 1,073 total)
Net position: −EUR 583
```

Color: `text-green-400` if `total_net > 0`, `text-red-400` if negative.

***

### Month-Ahead Widget

**States:**


| Progress | Copy | Button |
| :-- | :-- | :-- |
| < 100% | "You\'ve assigned €165 toward April. Need €1,448 more." | "Assign Now →" |
| 100% | "🎉 You\'re a month ahead! Great job." | "View April →" |
| No surplus | "Spending > income. Reduce overages first." | "View Budget →" |

**Progress bar:** `w-full h-3 rounded-full bg-gray-700`
Fill: `w-[progress_pct%] h-full bg-gradient-to-r from-purple-500 to-blue-500`

***

## Right Sidebar: Coaching Nudges

### Location

Insert below "Auto-Assign" block in existing `MonthlySummary` component.

### Visual spec

```
Insights
──────────────────────────
⚠️ Coffee & Drink     overspent €20
⚠️ Food Delivery      overspent €16  
✅ Car                under by €2
💡 Move €36 from Drink Out → Coffee
```


### Selection logic

```
1. Get overspent = categories WHERE available < 0
   ORDER BY ABS(available) DESC
   LIMIT 2

2. Get under_budget = categories WHERE available > target * 0.1
   AND group NOT IN ('Savings', 'Goals')
   ORDER BY available DESC
   LIMIT 1

3. Suggested move:
   IF SUM(overspent amounts) <= under_budget.available:
     Show move suggestion
   ELSE:
     null
```

**Dismiss:** `×` button per nudge. Store in `localStorage`:

```js
localStorage.setItem(`nudges_dismissed_${currentMonth}`, JSON.stringify(dismissedIds));
```

Reset monthly.

***

## Shareable Card

### Trigger

"📱 Share" button (top-right Reflect page) → modal with card preview.

### Card design (600×340px)

```
+---------------------------------------+
|  💜  My Budget — March 2026            |
|                                        |
|  ████████████████░░░░░  82% funded     |
|  4 categories overspent               |
|  Month-ahead: 10% there               |
|                                        |
|  ✦  Built with Personal Assistant     |
+---------------------------------------+
```


### Toggle

```
[ Show amounts ]  [ Hide amounts ] ← switch
               [ Download PNG ]
```

**Hide mode:** `EUR 1,692` → `█████`

### Implementation

```
npm install html2canvas
```

```tsx
const downloadCard = async () => {
  const card = document.getElementById('shareable-card');
  const canvas = await html2canvas(card, {
    backgroundColor: '#1a1a2e',
    scale: 2
  });
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `budget-${month}.png`;
  link.click();
};
```


***

## Transaction Flags

### UI locations

1. **Transaction row:** Small colored dot next to date column

```
25.03 ● Anipan Ee   Coffee & Drink  €5.30
          ↑ clickable
```

2. **Flag picker popover** (click dot):

```
      ● ● ● ● ● ● ✕
    🔴🟠🟡🟢🔵🟣 Remove
```

3. **Transactions filter bar** (add to existing filters):

```
[All] [🚩 Flagged] [🔴] [🟠] [🟡] [🟢] [🔵] [🟣]
```


### Colors (Tailwind classes)

| Flag | Background |
| :-- | :-- |
| red | `bg-red-500` |
| orange | `bg-orange-400` |
| yellow | `bg-yellow-400` |
| green | `bg-green-500` |
| blue | `bg-blue-500` |
| purple | `bg-purple-500` |


***

## Phase 6 Build Order (Copilot Steps)

**Each step = 1 commit. Point Copilot to exact step numbers.**

```
Step 1: Backend - analytics router + spending-breakdown endpoint + tests
Step 2: Backend - income-vs-spending endpoint + tests  
Step 3: Backend - month-ahead endpoint + tests
Step 4: Frontend - Reflect page shell + filter bar + API integration
Step 5: Frontend - SpendingBreakdownList component + styling
Step 6: Frontend - IncomeVsSpendingChart component + Recharts/chart
Step 7: Frontend - MonthAheadWidget component + states
Step 8: Frontend - CoachingNudges component + MonthlySummary integration
Step 9: Frontend - ShareableCard component + html2canvas export
Step 10: Frontend - FlagColorPicker + migration + Transactions UI integration
```


***

## Success Criteria

✅ `/reflect` loads in <1s with correct data
✅ Spending Breakdown totals match Budget Activity column
✅ Income chart shows correct surplus/deficit count
✅ Month-Ahead shows 100% state when fully funded
✅ Nudges appear only when overspent categories exist
✅ PNG export works with/without amounts
✅ Transactions can be flagged + filtered by color
✅ All endpoints handle empty data (no transactions)
✅ Mobile layout stacks correctly (Reflect page)

***

**Download:**

Copy the full markdown above, save as `REDESIGN-PHASE-6.md`, upload to repo. Copilot can now work step-by-step through the 10 numbered steps.

<div align="center">⁂</div>

[^1]: YNAB-Product-Updates-Since-Launch-through-March-26-2026.md

