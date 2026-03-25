# Personal Assistant — Money Module v1

A local-first personal finance tracker and decision-support tool. Track income, expenses, and obligations, then get rule-based verdicts on whether a purchase is smart—all without API keys, cloud services, or external dependencies.

> _"Open the app and within 5 seconds you know: how much you have left this month, what's coming up, and whether a purchase is smart or stupid."_

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| Backend | Node.js 18+ · Express · TypeScript |
| Database | SQLite (Node.js built-in `node:sqlite`) |
| Dev Tools | tsx · concurrently · PostCSS · Autoprefixer |

## Features

### ✅ Implemented (v1)

- **Onboarding Wizard** — 5-step guided setup (currency, split %, savings target, income, expenses) with demo data and skip options
- **Monthly Dashboard** — At-a-glance overview: income, fixed expenses, already spent, remaining safe-to-spend, upcoming pressure, savings buffer, and a verdict bar (green / yellow / red)
- **Expense Management** — Full CRUD across 5 categories: fixed shared, fixed personal, variable shared, variable personal, irregular
- **Income Management** — Full CRUD for salary, bonuses, and one-off income with 3/6/9/12-month forecasting
- **Purchase Stress Test** — 7-rule decision engine that evaluates purchases and returns Buy / Wait / Reject with reasoning
- **Settings** — Reset all data and re-run the onboarding wizard
- **Responsive UI** — Desktop sidebar + mobile bottom tab bar, dark mode by default

### 📋 Planned

- **Postpone View** — Ranked list of upcoming expenses by postponability
- **Calendar View** — Monthly color-coded calendar of bills, subscriptions, and income
- **Claude.ai Prompt Generator** — Generate formatted prompts with real financial data to paste into Claude.ai for deeper advice

## Getting Started

### Prerequisites

- **Node.js 18+** (required for the built-in `node:sqlite` module)
- **npm**

### Installation

```bash
git clone https://github.com/dimitriosg/personal-assistant.git
cd personal-assistant
npm install
```

### Development

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:3001

On first launch, the app redirects to a setup wizard at `/setup` where you can configure your finances, load demo data, or skip to explore the UI.

### Build

```bash
# Build frontend (output: dist/)
npm run build

# Build backend (output: dist/server/)
npm run build:server
```

## Project Structure

```
├── index.html                 # HTML entry point (dark mode enabled)
├── package.json               # Dependencies & scripts
├── vite.config.ts             # Vite config (port 5173, API proxy → 3001)
├── tailwind.config.js         # Tailwind config (dark mode: class)
├── tsconfig.json              # Frontend TypeScript config
├── tsconfig.server.json       # Backend TypeScript config
├── SPEC.md                    # Full product specification
│
├── src/                       # Frontend (React)
│   ├── main.tsx               # React entry point
│   ├── index.css              # Tailwind directives & global styles
│   ├── App.tsx                # Router & onboarding redirect
│   ├── lib/
│   │   └── api.ts             # Fetch wrapper (GET/POST/PUT/PATCH)
│   ├── components/
│   │   └── Layout.tsx         # Sidebar (desktop) + bottom tabs (mobile)
│   └── pages/
│       ├── Dashboard/         # Monthly overview & verdict bar
│       ├── Expenses/          # Expense CRUD (list, form, types)
│       ├── Income/            # Income CRUD & forecast
│       ├── StressTest/        # Purchase decision engine & history
│       ├── Settings/          # Data reset
│       └── setup/             # 5-step onboarding wizard
│
└── server/                    # Backend (Express)
    ├── index.ts               # Server startup & route registration
    ├── db.ts                  # SQLite init, schema & migrations
    └── routes/
        ├── settings.ts        # GET/PUT/PATCH settings
        ├── onboarding.ts      # Wizard, demo data, skip, reset
        ├── dashboard.ts       # Monthly calculations & verdict
        ├── expenses.ts        # CRUD expenses
        ├── income.ts          # CRUD income & forecast
        └── stressTest.ts      # Rule engine & history
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings/:key` | Update a setting |
| `PATCH` | `/api/settings` | Bulk upsert settings |
| `POST` | `/api/onboarding` | Submit wizard data |
| `POST` | `/api/onboarding/demo` | Load demo data |
| `POST` | `/api/onboarding/skip` | Skip onboarding |
| `POST` | `/api/onboarding/reset` | Wipe all data & restart |
| `GET` | `/api/dashboard` | Monthly overview & verdict |
| `GET` | `/api/expenses` | List all expenses |
| `POST` | `/api/expenses` | Create expense |
| `PUT` | `/api/expenses/:id` | Update expense |
| `PATCH` | `/api/expenses/:id/status` | Toggle active/paused |
| `DELETE` | `/api/expenses/:id` | Delete expense |
| `GET` | `/api/income` | List income, forecast & next bonus |
| `POST` | `/api/income` | Create income entry |
| `PUT` | `/api/income/:id` | Update income entry |
| `DELETE` | `/api/income/:id` | Delete income entry |
| `POST` | `/api/stress-test` | Run purchase decision engine |
| `GET` | `/api/stress-test` | Get stress test history |
| `DELETE` | `/api/stress-test/:id` | Delete a stress test result |

## Purchase Stress Test Rules

The decision engine evaluates purchases with these rules (applied in order):

| # | Condition | Verdict |
|---|-----------|---------|
| 1 | Remaining < price | **Reject** — can't afford it |
| 2 | Remaining − price < savings target | **Wait** — kills your buffer |
| 3 | Low urgency + impulse category | **Reject** — bad call |
| 4 | Low urgency + irregular expense within 30 days | **Wait** — bad timing |
| 5 | Bonus expected next month + not a need | **Wait** — wait for the bonus |
| 6 | Need + high urgency | **Approve** — do it |
| 7 | Default | Calculate opportunity cost → cautious or comfortable verdict |

## Database

SQLite with WAL mode and foreign keys enabled. Data is stored locally in `data/` (excluded from version control via `.gitignore`).

**Tables:** `income`, `expenses`, `transactions`, `stress_tests`, `settings`

> **Backup:** Since `data/` is not tracked by git, back up the SQLite files manually if you want to preserve your financial data.

See [SPEC.md](SPEC.md) for the full schema definition.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend & backend with hot reload |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express server with tsx watch |
| `npm run build` | Build frontend for production |
| `npm run build:server` | Compile backend TypeScript |
| `npm run preview` | Preview production frontend build |

## License

This project is for personal use.
