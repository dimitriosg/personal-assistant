import { MONTHS, getSplitDecimal, type WizardData } from './types'

interface Props {
  data: WizardData
  onEdit: (step: number) => void
  submitError: string | null
}

function Section({
  title, step, onEdit, children,
}: {
  title: string
  step: number
  onEdit: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  )
}

export default function StepReview({ data, onEdit, submitError }: Props) {
  const { basics, income, fixedExpenses, irregularExpenses } = data
  const splitPct = (getSplitDecimal(basics) * 100).toFixed(0)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Review your setup</h2>
        <p className="text-sm text-gray-500">Everything looks good? Confirm to open your dashboard.</p>
      </div>

      {/* Basics */}
      <Section title="Basics" step={1} onEdit={onEdit}>
        <Row label="Currency" value={basics.currency} />
        <Row
          label="Shared expenses"
          value={basics.shareExpenses ? `Yes — your share: ${splitPct}%` : 'No'}
        />
        <Row label="Monthly savings target" value={`€${basics.savingsTarget.toFixed(2)}`} />
      </Section>

      {/* Income */}
      <Section title="Income" step={2} onEdit={onEdit}>
        <Row
          label="Salary"
          value={`€${income.salary.amount.toFixed(2)}/mo${income.salary.paymentDay ? ` · day ${income.salary.paymentDay}` : ''}`}
        />
        {income.bonuses.map(b => (
          <Row key={b.id} label={b.name} value={`€${b.amount.toFixed(2)} · ${MONTHS[b.expectedMonth - 1]}`} />
        ))}
        {income.otherIncome.map(o => (
          <Row
            key={o.id}
            label={o.name}
            value={`€${o.amount.toFixed(2)} · ${o.isRecurring ? 'monthly' : MONTHS[(o.expectedMonth ?? 1) - 1]}`}
          />
        ))}
        {income.bonuses.length === 0 && income.otherIncome.length === 0 && (
          <p className="text-xs text-gray-600">No bonuses or other income added.</p>
        )}
      </Section>

      {/* Fixed expenses */}
      <Section title="Fixed expenses" step={3} onEdit={onEdit}>
        {fixedExpenses.length === 0 ? (
          <p className="text-xs text-gray-600">None added. You can add them from the Expenses page.</p>
        ) : (
          fixedExpenses.map(e => (
            <Row
              key={e.id}
              label={`${e.name} (${e.isShared ? 'shared' : 'personal'})`}
              value={`€${e.amount.toFixed(2)} · ${e.recurrence}`}
            />
          ))
        )}
      </Section>

      {/* Irregular expenses */}
      <Section title="Irregular / upcoming" step={4} onEdit={onEdit}>
        {irregularExpenses.length === 0 ? (
          <p className="text-xs text-gray-600">None added.</p>
        ) : (
          irregularExpenses.map(e => (
            <Row
              key={e.id}
              label={`${e.name} (${e.isShared ? 'shared' : 'personal'})`}
              value={`€${e.amount.toFixed(2)} · ${MONTHS[e.expectedMonth - 1]}`}
            />
          ))
        )}
      </Section>

      {submitError && (
        <div className="bg-red-950/50 border border-red-900 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">{submitError}</p>
          <p className="text-xs text-red-600 mt-1">Check the server is running and try again.</p>
        </div>
      )}
    </div>
  )
}
