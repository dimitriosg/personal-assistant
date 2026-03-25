import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post } from '../../lib/api'
import {
  DEFAULT_WIZARD_DATA,
  buildPayload,
  canProceed,
  getSplitDecimal,
  type WizardData,
  type BasicsData,
  type IncomeData,
  type FixedExpenseEntry,
  type IrregularExpenseEntry,
} from './types'
import ProgressBar from './ProgressBar'
import WizardNavigation from './WizardNavigation'
import StepBasics from './StepBasics'
import StepIncome from './StepIncome'
import StepFixedExpenses from './StepFixedExpenses'
import StepIrregularExpenses from './StepIrregularExpenses'
import StepReview from './StepReview'

const TOTAL_STEPS = 5

// ── Launch choice screen ───────────────────────────────────────────────────────

function ChoiceScreen({ onChoice }: {
  onChoice: (choice: 'wizard' | 'demo' | 'skip') => void
}) {
  const [loading, setLoading] = useState<'demo' | 'skip' | null>(null)

  async function handle(choice: 'demo' | 'skip') {
    setLoading(choice)
    try {
      await post(`/onboarding/${choice}`, {})
      onChoice(choice)
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-1">How would you like to start?</h2>
        <p className="text-sm text-gray-500">You can always add or change data later in the management pages.</p>
      </div>

      <div className="space-y-3">
        {/* Start fresh */}
        <button
          type="button"
          onClick={() => onChoice('wizard')}
          className="w-full text-left p-4 rounded-xl border border-indigo-700 bg-indigo-950/40 hover:bg-indigo-950/70 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">⚙️</span>
            <div>
              <p className="text-sm font-semibold text-indigo-300 group-hover:text-indigo-200">Start fresh</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Walk through a 5-step wizard to enter your salary, bonuses, and expenses.
                Takes about 2 minutes.
              </p>
            </div>
          </div>
        </button>

        {/* Demo data */}
        <button
          type="button"
          onClick={() => handle('demo')}
          disabled={loading !== null}
          className="w-full text-left p-4 rounded-xl border border-gray-700 bg-gray-900 hover:bg-gray-800 transition-colors group disabled:opacity-60"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">🗂</span>
            <div>
              <p className="text-sm font-semibold text-gray-200 group-hover:text-gray-100">
                {loading === 'demo' ? 'Loading demo…' : 'Use demo data'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Populate with a realistic salary, bonuses, and expenses so you can explore
                the app right away. Replace with your real data any time.
              </p>
            </div>
          </div>
        </button>

        {/* Set up later */}
        <button
          type="button"
          onClick={() => handle('skip')}
          disabled={loading !== null}
          className="w-full text-left p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900 transition-colors group disabled:opacity-60"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">⏩</span>
            <div>
              <p className="text-sm font-semibold text-gray-400 group-hover:text-gray-300">
                {loading === 'skip' ? 'Skipping…' : "I'll set it up later"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Start with an empty database. Add your income and expenses manually
                through the management pages.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

// ── Main setup shell ───────────────────────────────────────────────────────────

export default function Setup() {
  const navigate = useNavigate()

  // 'choice' = launch screen; 1–5 = wizard steps
  const [mode, setMode] = useState<'choice' | number>('choice')
  const [data, setData] = useState<WizardData>(DEFAULT_WIZARD_DATA)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Choice screen handler ───────────────────────────────────────────────────

  function handleChoice(choice: 'wizard' | 'demo' | 'skip') {
    if (choice === 'wizard') {
      setMode(1)
    } else {
      // demo/skip already called their API and succeeded
      navigate('/', { replace: true })
    }
  }

  // ── Wizard updaters ─────────────────────────────────────────────────────────

  const setBasics    = (basics: BasicsData)                       => setData(d => ({ ...d, basics }))
  const setIncome    = (income: IncomeData)                       => setData(d => ({ ...d, income }))
  const setFixed     = (fixedExpenses: FixedExpenseEntry[])       => setData(d => ({ ...d, fixedExpenses }))
  const setIrregular = (irregularExpenses: IrregularExpenseEntry[]) => setData(d => ({ ...d, irregularExpenses }))

  // ── Wizard navigation ───────────────────────────────────────────────────────

  const step = typeof mode === 'number' ? mode : 1

  const goNext = () => {
    if (step < TOTAL_STEPS) setMode(step + 1)
    else handleConfirm()
  }
  const goBack = () => {
    if (step === 1) setMode('choice')
    else setMode(step - 1)
  }
  const goEdit       = (targetStep: number) => setMode(targetStep)
  const skipIrregular = () => { setIrregular([]); setMode(5) }

  // ── Wizard submit ───────────────────────────────────────────────────────────

  async function handleConfirm() {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await post('/onboarding', buildPayload(data))
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unexpected error')
      setIsSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Personal Assistant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Money module · First-time setup</p>
        </div>

        {mode === 'choice' ? (
          <ChoiceScreen onChoice={handleChoice} />
        ) : (
          <>
            <ProgressBar currentStep={step} />

            <div className="min-h-[400px]">
              {step === 1 && <StepBasics    data={data.basics}            onChange={setBasics} />}
              {step === 2 && <StepIncome    data={data.income}            onChange={setIncome} />}
              {step === 3 && <StepFixedExpenses data={data.fixedExpenses} globalSplitPercent={Math.round(getSplitDecimal(data.basics) * 100)} onChange={setFixed} />}
              {step === 4 && <StepIrregularExpenses data={data.irregularExpenses} globalSplitPercent={Math.round(getSplitDecimal(data.basics) * 100)} onChange={setIrregular} />}
              {step === 5 && <StepReview    data={data} onEdit={goEdit}   submitError={submitError} />}
            </div>

            <WizardNavigation
              step={step}
              totalSteps={TOTAL_STEPS}
              canProceed={canProceed(step, data)}
              isSubmitting={isSubmitting}
              onBack={goBack}
              onNext={goNext}
              onSkip={step === 4 ? skipIrregular : undefined}
            />
          </>
        )}
      </div>
    </div>
  )
}
