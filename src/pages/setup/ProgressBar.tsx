const STEP_LABELS = ['Basics', 'Income', 'Groups', 'Categories', 'Review']

interface Props {
  currentStep: number   // 1-based
}

export default function ProgressBar({ currentStep }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1
          const isDone = step < currentStep
          const isActive = step === currentStep

          return (
            <div key={step} className="flex-1 flex flex-col items-center relative">
              {/* Connector line left */}
              {i > 0 && (
                <div
                  className={`absolute top-3.5 right-1/2 left-0 h-0.5 -translate-y-1/2
                    ${isDone || isActive ? 'bg-indigo-600' : 'bg-gray-700'}`}
                />
              )}
              {/* Circle */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${isDone ? 'bg-indigo-600 text-white' :
                    isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20' :
                    'bg-gray-700 text-gray-400'}`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step}
              </div>
              {/* Label */}
              <span className={`mt-1.5 text-xs text-center leading-tight hidden sm:block
                ${isActive ? 'text-indigo-400 font-medium' :
                  isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
