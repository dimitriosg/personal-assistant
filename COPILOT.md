# Personal Assistant - Money Module

## Project Context

This is a local-only personal budgeting app modeled after YNAB's envelope budgeting approach, with added decision-support tools (purchase stress test, postpone advisor, AI prompt generator).

## Stack

- Frontend: React 18 + TypeScript + Tailwind CSS
- Backend: Node.js + Express
- Database: SQLite via node:sqlite (Node 22+ built-in, no native deps)
- Build: Vite
- Runtime: Node 22+

## Architecture

- `src/` - React frontend (Vite)
- `server/` - Express backend
  - `server/db.ts` - SQLite connection + schema + migrations
  - `server/routes/` - API route files
- `vite.config.ts` - proxies /api to Express on port 3001
- Single `npm run dev` starts both frontend and backend

## Key Design Rules

1. Dark mode only. Background: #1a1a2e family. See REDESIGN.md for full color palette.
2. YNAB-style layout: left sidebar (nav), main content (budget grid), right sidebar (month summary).
3. Compact rows (36-40px height). No oversized cards. Information density matters.
4. All money amounts: EUR, 2 decimal places, tabular-nums for alignment, right-aligned.
5. Color coding: green = funded, yellow = underfunded, red = overspent, gray = zero.
6. Category groups are collapsible with subtotals across Assigned / Activity / Available columns.
7. No external API calls. No AI integration. Prompt generator creates copy-paste text only.

## Database

SQLite with tables: settings, income, category_groups, categories, monthly_budgets, category_targets, transactions, stress_tests.

Shared expenses use a global split % (from settings) with per-category override (custom_split column).

## Core Concepts

- **Ready to Assign**: income not yet budgeted to any category
- **Assigned**: how much the user budgeted for a category this month
- **Activity**: sum of transactions in a category this month (negative = spending)
- **Available**: assigned + activity + rollover from previous months

## Commands

- `npm run dev` - start both frontend (5173) and backend (3001)
- `npm run build` - production build

## Spec

Read REDESIGN.md for the complete specification including pages, data model, API endpoints, visual design, and build order.
