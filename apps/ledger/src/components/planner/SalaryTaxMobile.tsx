import React, { useState } from 'react'
import { NumberInput } from '../ui/NumberInput'
import { ThemedSelect } from '../ui/ThemedSelect'
import { TaxYearNotice } from '../ui/TaxYearNotice'
import { InfoButton } from '../ui/InfoButton'
import { TAX_YEAR, FEDERAL_BRACKETS, PROVINCES, PROVINCIAL_TAX, marginalSlices, type Bracket } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'
import { SALARY_TAX_TOOL_ID, type SalaryTaxState } from './useSalaryTax'

const lab = 'text-[13px] font-medium text-text-secondary'
const box = 'flex items-center gap-2 bg-bg-primary/50 border border-border rounded-xl px-3 min-h-12 focus-within:border-accent'
const NET_COLOR = 'color-mix(in srgb, var(--text-secondary) 30%, transparent)'

const Field: React.FC<{ id: string; label: string; info?: React.ReactNode; prefix?: string; value: number; onChange: (v: number) => void }> = (f) => (
  <div className="flex flex-col gap-1 min-w-0">
    <div className="flex items-center"><label htmlFor={f.id} className={lab}>{f.label}</label>{f.info}</div>
    <div className={box}>
      {f.prefix && <span className="text-[14px] text-text-secondary shrink-0">{f.prefix}</span>}
      <NumberInput id={f.id} className="w-full min-w-0 bg-transparent text-text-primary text-[16px] font-medium" value={f.value} min={0} onCommit={f.onChange} />
    </div>
  </div>
)

/** A collapsible card. `info` is an info button that shows beside the title only while the card is open. */
const Fold: React.FC<{ title: string; summary?: string; open?: boolean; info?: React.ReactNode; children: React.ReactNode }> = ({ title, summary, open, info, children }) => (
  <details className="group themed-card rounded-2xl" open={open}>
    <summary className="list-none cursor-pointer min-h-12 px-4 flex items-center justify-between gap-3">
      <span className="flex items-center">
        <span className="text-[15px] font-semibold">{title}</span>
        {info && <span className="hidden group-open:inline-flex" onClick={(e) => e.preventDefault()}>{info}</span>}
      </span>
      {summary && <span className="text-[13px] text-text-secondary">{summary}</span>}
    </summary>
    <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>
  </details>
)

const Seg: React.FC<{ label: string; options: string[]; value: string; onChange: (v: string) => void }> = ({ label, options, value, onChange }) => (
  <div role="group" aria-label={label} className="flex bg-bg-secondary border border-border rounded-xl p-1">
    {options.map((o) => (
      <button key={o} aria-pressed={value === o} onClick={() => onChange(o)}
        className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${value === o ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{o}</button>
    ))}
  </div>
)

const About: React.FC = () => (
  <InfoButton label="About These Numbers">
    <p>{TAX_YEAR} tax year. {TAX_YEAR} rates for a full-year employee, as an annual estimate rather than payroll advice.</p>
    <p>Includes the standard employee credits: basic personal, Canada employment, and eligible CPP/QPP, EI and QPIP contribution credits.</p>
    <p>Net pay still includes any RRSP or FHSA contribution you entered.</p>
  </InfoButton>
)

/** Marks a slice whose rate is higher than the slices around it, which is where a premium or
 *  credit phases in (for example the Ontario Health Premium near $200,000). */
const WhyHigher: React.FC = () => (
  <InfoButton label="Why This Rate Is Higher" inline>
    <p>A premium or credit phases in or out on this slice of income, such as the Ontario Health Premium near $200,000.</p>
    <p>Each dollar deducted here saves more than your bracket rate.</p>
  </InfoButton>
)

const BracketsInfo: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <InfoButton label="How To Read These Rates">
    <p>The filled part of each bar is the income inside that bracket.</p>
    <p>Marginal percentages also reflect pension deductions and tax credits, so they can differ from the bracket rates.</p>
    {children}
  </InfoButton>
)

const rowsOf = (t: SalaryTaxState['t']) => [
  { label: 'Federal Tax', value: t.federal, color: 'var(--chart-1)' },
  { label: 'Provincial Tax', value: t.provincial, color: 'var(--chart-2)' },
  { label: `${t.plan} (incl. ${t.plan}2)`, value: t.pension, color: 'var(--chart-3)' },
  { label: 'EI', value: t.ei, color: 'var(--chart-4)' },
  ...(t.plan === 'QPP' ? [{ label: 'QPIP', value: t.qpip, color: 'var(--chart-5)' }] : []),
]

const StackBar: React.FC<{ s: SalaryTaxState; tall?: boolean }> = ({ s, tall }) => {
  const g = s.t.gross > 0 ? s.t.gross : 1
  return (
    <div className={`flex ${tall ? 'h-9' : 'h-6'} rounded-md overflow-hidden bg-bg-primary/50`} role="img" aria-label={`Where ${formatMoney(s.t.gross)} goes`}>
      {rowsOf(s.t).map((r) => <div key={r.label} style={{ width: `${(r.value / g) * 100}%`, background: r.color }} />)}
      <div style={{ width: `${(s.t.net / g) * 100}%`, background: NET_COLOR }} />
    </div>
  )
}

const DeductionRows: React.FC<{ s: SalaryTaxState; div?: number }> = ({ s, div = 1 }) => {
  const rows = rowsOf(s.t)
  const g = s.t.gross > 0 ? s.t.gross : 1
  const total = rows.reduce((a, r) => a + r.value, 0)
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 min-h-11 border-b border-border/60 last:border-0">
          <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: r.color }} aria-hidden="true" />
          <span className="flex-1 text-[14px] text-text-secondary">{r.label}</span>
          <span className="text-[12px] text-text-secondary w-9 text-right">{((r.value / g) * 100).toFixed(0)}%</span>
          <span className="text-[14px] tabular-nums w-24 text-right">{formatMoney(r.value / div)}</span>
        </div>
      ))}
      <div className="flex items-center gap-3 min-h-11 border-t border-border">
        <span className="w-2.5 shrink-0" />
        <span className="flex-1 text-[14px] font-semibold">Total Deductions</span>
        <span className="text-[12px] text-text-secondary w-9 text-right">{((total / g) * 100).toFixed(0)}%</span>
        <span className="text-[14px] font-semibold tabular-nums w-24 text-right">{formatMoney(total / div)}</span>
      </div>
    </div>
  )
}

const StatStrip: React.FC<{ items: Array<[string, string]> }> = ({ items }) => (
  <div className={`grid ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-border rounded-2xl border border-border bg-bg-secondary py-3`}>
    {items.map(([k, v]) => (
      <div key={k} className="px-3 text-center">
        <p className="text-[12px] text-text-secondary">{k}</p>
        <p className="text-[17px] font-semibold tabular-nums">{v}</p>
      </div>
    ))}
  </div>
)

const Hero: React.FC<{ label: string; value: string; sub?: string; right?: React.ReactNode }> = ({ label, value, sub, right }) => (
  <div className="rounded-2xl border border-accent/50 bg-accent/10 p-4" role="status" aria-live="polite">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[13px] text-text-secondary">{label}</p>
        <p className="text-[30px] font-semibold text-accent leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-[13px] text-text-secondary mt-1">{sub}</p>}
      </div>
      {right && <div className="-mt-2 -mr-2">{right}</div>}
    </div>
  </div>
)

/** One row per bracket: rate, range with a fill bar, and how much of your income sits in it.
 *  The highest bracket you reach is tinted. */
const Ladder: React.FC<{ title?: string; brackets: Bracket[]; income: number }> = ({ title, brackets, income }) => {
  const rows = brackets.map((b, i) => ({ rate: b.rate, start: i === 0 ? 0 : brackets[i - 1].upTo, end: b.upTo }))
  const topIdx = rows.reduce((acc, r, i) => (income > r.start ? i : acc), 0)
  return (
    <div className="flex flex-col gap-1.5">
      {title && <p className="text-[12px] uppercase tracking-wide text-text-secondary">{title}</p>}
      {rows.map((r, i) => {
        const open = !Number.isFinite(r.end)
        const filled = Math.min(Math.max(income - r.start, 0), open ? Math.max(income - r.start, 0) : r.end - r.start)
        const pct = open ? (income > r.start ? 100 : 0) : (filled / (r.end - r.start)) * 100
        const hot = i === topIdx && income > 0
        return (
          <div key={r.start} className={`rounded-xl border px-3 py-2 flex flex-col gap-1.5 ${hot ? 'border-accent/50 bg-accent/10' : 'border-border bg-bg-primary/30'}`}>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className={`font-semibold w-14 ${hot ? 'text-accent' : ''}`}>{(r.rate * 100).toFixed(1)}%</span>
              <span className="flex-1 text-text-secondary text-[12px]">{formatMoney(r.start)}{open ? '+' : ` to ${formatMoney(r.end)}`}</span>
              <span className="tabular-nums text-[13px]">{filled > 0 ? formatMoney(filled) : 'None'}</span>
            </div>
            <div className="h-1.5 rounded bg-bg-primary/60 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

/** What one more deductible RRSP dollar is worth, the slices of income by saving rate, and the room used. */
const RrspCompact: React.FC<{ s: SalaryTaxState }> = ({ s }) => {
  const slices = marginalSlices(s.income, s.province, s.deductibleRrsp, s.inputs.fhsa)
  const top = slices[0]
  const shown = slices.slice(0, 3)
  if (!top || top.rate <= 0) return <p className="text-[13px] text-text-secondary">You pay no income tax at this income, so an RRSP deduction saves nothing this year.</p>
  const used = s.room !== null && s.room > 0 ? Math.min((top.amount / s.room) * 100, 100) : null
  return (
    <div className="flex flex-col gap-3">
      <StatStrip items={[['Saved Per $1', `${top.rate.toFixed(1)}%`], [`${formatMoney(top.amount)} RRSP Saves`, formatMoney(top.taxSaved)]]} />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 text-[12px] text-text-secondary px-1"><span className="w-14">Rate</span><span className="flex-1">Income in Slice</span><span>Tax Saved</span></div>
        {shown.map((x, i) => {
          const above = shown[i - 1]
          const below = shown[i + 1]
          const higher = (above !== undefined || below !== undefined)
            && (above === undefined || x.rate > above.rate)
            && (below === undefined || x.rate > below.rate)
            && (above !== undefined && below !== undefined || x.amount <= 1000)
          return (
            <div key={x.from} className={`flex items-center gap-3 rounded-lg px-3 min-h-10 text-[13px] ${i === 0 ? 'bg-accent/10 border border-accent/50' : 'bg-bg-primary/40'}`}>
              <span className={`w-11 font-semibold ${i === 0 ? 'text-accent' : ''}`}>{x.rate.toFixed(1)}%</span>
              <span className="flex-1 flex items-center tabular-nums">{formatMoney(x.amount)}{higher && <WhyHigher />}</span>
              <span className="tabular-nums">{formatMoney(x.taxSaved)}</span>
            </div>
          )
        })}
      </div>
      {used !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 rounded bg-bg-primary/60 overflow-hidden" role="progressbar" aria-label="Remaining room used" aria-valuenow={Math.round(used)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent" style={{ width: `${used}%` }} /></div>
          <p className="text-[12px] text-text-secondary">{top.amount <= (s.room ?? 0) ? `Uses ${used.toFixed(0)}% of your ${formatMoney(s.room ?? 0)} remaining CRA room` : `Exceeds your ${formatMoney(s.room ?? 0)} remaining CRA room by ${formatMoney(top.amount - (s.room ?? 0))}`}</p>
        </div>
      ) : s.room === 0 ? <p className="text-[12px] text-text-secondary">No entered RRSP deduction room remains.</p> : null}
    </div>
  )
}


const PERIODS = [['Year', 1], ['Month', 12], ['Biweekly', 26]] as const

/** Phone layout of Salary and Tax: income and province summary, pay period selector, the net
 *  pay hero and where the gross goes, then the rates, Contributions, and folds for Tax Brackets
 *  and RRSP Efficiency. */
export const SalaryTaxMobile: React.FC<{ s: SalaryTaxState }> = ({ s }) => {
  const { inputs, set, setInput, t, province, income, incomeTax, marginal, effective, breakdown } = s
  const [period, setPeriod] = useState<string>('Year')
  const [level, setLevel] = useState('Federal')
  const div = PERIODS.find(([name]) => name === period)?.[1] ?? 1
  const keepPct = t.gross > 0 ? (t.net / t.gross) * 100 : 0
  const overLimit = s.enteredRoom !== null && inputs.rrsp > s.enteredRoom ? inputs.rrsp - s.enteredRoom : 0
  const topSlice = marginalSlices(income, province, s.deductibleRrsp, inputs.fhsa)[0]
  const hasProvincialLines = s.annualOntarioPremium > 0 || s.annualOntarioReduction > 0 || (s.annualReductionLabel !== null && t.provincialAdjustments < 0)

  return (
    <div data-testid="salary-tax-mobile" className="flex flex-col gap-4">
      <TaxYearNotice />
      <details className="themed-card rounded-2xl">
        <summary className="list-none cursor-pointer min-h-14 px-4 py-2 flex items-center justify-between gap-3">
          <span><span className="block text-[13px] text-text-secondary">Income & Province</span><span className="block text-[17px] font-semibold">{formatMoney(income)} · {PROVINCIAL_TAX[province].name}</span></span>
          <span className="text-[13px] text-accent">Edit</span>
        </summary>
        <div className="px-4 pb-4 flex flex-col gap-3">
          <Field id="st-income" label="Gross Annual Income" prefix="$" value={income} onChange={set('income')} />
          <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor="st-province" className={lab}>Province</label>
            <ThemedSelect id="st-province" value={province} options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
              onChange={(x) => setInput(SALARY_TAX_TOOL_ID, 'province', x)} className="!min-h-12 !rounded-xl" />
          </div>
        </div>
      </details>

      <Seg label="Pay period" options={PERIODS.map(([name]) => name)} value={period} onChange={setPeriod} />
      <Hero label={`Net Pay Per ${period === 'Biweekly' ? 'Pay Period' : period}`} value={formatMoney(t.net / div)} sub={`${keepPct.toFixed(0)}% of Gross Income`} right={<About />} />

      <div className="themed-card rounded-2xl p-4 flex flex-col gap-3">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">Where {formatMoney(t.gross / div)} Goes</p>
        <StackBar s={s} />
        <DeductionRows s={s} div={div} />
      </div>

      <StatStrip items={[['Total Tax', formatMoney(incomeTax)], ['Marginal', `${marginal.toFixed(1)}%`], ['Effective', `${effective.toFixed(1)}%`]]} />

      <Fold title="Contributions" summary={inputs.rrsp + inputs.fhsa > 0 ? `${formatMoney(inputs.rrsp + inputs.fhsa)} Contributed` : 'None'}>
        <div className="grid grid-cols-2 gap-3">
          <Field id="st-rrsp" label="RRSP Contribution" prefix="$" value={inputs.rrsp} onChange={set('rrsp')} />
          <Field id="st-fhsa" label="FHSA Contribution" prefix="$" value={inputs.fhsa} onChange={set('fhsa')} />
        </div>
        <Field id="st-room" label="CRA RRSP Deduction Limit" prefix="$" value={inputs.rrspRoom} onChange={set('rrspRoom')}
          info={<InfoButton label="About The CRA Limit" inline><p>Leave the limit at $0 if unknown. No room is estimated from your salary.</p></InfoButton>} />
        {overLimit > 0 && (
          <p role="status" className="text-[12px] text-text-secondary">
            Your RRSP contribution is over the CRA limit entered by {formatMoney(overLimit)}. The excess gets no deduction here.
          </p>
        )}
        <StatStrip items={[['Taxable Income', formatMoney(t.taxableIncome)], ['Tax Savings', formatMoney(t.taxSavings)]]} />
        <div className="rounded-lg bg-accent/10 px-3 py-2 flex items-center justify-between text-[13px]">
          <span className="text-text-secondary">Net After Contributions</span>
          <span className="font-semibold text-accent tabular-nums">{formatMoney(t.net - inputs.rrsp - inputs.fhsa)}</span>
        </div>
      </Fold>

      <Fold title="Tax Brackets" summary={`${marginal.toFixed(1)}% Marginal`}>
        <Seg label="Bracket level" options={['Federal', 'Provincial']} value={level} onChange={setLevel} />
        {level === 'Federal'
          ? <Ladder brackets={FEDERAL_BRACKETS} income={t.taxableIncome} />
          : <Ladder brackets={PROVINCIAL_TAX[province].brackets} income={t.provincialTaxableIncome} />}
        <div className="flex items-center">
          <span className="text-[12px] uppercase tracking-wide text-text-secondary">Marginal Rate Breakdown</span>
          <BracketsInfo>
            <p className="text-text-primary">
              Fed {breakdown.federal.toFixed(2)}% + Prov {breakdown.provincialBase.toFixed(2)}%
              {breakdown.surtax > 0 && ` + ON surtax ${breakdown.surtax.toFixed(2)}%`}
              {s.adjustmentPercent !== '0.00' && ` ${breakdown.adjustments < 0 ? '−' : '+'} Adj ${s.adjustmentPercent}%`}
              {' '}<strong>= {breakdown.total.toFixed(2)}%</strong>
            </p>
            {hasProvincialLines && (
              <p>
                <span className="mr-1">Included in Provincial Tax:</span>
                {s.annualOntarioPremium > 0 && <span>Ontario Health Premium <strong className="font-medium text-text-primary">{formatMoney(s.annualOntarioPremium)}</strong></span>}
                {s.annualOntarioReduction > 0 && <>{s.annualOntarioPremium > 0 ? '; ' : ''}<span>Ontario tax reduction <strong className="font-medium text-text-primary">{formatMoney(-s.annualOntarioReduction)}</strong></span></>}
                {s.annualReductionLabel && t.provincialAdjustments < 0 && <span>{s.annualReductionLabel} <strong className="font-medium text-text-primary">{formatMoney(t.provincialAdjustments)}</strong></span>}
              </p>
            )}
          </BracketsInfo>
        </div>
      </Fold>

      <Fold
        title="RRSP Efficiency"
        summary={`${formatMoney(topSlice?.amount ?? 0)} in Slice`}
        info={s.room === null && topSlice && topSlice.rate > 0
          ? <InfoButton label="About RRSP Room" inline><p>Enter your CRA RRSP deduction limit to compare with available room.</p></InfoButton>
          : undefined}
      >
        <RrspCompact s={s} />
      </Fold>
    </div>
  )
}
