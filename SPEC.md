# Personal Assistant - Money Module v1

## What This Is

A local web app that tracks your money, obligations, and upcoming expenses, then helps you make purchase and timing decisions using rule-based logic. When you need deeper AI-powered advice, it generates a ready-to-paste prompt with your real data for Claude.ai.

No API key. No external services. Runs on your machine at localhost.

## Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3, zero setup)
- **Build:** Vite
- **Runtime:** Node 18+

Everything in one project. `npm run dev` starts both frontend and backend.

## Core Features

### 1. Income Tracker

What it stores:
- Base monthly salary (user-entered during onboarding)
- Payment date/timing
- Extra incomes with expected month (e.g., bonuses, seasonal pay)
- Any one-off or temporary income

What it shows:
- This month's expected income
- Next 3, 6, 9, and 12 months income forecast
- Flag when a bonus month is coming

### 2. Expense Tracker

Categories:
- **Fixed shared** (split % set during onboarding, e.g., 50/50, 60/40): rent, utilities, groceries, etc.
- **Fixed personal**: loan, car installment, subscriptions
- **Variable shared**: food out, delivery, coffee
- **Variable personal**: impulse buys, one-offs
- **Irregular/upcoming**: car insurance, annual renewals, service costs, one-time obligations

What it stores per expense:
- Name
- Amount (EUR)
- Category (fixed shared / fixed personal / variable shared / variable personal / irregular)
- Recurrence (monthly / annual / one-time / specific month)
- Shared? (yes/no, auto-applies the configured split % if shared)
- Due date or expected month
- Status (paid / upcoming / overdue)

What it shows:
- This month's total obligations
- Your share after the configured split (whatever % was set)
- Breakdown by category
- Upcoming irregular expenses in next 30 / 60 / 90 / 120 / 150 / 180 days

### 3. Monthly Dashboard

The main screen. Shows at a glance:

- **Income this month** (salary + any extras)
- **Fixed expenses** (your share)
- **Already spent** (variable, tracked)
- **Remaining safe to spend**
- **Upcoming pressure** (irregular expenses in next 30-180 days, grouped by period)
- **Savings status** (target vs actual buffer)
- **Verdict bar**: green (comfortable) / yellow (tight) / red (danger)

### 4. Purchase Stress Test

A form you fill out:

- Item name
- Price (EUR)
- Category: need / useful / comfort / impulse
- Urgency: high / medium / low

The app runs rule-based logic:

```
Rules:
1. If remaining safe-to-spend < price: REJECT ("You can't afford this without cutting something")
2. If remaining safe-to-spend - price < savings target (set during onboarding): WARN ("This kills your buffer")
3. If urgency = low AND category = impulse: REJECT ("Bad call. Wait.")
4. If urgency = low AND irregular expenses coming within 30 days: WARN ("Bad timing, [expense] is coming")
5. If bonus month is next month AND category != need: SUGGEST WAIT ("Wait for [bonus] next month")
6. If category = need AND urgency = high: APPROVE ("Do it")
7. Default: calculate opportunity cost and show what this delays
```

Output format:
```
Verdict: Buy / Wait / Reject
Why: [auto-generated reason from rules]
Risk: [what it impacts]
Next move: [concrete suggestion]
```

### 5. "What Should I Postpone?" View

Scans all upcoming non-fixed expenses and ranks them:

- Must pay (fixed obligations, overdue items)
- Should pay (maintenance, useful but flexible timing)
- Can postpone (comfort, cosmetic, impulse, low urgency)
- Should postpone (bad timing given current pressure)

### 6. Claude.ai Prompt Generator

A button that generates a formatted prompt based on your actual data:

```
Personal/Money: Monthly review

Month: [auto-filled]
Income: EUR [actual] (salary [x] + [extras if any])
Fixed expenses (my share): EUR [calculated]
Already spent this month: EUR [sum of variable]
Remaining: EUR [calculated]
Upcoming irregular (next 60 days): [list with amounts]
Savings buffer: EUR [current]
Current concern: [user types this]

Please assess my financial position and tell me:
1. What is safe to spend
2. What should I postpone
3. What is the main risk this month
4. Best next move
```

This copies to clipboard. You paste it into Claude.ai and get the AI layer for free.

Also generates purchase stress-test prompts with real numbers pre-filled.

### 7. Recurring Expense Calendar

A simple month view showing:
- When bills hit
- When subscriptions renew
- When irregular expenses are expected
- When bonuses arrive

Color-coded: red (obligation), yellow (expected), green (income).

## Data Model (SQLite)

### income
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT | e.g., "Salary", "Easter bonus" |
| amount | REAL | EUR |
| type | TEXT | salary / bonus / one-off |
| expected_month | INTEGER | 1-12, NULL for monthly |
| is_recurring | BOOLEAN | |
| notes | TEXT | |

### expenses
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT | |
| amount | REAL | EUR |
| category | TEXT | fixed_shared / fixed_personal / variable_shared / variable_personal / irregular |
| is_shared | BOOLEAN | if true, configured split % applies |
| recurrence | TEXT | monthly / annual / one_time / specific_month |
| due_day | INTEGER | day of month, NULL if flexible |
| due_month | INTEGER | for annual/specific, NULL for monthly |
| status | TEXT | active / paid / upcoming / paused |
| notes | TEXT | |

### transactions
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| expense_id | INTEGER FK | links to expense, NULL for ad-hoc |
| amount | REAL | actual amount paid |
| date | TEXT | ISO date |
| notes | TEXT | |

### stress_tests
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| item | TEXT | what you wanted to buy |
| price | REAL | |
| category | TEXT | need / useful / comfort / impulse |
| urgency | TEXT | high / medium / low |
| verdict | TEXT | buy / wait / reject |
| reason | TEXT | auto-generated |
| date | TEXT | ISO date |

### settings
| Field | Type | Notes |
|-------|------|-------|
| key | TEXT PK | e.g., "shared_split_user", "savings_target", "currency" |
| value | TEXT | stored as text, parsed by app |

Default settings created during onboarding:
- `shared_split_user`: user's share of shared expenses as decimal (e.g., 0.50 for 50%)
- `savings_target`: minimum monthly buffer in EUR (e.g., 50 or 100)
- `currency`: EUR (default, for future flexibility)
- `onboarding_complete`: false until first-launch flow is done

## Pages / Routes

1. **/setup** - First-launch onboarding (redirects here if onboarding_complete = false)
2. **/** - Dashboard (monthly overview + verdict bar)
3. **/expenses** - Manage expenses (add, edit, toggle active/paused)
4. **/income** - Manage income sources
5. **/stress-test** - Purchase stress test form + history
6. **/postpone** - "What should I postpone?" ranked view
7. **/calendar** - Monthly expense/income calendar
8. **/prompt** - Claude.ai prompt generator
9. **/settings** - Edit onboarding values later (split %, savings target, etc.)

## UI Notes

- Clean, minimal. Dark mode default.
- No unnecessary animations.
- Mobile-responsive (you'll check it on your phone via localhost sometimes).
- Numbers always show EUR, 2 decimal places.
- Dashboard should load in under 1 second.
- All data entry through simple forms. No drag-and-drop complexity.

## First-Launch Onboarding Flow

On first launch (onboarding_complete = false), the app redirects to /setup and walks the user through a step-by-step setup wizard. All values can be changed later in /settings or the respective management pages.

### Step 1: Basics
- Currency (default EUR, for future flexibility)
- Do you share expenses with someone? (yes/no)
- If yes: what is your share? (slider or input, e.g., 50%, 60%, custom)
- Monthly savings target (EUR amount, e.g., 50 or 100)

### Step 2: Income
- Base monthly salary (amount + payment timing)
- Do you receive bonuses? (yes/no)
- If yes: add each bonus (name, expected amount, expected month). Allow adding multiple.
- Any other recurring or expected income? (optional, add multiple)

### Step 3: Fixed Expenses
- Walk through adding fixed expenses one by one
- For each: name, amount, shared or personal, recurrence, due day/month
- Prompt for common categories: rent/mortgage, utilities, loans, installments, subscriptions
- Allow "add another" until done

### Step 4: Known Irregular Expenses
- Any big or irregular expenses you already know about?
- For each: name, estimated amount, expected month, shared or personal
- Examples shown as hints: car insurance, annual subscriptions, license fees, service costs

### Step 5: Review and Confirm
- Show a summary of everything entered
- Allow edits before confirming
- On confirm: set onboarding_complete = true, redirect to dashboard

Design notes:
- Clean, one-step-per-screen flow (not a giant form)
- Progress indicator showing which step you're on
- Skip buttons on optional steps (bonuses, irregular expenses)
- All data editable later through the normal management pages and /settings

## What This Is Not

- Not a full accounting app
- Not a replacement for YNAB (it complements it)
- Not an AI chatbot
- Not connected to any bank or payment service

It is a decision-support dashboard for your money. The same operator logic from v2.1, but backed by real data instead of memory.

## Build Order

1. Project scaffolding (Vite + React + Express + SQLite)
2. Database schema + settings table
3. First-launch onboarding flow (/setup)
4. Dashboard page (read-only, shows current state)
5. Expense management (CRUD)
6. Income management (CRUD)
7. Purchase stress test (form + rule engine + history)
8. Postpone view
9. Calendar view
10. Claude.ai prompt generator
11. Settings page (edit onboarding values)
12. Polish and mobile responsiveness

## Success Criteria

You open the app and within 5 seconds you know:
- How much you have left this month
- What's coming up
- Whether a purchase is smart or stupid

That's it. If it does that, v1 works.