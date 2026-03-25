import express from 'express'
import cors from 'cors'
import './db' // initialise DB and run migrations on startup
import settingsRouter from './routes/settings'
import onboardingRouter from './routes/onboarding'
import dashboardRouter from './routes/dashboard'
import expensesRouter from './routes/expenses'
import incomeRouter from './routes/income'
import stressTestRouter from './routes/stressTest'
import groupsRouter from './routes/groups'
import categoriesRouter from './routes/categories'
import budgetRouter from './routes/budget'
import transactionsNewRouter from './routes/transactionsNew'
import summaryRouter from './routes/summary'
import postponeRouter from './routes/postpone'
import calendarRouter from './routes/calendar'
import promptRouter from './routes/prompt'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/settings', settingsRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/income', incomeRouter)
app.use('/api/stress-test', stressTestRouter)
app.use('/api/groups', groupsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/budget', budgetRouter)
app.use('/api/transactions', transactionsNewRouter)
app.use('/api/summary', summaryRouter)
app.use('/api/postpone', postponeRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/prompt', promptRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
