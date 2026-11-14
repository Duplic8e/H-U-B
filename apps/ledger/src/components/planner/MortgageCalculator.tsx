import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { scheduleTotalInterest, type ExtraPayment } from '../../utils/finance/amortization'
import { CalculatorField } from './CalculatorField'
import { ResultCard } from './ResultCard'
import { ThemedSelect } from '../ui/ThemedSelect'
import { formatMoney } from './format'
import { MortgageChart } from './MortgageChart'
import { MortgageCalculatorMobile } from './MortgageCalculatorMobile'
import { HEATING_MONTHLY, useMortgageCalculator } from './useMortgageCalculator'

export const MortgageCalculator: React.FC = () => {
  const isPhone = !useMediaQuery('(min-width: 768px)')
  const m = useMortgageCalculator()
  if (isPhone) return <MortgageCalculatorMobile m={m} />

  const {
    inputs, set, setInput, mode, frequency, extras, setExtras, downPayment, payment, schedule, scheduleWithExtras,
    interestSaved, monthsSaved, biweeklyMonths, biweeklyInterestSaved, housingBudget, affordablePrincipal, affordablePrice,
  } = m

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(['payment', 'affordability'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setInput('mode', k)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                mode === k ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {k === 'payment' ? 'Payment' : 'Affordability'}
            </button>
          ))}
        </div>
        {mode === 'payment' && (
          <div className="flex gap-2">
            {(['monthly', 'biweekly'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setInput('frequency', f)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                  frequency === f ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {f === 'monthly' ? 'Monthly' : 'Biweekly (Accelerated)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'payment' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CalculatorField label="Home Price" prefix="$" step={5000} value={inputs.price} onChange={set('price')} />
            <CalculatorField label="Down Payment" suffix="%" min={0} max={100} step={1} value={inputs.downPct} onChange={set('downPct')} />
            <CalculatorField label="Rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
            <CalculatorField label="Amortization (Years)" min={1} max={35} value={inputs.years} onChange={set('years')} />
          </div>
          {frequency === 'biweekly' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResultCard label="Biweekly Payment" value={formatMoney(payment / 2)} highlight />
              <ResultCard label="New Payoff Time" value={`${Math.floor(biweeklyMonths / 12)}y ${biweeklyMonths % 12}m`} />
              <ResultCard label="Interest Saved vs Monthly" value={formatMoney(biweeklyInterestSaved)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResultCard label="Monthly Payment" value={formatMoney(payment)} highlight />
              <ResultCard label="Total Interest" value={formatMoney(scheduleTotalInterest(schedule))} />
              <ResultCard label="Down Payment" value={formatMoney(downPayment)} />
            </div>
          )}

          {frequency === 'monthly' && (
            <>
              <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] uppercase tracking-wide text-text-secondary">Extra Payments</p>
                  <button type="button" onClick={() => setExtras([...extras, { id: crypto.randomUUID(), kind: 'recurring', amount: 200, fromYear: 1, toYear: inputs.years }])}
                    className="flex items-center gap-1 text-[13px] text-text-secondary hover:text-accent">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                {extras.length === 0 && <p className="text-[13px] text-text-secondary">None yet. Add recurring monthly extras for a range of years, or one-time lump sums.</p>}
                {extras.map((e) => (
                  <div key={e.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3 items-end">
                    <div>
                      <label className="text-[13px] font-medium text-text-secondary block mb-1">Type</label>
                      <ThemedSelect value={e.kind} options={[{ value: 'recurring', label: 'Monthly Extra' }, { value: 'oneTime', label: 'One-Time Lump Sum' }]}
                        onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, kind: v as ExtraPayment['kind'] } : x))} />
                    </div>
                    <CalculatorField label={e.kind === 'recurring' ? 'Amount / Month' : 'Amount'} prefix="$" step={100} value={e.amount}
                      onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, amount: v } : x))} />
                    <CalculatorField label={e.kind === 'recurring' ? 'From Year' : 'In Year'} min={1} max={inputs.years} value={e.fromYear}
                      onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, fromYear: v } : x))} />
                    {e.kind === 'recurring' ? (
                      <CalculatorField label="To Year" min={e.fromYear} max={inputs.years} value={e.toYear}
                        onChange={(v) => setExtras(extras.map((x) => x.id === e.id ? { ...x, toYear: v } : x))} />
                    ) : <div />}
                    <button type="button" aria-label="Remove extra payment" onClick={() => setExtras(extras.filter((x) => x.id !== e.id))}
                      className="p-2 text-text-secondary hover:text-error self-end"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              {extras.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ResultCard label="Interest Saved" value={formatMoney(interestSaved)} highlight />
                  <ResultCard label="Paid Off Sooner By" value={`${Math.floor(monthsSaved / 12)}y ${monthsSaved % 12}m`} />
                  <ResultCard label="New Payoff Time" value={`${Math.floor(scheduleWithExtras.length / 12)}y ${scheduleWithExtras.length % 12}m`} />
                </div>
              )}
            </>
          )}

          <MortgageChart m={m} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CalculatorField label="Gross Annual Income" prefix="$" step={1000} value={inputs.income} onChange={set('income')} />
            <CalculatorField label="GDS Ratio" suffix="%" min={20} max={50} step={1} value={inputs.gdsPct} onChange={set('gdsPct')} />
            <CalculatorField label="Property Tax / Month" prefix="$" step={25} value={inputs.propertyTaxMonthly} onChange={set('propertyTaxMonthly')} />
            <CalculatorField label="Rate" suffix="%" step={0.05} value={inputs.ratePct} onChange={set('ratePct')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResultCard label="Max Home Price" value={formatMoney(affordablePrice)} highlight />
            <ResultCard label="Max Mortgage" value={formatMoney(affordablePrincipal)} />
            <ResultCard label="Housing Budget / Month" value={formatMoney(Math.max(0, housingBudget))} />
          </div>
          <p className="text-[13px] text-text-secondary">
            GDS-style estimate: {inputs.gdsPct}% of gross income minus property tax and {formatMoney(HEATING_MONTHLY)} heating,
            with your current down payment of {formatMoney(downPayment)} added on top. Lenders also apply stress tests, treated here as a ceiling.
          </p>
        </>
      )}
    </div>
  )
}
