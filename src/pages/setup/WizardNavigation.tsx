interface Props {
  step: number
  totalSteps: number
  canProceed: boolean
  isSubmitting?: boolean
  onBack: () => void
  onNext: () => void
  onSkip?: () => void
}

export default function WizardNavigation({
  step,
  totalSteps,
  canProceed,
  isSubmitting = false,
  onBack,
  onNext,
  onSkip,
}: Props) {
  const isFirst = step === 1
  const isLast = step === totalSteps

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
      <div>
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
          >
            ← Back
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onSkip && !isLast && (
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isSubmitting}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600
            text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : isLast ? 'Confirm & Start' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
