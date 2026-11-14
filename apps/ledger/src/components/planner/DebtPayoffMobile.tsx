import React, { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ChartFigure } from '../ui/ChartFigure'
import { ChartLegend } from '../ui/ChartLegend'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { minPaymentFor, type Debt, type DebtType } from '../../utils/finance/debtPayoff'
import { formatMoney, formatMoneyCompact } from './format'
import { formatMonths, type DebtPayoffState } from './useDebtPayoff'
import { PHONE_CHART_MARGIN, PHONE_Y_AXIS } from './phoneChart'

const TYPE_LABEL: Record<DebtType, string> = { creditCard: 'Credit Card', lineOfCredit: 'Line of Credit', loan: 'Loan' }
const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface FieldProps { id: string; label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }
const Field: React.FC<FieldProps> = (f) => (
  <div className="flex flex-col gap-1 min-w-0">
    <label htmlFor={f.id} className={lab}>{f.label}</label>
    <div className={box}>
      {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
      <NumberInput id={f.id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium" value={f.value} min={f.min ?? 0} max={f.max} onCommit={f.onChange} />
      {f.suffix && <span className="text-[14px] text-text-secondary shrink-0">{f.suffix}</span>}
    </div>
  </div>
)

const Seg: React.FC<{ name: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> = ({ name, value, options, onChange }) => (
  <div role="group" aria-label={name} className="flex bg-bg-secondary border border-border rounded-xl p-1">
    {options.map((o) => (
      <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium px-1 ${value === o.value ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o.label}</button>
    ))}
  </div>
)

const DebtEditor: React.FC<{ d: Debt; update: (patch: Partial<Debt>) => void; changeType: (t: DebtType) => void }> = ({ d, update, changeType }) => {
  const autoMin = minPaymentFor(d, d.balance)
  const loan = d.type === 'loan'
  const byTerm = loan && (d.loanMode ?? 'payment') === 'term'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`debt-name-${d.id}`} className={lab}>Name</label>
        <input id={`debt-name-${d.id}`} className={`${box} text-[16px] text-text-primary outline-none w-full`} value={d.name} onChange={(e) => update({ name: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1"><span className={lab}>Type</span>
        <ThemedSelect ariaLabel={`Type of ${d.name}`} value={d.type} className="!min-h-12 !rounded-xl" onChange={(v) => changeType(v as DebtType)}
          options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`debt-bal-${d.id}`} label="Balance" prefix="$" value={d.balance} onChange={(v) => update({ balance: v })} />
        <Field id={`debt-apr-${d.id}`} label="APR" suffix="%" value={d.aprPct} onChange={(v) => update({ aprPct: v })} />
      </div>
      {loan ? (
        <>
          <div className="flex flex-col gap-1"><span className={lab}>Payment Input</span>
            <ThemedSelect ariaLabel={`Payment input for ${d.name}`} value={d.loanMode ?? 'payment'} className="!min-h-12 !rounded-xl" onChange={(v) => update({ loanMode: v as Debt['loanMode'] })}
              options={[{ value: 'payment', label: 'I Know My Payment' }, { value: 'term', label: 'I Know My Term' }]} /></div>
          {byTerm ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id={`debt-term-${d.id}`} label="Term" suffix="yrs" value={d.termYears ?? 5} min={1} max={40} onChange={(v) => update({ termYears: v })} />
              <div className="flex flex-col gap-1"><span className={lab}>Computed Payment</span>
                <div className={`${box} text-[16px] font-medium`}>{formatMoney(autoMin)}<span className="text-[12px] text-text-secondary">/mo</span></div></div>
            </div>
          ) : (
            <Field id={`debt-pay-${d.id}`} label="Monthly Payment" prefix="$" value={d.minPayment ?? 0} onChange={(v) => update({ minPayment: v })} />
          )}
        </>
      ) : (
        <p className="text-[13px] text-text-secondary">Min payment (auto): {formatMoney(autoMin)}/mo</p>
      )}
    </div>
  )
}

/** Phone layout of Debt Payoff: the answer first, the strategy, then debts ranked in payoff order. */
export const DebtPayoffMobile: React.FC<{ s: DebtPayoffState }> = ({ s }) => {
  const { debts, strategy, otherStrategy, chosen, other, chartData } = s
  const [open, setOpen] = useState<string | null>(null)
  const delta = other.totalInterest - chosen.totalInterest
  const rank = [...debts].sort((a, b) => {
    const ia = chosen.payoffOrder.indexOf(a.id), ib = chosen.payoffOrder.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const sub = (d: Debt) => `${TYPE_LABEL[d.type]} · ${d.aprPct}% APR · min ${formatMoney(minPaymentFor(d, d.balance))}`

  return (
    <div data-testid="debt-payoff-mobile" className="flex flex-col gap-4">
      <Seg name="Strategy" value={strategy} onChange={s.setStrategy}
        options={[{ value: 'avalanche', label: 'Avalanche (Highest)' }, { value: 'snowball', label: 'Snowball (Smallest)' }]} />
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
        <p className="text-[13px] text-text-secondary">Debt-free in</p>
        <p className="text-[30px] font-semibold text-accent leading-tight">{formatMonths(chosen.months)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-bg-secondary grid grid-cols-2 divide-x divide-border">
        <div className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">Total Interest</p><p className="text-[16px] font-semibold tabular-nums">{formatMoney(chosen.totalInterest)}</p></div>
        <div className="p-3 min-w-0 text-center"><p className="text-[12px] text-text-secondary">vs {cap(otherStrategy)}</p>
          <p className="text-[16px] font-semibold tabular-nums">{delta >= 0 ? `Saves ${formatMoney(delta)}` : `Costs ${formatMoney(-delta)} More`}</p></div>
      </div>

      <Field id="debt-extra" label="Extra Monthly Payment" prefix="$" value={s.extraMonthly} onChange={s.setExtra} />

      <div className="rounded-2xl border border-border bg-bg-secondary">
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1"><p className="text-[14px] font-medium">Payoff Order</p>
            <p className="text-[12px] text-text-secondary">{strategy === 'avalanche' ? 'Highest APR First' : 'Smallest Balance First'}</p></div>
          <button type="button" onClick={() => setOpen(s.addDebt())} className="min-h-11 px-3 rounded-xl border border-border text-[13px] text-accent flex items-center gap-1">
            <Plus className="w-4 h-4" aria-hidden="true" />Add Debt</button>
        </div>
        {rank.map((d, i) => (
          <div key={d.id} className="border-t border-border">
            <button onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id} className="w-full min-h-14 px-3 py-2 flex items-center gap-3 text-left">
              <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-semibold ${i === 0 ? 'bg-accent text-bg-primary' : 'border border-border text-text-secondary'}`}>{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium truncate">{d.name || 'Debt'}{i === 0 && <span className="ml-2 text-[12px] font-normal text-accent">Pay First</span>}</span>
                <span className="block text-[12px] text-text-secondary truncate">{sub(d)}</span>
              </span>
              <span className="text-[15px] font-semibold tabular-nums">{formatMoney(d.balance)}</span>
              <ChevronDown size={16} aria-hidden="true" className={`text-text-secondary transition-transform ${open === d.id ? 'rotate-180' : ''}`} />
            </button>
            {open === d.id && (
              <div className="px-3 pb-3 flex flex-col gap-3">
                <DebtEditor d={d} update={(p) => s.updateDebt(d.id, p)} changeType={(t) => s.changeType(d, t)} />
                <button onClick={() => s.removeDebt(d.id)} aria-label={`Remove ${d.name}`}
                  className="min-h-11 rounded-xl border border-border text-[14px] text-error flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" aria-hidden="true" />Remove {d.name}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="themed-card rounded-lg p-3 h-[280px] flex flex-col">
      <ChartFigure label={`Remaining debt balance by month comparing avalanche and snowball strategies, debt-free in ${formatMonths(chosen.months)} on the chosen (${strategy}) strategy`}
        className="w-full flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={PHONE_CHART_MARGIN} accessibilityLayer={false}>
            <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
            <XAxis dataKey="month" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--text-secondary)" {...PHONE_Y_AXIS} tickFormatter={(v: number) => formatMoneyCompact(v)} />
            <Tooltip formatter={(value, name) => [formatMoney(Number(value)), String(name)]} {...chartTooltipStyles} />
            <Line type="monotone" dataKey="avalanche" stroke="var(--accent)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="snowball" stroke="var(--text-secondary)" dot={false} strokeWidth={2} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFigure>
      {other.series.length > 0 && <ChartLegend centered items={[{ name: 'Avalanche', color: 'var(--accent)' }, { name: 'Snowball', color: 'var(--text-secondary)' }]} />}
      </div>
    </div>
  )
}
