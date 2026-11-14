import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { minPaymentFor, type Debt, type DebtType } from '../../utils/finance/debtPayoff'
import { DebtPayoffMobile } from './DebtPayoffMobile'
import { formatMonths, useDebtPayoff } from './useDebtPayoff'
import { CalculatorField } from './CalculatorField'
import { SelectField } from './SelectField'
import { ResultCard } from './ResultCard'
import { formatMoney } from './format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'

const MinPaymentDisplay: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div>
    <span className="text-[13px] font-medium text-text-secondary block mb-1">{label}</span>
    <div className="px-3 py-2 rounded-lg bg-bg-primary/30 border border-border text-[15px] text-text-primary">
      {formatMoney(value)}<span className="text-[12px] text-text-secondary"> /mo</span>
    </div>
  </div>
)

export const DebtPayoffCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const state = useDebtPayoff()
  if (isPhone) return <DebtPayoffMobile s={state} />
  const {
    debts, strategy, extraMonthly, saveDebts, updateDebt, changeType, setExtra, setStrategy, chosen, other, chartData,
  } = state

  return (
    <div className="flex flex-col gap-6">
      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-wide text-text-secondary">Debts</p>
          <button
            onClick={() => saveDebts([...debts, { id: crypto.randomUUID(), name: 'New Debt', balance: 1000, aprPct: 10, type: 'creditCard' }])}
            className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Debt
          </button>
        </div>
        {debts.map((d) => {
          const autoMin = minPaymentFor(d, d.balance)
          // Second-row fields: 1 for card/LOC (min payment), 2 for loan+payment
          // (mode select + payment), 3 for loan+term (select + years + computed).
          const detailCols =
            d.type !== 'loan'
              ? 'md:grid-cols-[minmax(0,340px)]'
              : (d.loanMode ?? 'payment') === 'payment'
                ? 'md:grid-cols-[1.4fr_1fr]'
                : 'md:grid-cols-[1.4fr_1fr_1fr]'
          const handleRemove = () => saveDebts(debts.filter((x) => x.id !== d.id))
          return (
            <div key={d.id} className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0">
              <div data-testid="debt-card-header" className="flex items-center justify-between md:hidden">
                <span className="text-[14px] font-medium text-text-primary">{d.name || 'Debt'}</span>
                <button
                  onClick={handleRemove}
                  className="p-2 rounded-lg text-text-secondary hover:text-error transition-colors"
                  aria-label={`Remove ${d.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1fr_1fr_auto] gap-3 items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-medium text-text-secondary">Name</span>
                  <input
                    className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px] outline-none focus:border-accent"
                    value={d.name}
                    onChange={(e) => updateDebt(d.id, { name: e.target.value })}
                  />
                </label>
                <SelectField
                  label="Type"
                  value={d.type}
                  onChange={(v) => changeType(d, v as DebtType)}
                  options={[
                    { value: 'creditCard', label: 'Credit Card' },
                    { value: 'lineOfCredit', label: 'Line of Credit' },
                    { value: 'loan', label: 'Loan' },
                  ]}
                />
                <CalculatorField label="Balance" prefix="$" step={100} value={d.balance} onChange={(v) => updateDebt(d.id, { balance: v })} />
                <CalculatorField label="APR" suffix="%" step={0.1} value={d.aprPct} onChange={(v) => updateDebt(d.id, { aprPct: v })} />
                <button
                  onClick={handleRemove}
                  className="hidden md:flex self-end p-2 mb-2 rounded-lg text-text-secondary hover:text-error transition-colors"
                  aria-label={`Remove ${d.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className={`grid grid-cols-1 ${detailCols} gap-3 items-end`}>
                {d.type === 'loan' ? (
                  <>
                    <SelectField
                      label="Payment Input"
                      value={d.loanMode ?? 'payment'}
                      onChange={(v) => updateDebt(d.id, { loanMode: v as Debt['loanMode'] })}
                      options={[
                        { value: 'payment', label: 'I Know My Payment' },
                        { value: 'term', label: 'I Know My Term' },
                      ]}
                    />
                    {(d.loanMode ?? 'payment') === 'payment' ? (
                      <CalculatorField label="Monthly Payment" prefix="$" step={10} value={d.minPayment ?? 0} onChange={(v) => updateDebt(d.id, { minPayment: v })} />
                    ) : (
                      <>
                        <CalculatorField label="Amortization (Years)" min={1} max={40} value={d.termYears ?? 5} onChange={(v) => updateDebt(d.id, { termYears: v })} />
                        <MinPaymentDisplay label="Computed Payment" value={autoMin} />
                      </>
                    )}
                  </>
                ) : (
                  <MinPaymentDisplay label="Min Payment (Auto)" value={autoMin} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <CalculatorField label="Extra Monthly Payment" prefix="$" step={25} value={extraMonthly} onChange={setExtra} />
        <SelectField
          label="Strategy"
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: 'avalanche', label: 'Avalanche (Highest APR First)' },
            { value: 'snowball', label: 'Snowball (Smallest Balance First)' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard label={`Debt-free in (${strategy})`} value={formatMonths(chosen.months)} highlight />
        <ResultCard label="Total Interest" value={formatMoney(chosen.totalInterest)} />
        <ResultCard
          label="vs Other Strategy"
          value={other.totalInterest >= chosen.totalInterest
            ? `Saves ${formatMoney(other.totalInterest - chosen.totalInterest)}`
            : `Costs ${formatMoney(chosen.totalInterest - other.totalInterest)} More`}
        />
      </div>

      <ChartFigure
        label={`Remaining debt balance by month comparing avalanche and snowball strategies, debt-free in ${formatMonths(chosen.months)} on the chosen (${strategy}) strategy`}
        className="themed-card rounded-lg p-4 h-[320px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} accessibilityLayer={false}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={72} />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
              {...chartTooltipStyles}
            />
            <Line type="monotone" dataKey="avalanche" stroke="var(--accent)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="snowball" stroke="var(--text-secondary)" dot={false} strokeWidth={2} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      {other.series.length > 0 && (
        <ChartLegend items={[
          { name: 'Avalanche', color: 'var(--accent)' },
          { name: 'Snowball', color: 'var(--text-secondary)' },
        ]} />
      )}
    </div>
  )
}
