# Personal Assistant - Money Module v2 (Redesign)

## Overview

This is a complete UI/UX redesign of the Personal Assistant Money Module. The app adopts YNAB's envelope budgeting visual model while keeping the decision-operator features (stress test, postpone logic, prompt generator) as integrated tools.

The app should look and feel like a polished personal finance dashboard, not a prototype. YNAB is the visual benchmark.

Stack remains: React + TypeScript + Tailwind CSS + Node/Express + SQLite (node:sqlite) + Vite.

---

## Design Principles

1. **Information density over whitespace.** Show more data per screen. Use compact rows, not large cards.
2. **Category groups are the backbone.** Everything is organized into collapsible category groups with subtotals.
3. **Color-coded amounts.** Green = funded/healthy. Yellow/orange = tight/underfunded. Red = overspent/danger. Gray = zero.
4. **Dark mode default.** Deep dark background (#1e1e2e or similar), with high-contrast text and color accents.
5. **Three-column layout on desktop.** Left sidebar (navigation + accounts summary), main content area, right sidebar (monthly summary). On mobile, collapse to single column with bottom nav.
6. **Fast.** Dashboard loads in under 1 second. No unnecessary animations. Transitions only where they help comprehension (collapsing groups, modals).

---

## Layout Structure

### Desktop (1024px+)

```
+------------------+----------------------------------------+-------------------+
|                  |                                        |                   |
|  LEFT SIDEBAR    |           MAIN CONTENT                 |  RIGHT SIDEBAR    |
|  (200px fixed)   |           (flexible)                   |  (260px fixed)    |
|                  |                                        |                   |
|  - App name      |  - Month selector (top bar)            |  - Month Summary  |
|  - Navigation    |  - Category groups with rows           |  - Income         |
|    - Budget      |  - Or transaction list                 |  - Targets        |
|    - Accounts    |  - Or stress test                      |  - Quick stats    |
|    - Stress Test |  - Or other tool pages                 |                   |
|    - Postpone    |                                        |                   |
|    - Calendar    |                                        |                   |
|    - Prompt      |                                        |                   |
|    - Settings    |                                        |                   |
|                  |                                        |                   |
|  ACCOUNTS        |                                        |                   |
|  (summary panel) |                                        |                   |
|                  |                                        |                   |
+------------------+----------------------------------------+-------------------+
```

### Mobile (<1024px)

```
+---------------------------+
| Top bar (month + menu)    |
+---------------------------+
|                           |
|     MAIN CONTENT          |
|     (full width)          |
|                           |
+---------------------------+
| Bottom tabs               |
| Budget | Trans | Tools    |
+---------------------------+
```

---

## Core Concept Change: Envelope Budgeting

### Previous approach
Simple expense tracking with categories and a "remaining safe to spend" number.

### New approach (YNAB model)
Every euro gets a job. Income is assigned to categories. Each category tracks what was budgeted (assigned), what was spent (activity), and what remains (available).

### How it works

1. **Income arrives** - it goes into "Ready to Assign" (unassigned pool)
2. **You assign money** - distribute from Ready to Assign into category budgets
3. **You spend** - transactions reduce the "available" in their category
4. **You see reality** - each category shows: Assigned | Activity | Available

This is more powerful than the previous flat tracker because:
- You see exactly where your money is going
- Overspending in one category is visible immediately
- You can move money between categories
- "Can I afford this?" becomes: "Does this category have money?"

---

## Page: Budget (Main Page - /)

This is the heart of the app. Modeled directly after YNAB's budget view.

### Top Bar

```
+---------------------------------------------------------------+
|  < Mar 2026 >          Ready to Assign: EUR 165.50            |
+---------------------------------------------------------------+
```

- Month navigation arrows (previous/next month)
- "Ready to Assign" shows unassigned money
- Color: green if > 0, red if negative (overassigned)

### Category Group Structure

Each group is collapsible. Shows group name, and group totals for Assigned | Activity | Available.

```
v  Shared Expenses                    ASSIGNED   ACTIVITY   AVAILABLE
   Rent (300/500)                     EUR 300    -EUR 300   EUR 0.00
   Electricity (70/140)               EUR 70     -EUR 41    EUR 29.00
   Water (5/10)                       EUR 5      EUR 0      EUR 5.00
   Internet + TV + Netflix (26/52)    EUR 26     -EUR 26    EUR 0.00
   Groceries (175/350)                EUR 175    -EUR 197   -EUR 22.00  [RED]
   Building Fees                      EUR 0      EUR 0      EUR 0.00
   House Cleaning                     EUR 0      EUR 0      EUR 0.00
   ---
   Group total                        EUR 576    -EUR 564   EUR 12.00

v  Debt
   Personal Loan                      EUR 40     -EUR 40    EUR 0.00
   Car Installment                    EUR 101    -EUR 101   EUR 0.00

v  Car
   Gas                                EUR 60     -EUR 58    EUR 2.00
   Car Expenses                       EUR 54     -EUR 54    EUR 0.00
   KTEO                               EUR 74     -EUR 74    EUR 0.00
   Car Insurance                      EUR 0      EUR 0      EUR 0.00
   Car Service                        EUR 0      EUR 0      EUR 0.00

v  Immediate Obligations
   Vodafone Mobile                    EUR 57     -EUR 57    EUR 0.00
   Cosmote Mobile                     EUR 13     -EUR 13    EUR 0.00
   Interest & Fees                    EUR 5      -EUR 0.60  EUR 4.40

v  Subscriptions
   Revolut Metal                      EUR 17     -EUR 17    EUR 0.00
   AI (GPT)                           EUR 18     -EUR 17    EUR 0.70
   YouTube                            EUR 8.50   EUR 0      EUR 0.00  [UNDERFUNDED]
   Spotify                            EUR 2.50   EUR 0      EUR 0.00
   YNAB                               EUR 24     EUR 0      EUR 0.00
   ...

v  Savings & Investment
   Savings EUR 100                    EUR 0      EUR 0      EUR 0.00
   Emergency Fund                     EUR 0      EUR 0      EUR 0.00

v  Goals
   PS5                                EUR 60     EUR 0      EUR 0.00
   Boat License                       EUR 0      EUR 0      EUR 0.00

v  True Expenses (irregular but expected)
   Haircut                            EUR 14     -EUR 14    EUR 0.00
   Home & Office                      EUR 206    -EUR 222   -EUR 16.00 [RED]
   Medical                            EUR 13     -EUR 13    EUR 0.00
   Nutritionist                       EUR 0      EUR 0      EUR 0.00
   Transportation                     EUR 61     -EUR 61    EUR 0.00

v  Just for Fun
   Coffee & Drink                     EUR 76     -EUR 96    -EUR 20.00 [RED]
   Food Out                           EUR 0      EUR 0      EUR 0.00
   Drink Out                          EUR 21     EUR 0      EUR 21.00
   Food Delivery                      EUR 95     -EUR 111   -EUR 16.00 [RED]
   Dining Out                         EUR 0      EUR 0      EUR 0.00
   Temu/Impulse                       EUR 0      EUR 0      EUR 0.00
   Fun Money                          EUR 47     -EUR 47    EUR 0.00

v  Personal Care
   Nails                              EUR 0      EUR 0      EUR 0.00
   Face & Body                        EUR 25     -EUR 25    EUR 0.00

v  Quality of Life
   Education                          EUR 40     -EUR 40    EUR 0.00
   Vacation                           EUR 0      EUR 0      EUR 0.00
```

### Column behavior

| Column | What it means | How it's calculated |
|--------|--------------|-------------------|
| ASSIGNED | How much you budgeted for this category this month | User-entered or auto-filled from targets |
| ACTIVITY | How much was spent (negative) or received (positive) | Sum of transactions in this category this month |
| AVAILABLE | What's left to spend | Assigned + Activity + rollover from previous month |

### Color coding for Available column

- **Green**: > 0, funded
- **Yellow/Orange**: 0 but has upcoming target/goal not yet met
- **Red**: < 0, overspent
- **Gray**: exactly 0, fully spent or nothing assigned

### Row interactions

- Click a category row to expand an inline detail panel showing:
  - Target/goal for this category (if set)
  - Recent transactions in this category
  - Quick assign input
  - Move money button (transfer available from another category)
- Right-click or action menu: Edit category, Delete category, Set target

### Group interactions

- Click group header to collapse/expand
- Group header shows totals for all three columns

### Category creation

- "+ Add Category" button at bottom of each group
- "+ Add Group" button at bottom of all groups
- New categories need: name, group, shared (yes/no + split %), target (optional)

---

## Page: Transactions (/transactions)

A full transaction register, similar to YNAB's account view.

### Table columns

```
DATE       | PAYEE              | CATEGORY                    | MEMO           | OUTFLOW  | INFLOW  | RUNNING BALANCE
25.03.2026 | Anipan Ee          | Just for Fun: Coffee & Drink| Eurobank M...  | EUR 5.30 |         | EUR 68.20
24.03.2026 | Wolt               | Just for Fun: Food Delivery | Eurobank M...  | EUR 16.45|         | EUR 73.50
```

### Features

- Add transaction button (top)
- Inline editing (click a cell to edit)
- Category selector dropdown (grouped by category group)
- Filter by: date range, category, payee, inflow/outflow
- Search bar
- Sort by any column
- Color-coded category badges (matching the category group color)
- Running balance column
- Import: manual entry only for v1 (future: CSV import)
- Split transactions: one transaction across multiple categories

### Transaction form fields

- Date (default: today)
- Payee (text, with autocomplete from previous payees)
- Category (dropdown, grouped)
- Memo (optional text)
- Amount (EUR)
- Type: Outflow (expense) or Inflow (income)
- Account (if multiple accounts are supported later; single account for v1)

---

## Page: Stress Test (/stress-test)

Keep the existing stress test feature but integrate it visually into the new design.

### Changes from current version

- Instead of checking against a flat "remaining safe to spend", the stress test now checks the **specific category's available balance**
- Form asks: Item, Price, Category (which budget category would this come from?), Urgency
- Rules updated:
  1. If category available < price: REJECT ("This category only has EUR X left")
  2. If category available - price < 0 AND no other category can cover: REJECT
  3. If Ready to Assign can cover it: SUGGEST ("You'd need to assign EUR X from Ready to Assign")
  4. If urgency = low AND category = impulse: REJECT ("Bad call. Wait.")
  5. If irregular expenses coming within 30 days in same group: WARN ("Bad timing")
  6. If bonus month is next month AND urgency != high: SUGGEST WAIT
  7. If category = need AND urgency = high: APPROVE
- Verdict format unchanged: Verdict > Why > Risk > Next move
- History below the form

---

## Page: Postpone (/postpone)

Same concept, updated to work with the envelope model.

- Scans all categories with targets/goals that are underfunded
- Ranks by priority:
  - Must fund (fixed obligations, overdue)
  - Should fund (regular needs, maintenance)
  - Can postpone (comfort, fun, cosmetic)
  - Should postpone (bad timing, overspent elsewhere)
- Shows how much each postponement frees up
- "Move money" button to reallocate from postponed categories to urgent ones

---

## Page: Calendar (/calendar)

Monthly calendar view showing:

- When bills are due (red dots)
- When subscriptions renew (orange dots)
- When irregular expenses are expected (yellow dots)
- When income arrives (green dots)
- When targets are due (blue dots)

Click a day to see all items on that date.

---

## Page: Prompt Generator (/prompt)

Keep as-is conceptually. Generates a formatted prompt pre-filled with real budget data for Claude.ai.

Updated to include:
- Ready to Assign amount
- Category groups with available balances
- Overspent categories highlighted
- Upcoming targets not yet funded
- Income forecast

---

## Page: Settings (/settings)

- Shared expense default split %
- Currency
- Monthly savings target
- Language preference (reserved: en, el, pt-BR, es-LATAM)
- Reset & Re-run Setup button
- Category group management (rename, reorder, delete groups)
- Data export (JSON)

---

## Right Sidebar: Month Summary

Visible on the Budget page. Shows:

```
March's Summary
--------------------------
Left Over from Last Month    EUR 322.46
Assigned in March            EUR 1,496.12
Activity                     -EUR 1,653.08
Available                    EUR 165.50

Cost to Be Me
--------------------------
March's Targets              EUR 1,613.29
Expected Income              EUR 1,250.00

[Next month's targets could increase
 your total to EUR 1,733.21]

Auto-Assign
--------------------------
Underfunded                  EUR 332.55
Assigned Last Month          EUR 1,173.08
Spent Last Month             EUR 1,428.61
Average Assigned             EUR 2,161
Average Spent                EUR 2,086.06
```

### Fields explained

| Field | Meaning |
|-------|---------|
| Left Over from Last Month | Sum of all positive Available balances carried over |
| Assigned in March | Total assigned to all categories this month |
| Activity | Total spending + income this month |
| Available | Ready to Assign (what's left to distribute) |
| March's Targets | Sum of all category targets for this month |
| Expected Income | Known income for this month |
| Underfunded | How much more needs assigning to meet all targets |
| Assigned/Spent Last Month | Historical reference |
| Average Assigned/Spent | Rolling average for planning |

---

## Data Model Changes

### New tables

#### categories
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT | e.g., "Rent", "Coffee & Drink" |
| group_id | INTEGER FK | references category_groups |
| is_shared | BOOLEAN | |
| custom_split | REAL | nullable, overrides global split |
| sort_order | INTEGER | position within group |
| hidden | BOOLEAN | default false |

#### category_groups
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT | e.g., "Shared Expenses", "Just for Fun" |
| sort_order | INTEGER | display order |
| is_collapsed | BOOLEAN | UI state, default false |

#### monthly_budgets
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| category_id | INTEGER FK | |
| month | TEXT | format: "2026-03" |
| assigned | REAL | amount budgeted this month |

#### category_targets
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| category_id | INTEGER FK | |
| target_type | TEXT | "monthly" / "by_date" / "savings_goal" |
| target_amount | REAL | how much needed |
| target_date | TEXT | for by_date type, ISO date |
| is_recurring | BOOLEAN | repeats monthly? |

#### transactions (replaces old transactions + expenses tables)
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| date | TEXT | ISO date |
| payee | TEXT | who you paid or received from |
| category_id | INTEGER FK | which budget category |
| memo | TEXT | optional note |
| amount | REAL | positive = inflow, negative = outflow |
| cleared | BOOLEAN | reconciled? default false |
| created_at | TEXT | ISO datetime |

### Kept tables

#### income (unchanged)
For tracking expected income sources (salary, bonuses). Used for forecasting.

#### stress_tests (unchanged)
Updated to reference category_id instead of flat category text.

#### settings (unchanged)
Add keys: default_category_groups (JSON blob for initial setup).

### Removed tables

#### expenses
Replaced by categories + monthly_budgets + transactions. The old flat expense model becomes:
- The expense definition = a category with a target
- The expense payment = a transaction against that category
- The monthly budget = an assignment in monthly_budgets

---

## Default Category Groups (created during onboarding)

These are suggested during setup. User can rename, add, remove.

1. **Shared Expenses** - Rent, Utilities, Groceries, Internet, etc.
2. **Debt** - Loans, installments
3. **Immediate Obligations** - Phone bills, bank fees, essential fixed costs
4. **Car** - Gas, maintenance, insurance, service
5. **Subscriptions** - Streaming, apps, tools
6. **Savings & Investment** - Emergency fund, savings goals
7. **Goals** - Specific saving targets (PS5, vacation, etc.)
8. **True Expenses** - Irregular but expected (medical, home, clothing)
9. **Just for Fun** - Coffee, food out, delivery, fun money
10. **Personal Care** - Grooming, health, personal items
11. **Quality of Life** - Education, hobbies, experiences
12. **Additional Expenses** - Catch-all for uncategorized

User can create custom groups beyond these.

---

## Onboarding Flow (Revised)

### Choice screen (same as before)
- Start fresh
- Use demo data
- I'll set it up later

### Start fresh wizard (revised steps)

**Step 1: Basics**
- Currency (EUR default)
- Do you share expenses? (yes/no + your split %)
- Monthly savings target

**Step 2: Income**
- Salary + payment day
- Bonuses (name, amount, month)
- Other income

**Step 3: Category Groups**
- Show default groups as checkboxes (all checked by default)
- User can uncheck groups they don't need
- User can rename groups
- User can add custom groups
- "Don't worry, you can change all of this later"

**Step 4: Categories**
- For each selected group, show suggested categories
- User can check/uncheck, rename, add new ones
- For shared categories: set split % (default or custom per category)
- For each category: optional monthly target amount

**Step 5: Review & Confirm**
- Summary of all groups, categories, income
- Edit links per section
- Confirm & Start

---

## Visual Design Spec

### Colors (dark mode)

```
Background (main):     #1a1a2e or #0f0f1a
Background (sidebar):  #16162a or #0a0a18
Background (card):     #242442 or #1e1e36
Background (row hover):#2a2a4a
Background (input):    #1e1e36
Border:                #2e2e4e
Text primary:          #e2e2e8
Text secondary:        #8888a0
Text muted:            #555570
Accent (purple/blue):  #6366f1 or #5b5fc7
Green (funded):        #22c55e
Yellow (underfunded):  #eab308
Orange (warning):      #f97316
Red (overspent):       #ef4444
Gray (zero):           #6b7280
```

### Typography

- Font: Inter or system-ui
- Category row: 14px, regular weight
- Group header: 14px, semibold
- Numbers: tabular-nums (monospace digits for alignment)
- Right-align all number columns

### Spacing

- Row height: 36-40px (compact, like YNAB)
- Group header height: 44px
- Sidebar width: 200px
- Right sidebar width: 260px
- Cell padding: 8px horizontal, 4px vertical

### Components to build

1. **CollapsibleGroup** - group header with expand/collapse, subtotals
2. **CategoryRow** - single row with Assigned, Activity, Available cells
3. **InlineEditor** - click a cell to edit in place (especially Assigned column)
4. **AmountCell** - color-coded amount display with EUR formatting
5. **MonthSelector** - left/right arrows with month name
6. **ReadyToAssign** - top banner showing unassigned money
7. **MonthlySummary** - right sidebar component
8. **TransactionTable** - sortable, filterable table
9. **TransactionForm** - add/edit transaction modal
10. **CategoryPicker** - grouped dropdown for selecting category
11. **ProgressBar** - for targets (e.g., "EUR 177.50 more needed by the 10th")
12. **StatusBadge** - "Fully Spent", "Funded", "Overspent", "Underfunded"

---

## API Endpoints (Revised)

### Budget
- `GET /api/budget/:month` - returns all groups, categories, assigned, activity, available for a month
- `POST /api/budget/assign` - assign money to a category for a month
- `POST /api/budget/move` - move money between categories

### Categories
- `GET /api/categories` - all categories grouped
- `POST /api/categories` - create category
- `PUT /api/categories/:id` - update category
- `DELETE /api/categories/:id` - delete (or hide) category
- `PATCH /api/categories/:id/sort` - reorder

### Category Groups
- `GET /api/groups` - all groups
- `POST /api/groups` - create group
- `PUT /api/groups/:id` - update group
- `DELETE /api/groups/:id` - delete group
- `PATCH /api/groups/:id/sort` - reorder

### Transactions
- `GET /api/transactions?month=2026-03&category_id=5` - filtered list
- `POST /api/transactions` - create
- `PUT /api/transactions/:id` - update
- `DELETE /api/transactions/:id` - delete

### Income (unchanged)
- `GET /api/income`
- `POST /api/income`
- `PUT /api/income/:id`
- `DELETE /api/income/:id`

### Stress Test (updated)
- `POST /api/stress-test` - now accepts category_id
- `GET /api/stress-test` - history

### Dashboard/Summary
- `GET /api/summary/:month` - month summary for right sidebar
- `GET /api/forecast` - 3/6/9/12 month income forecast

### Settings (unchanged)
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/onboarding`
- `POST /api/onboarding/demo`
- `POST /api/onboarding/skip`
- `POST /api/onboarding/reset`

---

## Build Order (Revised)

This is a full rebuild of the frontend and significant backend changes.

### Phase 1: Foundation
1. New database schema (categories, category_groups, monthly_budgets, transactions, category_targets)
2. Migration from old schema (preserve settings and income tables)
3. Backend API endpoints for categories, groups, transactions, budget
4. Onboarding flow (revised with category group/category selection)

### Phase 2: Budget Page (core)
5. Layout shell (three-column with sidebars)
6. Month selector + Ready to Assign banner
7. Collapsible category groups with subtotals
8. Category rows with Assigned / Activity / Available columns
9. Inline editing for Assigned column
10. Color-coded Available amounts
11. Move money between categories
12. Right sidebar: Monthly Summary

### Phase 3: Transactions
13. Transaction table (sortable, filterable)
14. Add/edit transaction form
15. Category picker (grouped dropdown)
16. Payee autocomplete

### Phase 4: Tools
17. Stress test (updated for category-based model)
18. Postpone view (updated for envelope model)
19. Calendar view
20. Prompt generator (updated with budget data)

### Phase 5: Polish
21. Settings page (with category group management)
22. Mobile responsive layout
23. Status badges and progress indicators for targets
24. Data validation and error handling
25. Performance optimization

---

## Migration Strategy

The current app has:
- income table (keep)
- expenses table (migrate to categories + monthly_budgets)
- transactions table (keep, add category_id)
- stress_tests table (keep, update category reference)
- settings table (keep)

Migration script should:
1. Create new tables (category_groups, categories, monthly_budgets, category_targets)
2. Map old expense categories to new category groups
3. Convert old expenses into categories with targets
4. Keep old transactions but add category_id references
5. Preserve all settings

Or simpler: since this is a local dev app with test data, offer a clean reset option and start fresh with the new schema.

---

## What This App Is Now

A personal budgeting and decision-support tool that combines:

1. **YNAB-style envelope budgeting** - every euro assigned a job, categories track what's budgeted vs spent vs available
2. **Decision operator tools** - stress test purchases against real category balances, identify what to postpone, generate AI prompts with real data
3. **Financial visibility** - monthly summaries, income forecasting, expense calendar, historical tracking

It is NOT:
- A bank sync tool (manual entry only, v1)
- A replacement for YNAB (it's a personal version with operator tools YNAB doesn't have)
- An AI chatbot (prompt generator creates copy-paste prompts for Claude.ai)

---

## Success Criteria

1. Budget page looks and feels as polished as YNAB's budget view
2. You can assign income to categories, record transactions, and see real-time available balances
3. Stress test works against actual category balances, not flat numbers
4. The app is usable daily for tracking spending and making decisions
5. Information density is high - no wasted space, no giant cards, compact rows
