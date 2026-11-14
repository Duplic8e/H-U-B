import React, { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { ExtraPayment } from '../../utils/finance/amortization'
import { InfoButton } from '../ui/InfoButton'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { formatMoney } from './format'
import { MortgageChart } from './MortgageChart'
import { HEATING_MONTHLY, type MortgageState } from './useMortgageCalculator'

const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'

interface FieldSpec { label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }

const Field: React.FC<{ f: FieldSpec }> = ({ f }) => {
  const id = `mortgage-${f.label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className={lab}>{f.label}</label>
      <div className={box}>
        {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
        <NumberInput id={id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium"
          value={f.value} min={f.min ?? 0} max={f.max} onCommit={f.onChange} />
        {f.suffix && <span className="text-[14px] text-text-secondary shrink-0">{f.suffix}</span>}
      </div>
    </div>
  )
}

const Seg: React.FC<{ name: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> = ({ name, value, options, onChange }) => (
  <div role="group" aria-label={name} className="flex bg-bg-secondary border border-border rounded-xl p-1">
    {options.map((o) => (
      <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${value === o.value ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o.label}</button>
    ))}
  </div>
)

/** Phone layout of the mortgage tool: the answer first, its two supporting figures, then the inputs. */
export const MortgageCalculatorMobile: React.FC<{ m: MortgageState }> = ({ m }) => {
  const { inputs, set, mode, frequency, extras, setExtras } = m
  const [noteOpen, setNoteOpen] = useState(false)

  const affordability = mode === 'affordability'
  const hero = affordability
    ? { label: 'Max Home Price', value: formatMoney(m.affordablePrice) }
    : { label: frequency === 'biweekly' ? 'Biweekly Payment' : 'Monthly Payment', value: formatMoney(frequency === 'biweekly' ? m.payment / 2 : m.payment) }
  const stats = affordability
    ? [{ label: 'Max Mortgage', value: formatMoney(m.affordablePrincipal) }, { label: 'Housing Budget / Month', value: formatMoney(Math.max(0, m.housingBudget)) }]
    : frequency === 'biweekly'
      ? [{ label: 'New Payoff Time', value: `${Math.floor(m.biweeklyMonths / 12)}y ${m.biweeklyMonths % 12}m` }, { label: 'Interest Saved vs Monthly', value: formatMoney(m.biweeklyInterestSaved) }]
      : [{ label: 'Total Interest', value: formatMoney(m.totalInterest) }, { label: 'Down Payment', value: formatMoney(m.downPayment) }]
  const fields: FieldSpec[] = affordability
    ? [
        { label: 'Gross Annual Income', prefix: '$', value: inputs.income, onChange: set('income') },
        { label: 'GDS Ratio', suffix: '%', value: inputs.gdsPct, onChange: set('gdsPct'), min: 20, max: 50 },
        { label: 'Property Tax / Month', prefix: '$', value: inputs.propertyTaxMonthly, onChange: set('propertyTaxMonthly') },
        { label: 'Rate', suffix: '%', value: inputs.ratePct, onChange: set('ratePct') },
      ]
    : [
        { label: 'Home Price', prefix: '$', value: inputs.price, onChange: set('price') },
        { label: 'Down Payment', suffix: '%', value: inputs.downPct, onChange: set('downPct'), min: 0, max: 100 },
        { label: 'Rate', suffix: '%', value: inputs.ratePct, onChange: set('ratePct') },
        { label: 'Amortization', suffix: 'yrs', value: inputs.years, onChange: set('years'), min: 1, max: 35 },
      ]

  const upExtra = (id: string, patch: Partial<ExtraPayment>) => setExtras(extras.map((x) => x.id === id ? { ...x, ...patch } : x))
  const showExtras = mode === 'payment' && frequency === 'monthly'

  return (
    <div data-testid="mortgage-mobile" className="flex flex-col gap-4">
      <Seg name="Mode" value={mode} onChange={(v) => m.setInput('mode', v)} options={[{ value: 'payment', label: 'Payment' }, { value: 'affordability', label: 'Affordability' }]} />

      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
        <p className="text-[13px] text-text-secondary">{hero.label}</p>
        <p className="text-[30px] font-semibold text-accent leading-tight">{hero.value}</p>
      </div>
      <div className="rounded-2xl border border-border bg-bg-secondary grid grid-cols-2 divide-x divide-border">
        {stats.map((x) => (
          <div key={x.label} className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">{x.label}</p><p className="text-[16px] font-semibold tabular-nums">{x.value}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">{fields.map((f) => <Field key={f.label} f={f} />)}</div>

      {mode === 'payment' && (
        <Seg name="Frequency" value={frequency} onChange={(v) => m.setInput('frequency', v)} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'biweekly', label: 'Biweekly Accelerated' }]} />
      )}

      {affordability && (
        <div className="rounded-xl border border-border bg-bg-secondary">
          <button onClick={() => setNoteOpen(!noteOpen)} aria-expanded={noteOpen} className="w-full min-h-12 px-3 flex items-center gap-2 text-left">
            <span className="flex-1 text-[14px] font-medium">Estimation Details</span>
            <ChevronDown size={16} aria-hidden="true" className={`text-text-secondary transition-transform ${noteOpen ? 'rotate-180' : ''}`} />
          </button>
          {noteOpen && (
            <p className="px-3 pb-3 text-[13px] text-text-secondary">
              GDS estimate: {inputs.gdsPct}% of income, minus property tax and {formatMoney(HEATING_MONTHLY)} heating, plus your {formatMoney(m.downPayment)} down payment. Lenders&rsquo; stress tests cap what you can borrow.
            </p>
          )}
        </div>
      )}

      {mode === 'payment' && <MortgageChart m={m} />}

      {showExtras && (
        <div className="rounded-2xl border border-border bg-bg-secondary p-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium">Extra Payments{extras.length > 0 && <span className="text-text-secondary font-normal"> ({extras.length})</span>}</p>
            <span className="flex-1"><InfoButton label="About Extra Payments" inline><p>Add monthly extras for a range of years, or one-time lump sums, to see the interest saved.</p></InfoButton></span>
            <button type="button" onClick={() => setExtras([...extras, { id: crypto.randomUUID(), kind: 'recurring', amount: 200, fromYear: 1, toYear: inputs.years }])}
              className="min-h-11 px-3 rounded-xl border border-border text-[13px] text-accent flex items-center gap-1"><Plus className="w-4 h-4" aria-hidden="true" />Add</button>
          </div>
          {extras.map((e) => (
            <div key={e.id} className="rounded-xl border border-border p-3 flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0 flex flex-col gap-1"><span className={lab}>Type</span>
                  <ThemedSelect ariaLabel="Type" value={e.kind} className="!min-h-12 !rounded-xl"
                    options={[{ value: 'recurring', label: 'Monthly Extra' }, { value: 'oneTime', label: 'One-Time Lump Sum' }]}
                    onChange={(v) => upExtra(e.id, { kind: v as ExtraPayment['kind'] })} /></div>
                <button type="button" aria-label="Remove extra payment" onClick={() => setExtras(extras.filter((x) => x.id !== e.id))}
                  className="h-12 w-12 shrink-0 flex items-center justify-center text-text-secondary"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className={`grid gap-2 ${e.kind === 'recurring' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <Field f={{ label: e.kind === 'recurring' ? 'Per Month' : 'Amount', prefix: '$', value: e.amount, onChange: (v) => upExtra(e.id, { amount: v }) }} />
                <Field f={{ label: e.kind === 'recurring' ? 'From Year' : 'In Year', value: e.fromYear, onChange: (v) => upExtra(e.id, { fromYear: v }), min: 1, max: inputs.years }} />
                {e.kind === 'recurring' && <Field f={{ label: 'To Year', value: e.toYear, onChange: (v) => upExtra(e.id, { toYear: v }), min: e.fromYear, max: inputs.years }} />}
              </div>
            </div>
          ))}
        </div>
      )}
      {showExtras && extras.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-secondary grid grid-cols-3 divide-x divide-border">
          {[['Interest Saved', formatMoney(m.interestSaved)], ['Time Saved', `${Math.floor(m.monthsSaved / 12)}y ${m.monthsSaved % 12}m`], ['New Payoff', `${Math.floor(m.scheduleWithExtras.length / 12)}y ${m.scheduleWithExtras.length % 12}m`]].map(([l, v]) => (
            <div key={l} className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">{l}</p><p className="text-[15px] font-semibold tabular-nums break-words">{v}</p></div>
          ))}
        </div>
      )}
    </div>
  )
}
