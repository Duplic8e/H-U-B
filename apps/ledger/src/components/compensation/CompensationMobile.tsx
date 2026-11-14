import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import {
  useCompensationStore, calcTotalComp, calcAnnualBaseSalary, calcAnnualBonus, calcAnnualESPP, calcAnnualRRSP, calcAnnualRSU,
  generateVestEvents, getBaseSalaryForMonth,
} from '../../store/useCompensationStore'
import type { VestEvent } from '../../store/useCompensationStore'
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
import { useTakeHomeEstimate } from '../../hooks/useTakeHomeEstimate'
import { PROVINCIAL_TAX } from '../../utils/finance/canadaTax'
import { usePlannerStore } from '../../store/usePlannerStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TaxYearNotice } from '../ui/TaxYearNotice'
import { NumberInput } from '../ui/NumberInput'
import { ChartFigure } from '../ui/ChartFigure'
import { CompPriceCardMobile } from './CompPriceCardMobile'

const cad = (v: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v)

const COLORS = { base: 'var(--chart-1)', bonus: 'var(--chart-2)', rsu: 'var(--chart-5)', espp: 'var(--chart-3)', rrsp: 'var(--chart-4)' }

const useParts = () => {
  const { timeMode, setTimeMode, showAfterTax, toggleAfterTax, useCadConversion } = useCompensationStore()
  const { pkg } = useCompensationDisplay()
  const total = calcTotalComp(pkg, timeMode)
  const { takeHome, deductionPct, province } = useTakeHomeEstimate(total)
  const rows = [
    { name: 'Base Salary', value: calcAnnualBaseSalary(pkg, timeMode), color: COLORS.base },
    { name: 'Bonus', value: calcAnnualBonus(pkg, timeMode), color: COLORS.bonus },
    { name: 'Equity (RSU)', value: calcAnnualRSU(pkg, timeMode), color: COLORS.rsu },
    { name: 'ESPP Profit', value: calcAnnualESPP(pkg, timeMode), color: COLORS.espp },
    { name: 'RRSP', value: calcAnnualRRSP(pkg, timeMode), color: COLORS.rrsp },
  ].filter((r) => r.value > 0)
  const shown = showAfterTax ? takeHome.net : total
  return { pkg, timeMode, setTimeMode, showAfterTax, toggleAfterTax, total, takeHome, deductionPct, province, useCadConversion, rows, shown }
}

type Parts = ReturnType<typeof useParts>

const Seg: React.FC<{ items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; label: string }> = ({ items, value, onChange, label }) => (
  <div role="group" aria-label={label} className="flex bg-bg-secondary border border-border rounded-xl p-1">
    {items.map((i) => (
      <button key={i.id} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)}
        className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-medium ${value === i.id ? 'bg-bg-primary text-accent' : 'text-text-secondary'}`}>{i.label}</button>
    ))}
  </div>
)

const Donut: React.FC<{ p: Parts; size: number }> = ({ p, size }) => (
  <div style={{ width: size, height: size }} className="shrink-0" role="img" aria-label={`Total annual compensation split as ${p.rows.map((r) => `${r.name} ${cad(r.value)}`).join(', ')}`}>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart accessibilityLayer={false}>
        <Pie data={p.rows} dataKey="value" innerRadius="64%" outerRadius="92%" paddingAngle={3} stroke="none" isAnimationActive={false} rootTabIndex={-1}>
          {p.rows.map((r, i) => <Cell key={i} fill={r.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  </div>
)

const Legend: React.FC<{ p: Parts; bars?: boolean }> = ({ p, bars }) => (
  <ul className="flex flex-col">
    {p.rows.map((r) => {
      const pct = p.total > 0 ? Math.round((r.value / p.total) * 100) : 0
      return (
        <li key={r.name} className="flex flex-col justify-center min-h-12 border-b border-border last:border-b-0">
          <div className="flex items-center gap-2 text-[14px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden="true" />
            <span className="flex-1 text-text-secondary">{r.name}</span>
            <span className="font-medium text-text-primary tabular-nums">{cad(r.value)}</span>
            <span className="w-10 text-right text-text-secondary tabular-nums">{pct}%</span>
          </div>
          {bars && <div className="mt-1.5 h-1.5 rounded-full bg-bg-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} /></div>}
        </li>
      )
    })}
  </ul>
)

const Figure: React.FC<{ p: Parts; center?: boolean }> = ({ p, center }) => (
  <div className={center ? 'text-center' : ''}>
    <p className="text-[12px] text-text-secondary">{p.showAfterTax ? 'Est. After-Tax Compensation' : 'Total Annual Compensation'}</p>
    <p data-key-figure className="text-[32px] leading-tight font-semibold text-text-primary tabular-nums">{cad(p.shown)}</p>
  </div>
)

type MKey = 'baseSalary' | 'bonus' | 'espp' | 'rrsp' | 'rsu'

const MonthlyChart: React.FC<{ p: Parts }> = ({ p }) => {
  const now = new Date(); const y = now.getFullYear(); const m0 = now.getMonth()
  const bonus = calcAnnualBonus(p.pkg, p.timeMode)
  const esppV = calcAnnualESPP(p.pkg, p.timeMode)
  const rrspV = calcAnnualRRSP(p.pkg, p.timeMode)
  const data = Array.from({ length: 12 }).map((_, i) => {
    const dt = p.timeMode === 'current-year' ? new Date(y, i, 1) : new Date(y, m0 + i, 1)
    const mi = dt.getMonth(); const yr = dt.getFullYear()
    let rsu = 0
    p.pkg.rsuGrants.forEach((g) => generateVestEvents(g, p.pkg.companyCurrentPrice || 0).forEach((e: VestEvent) => {
      if (!e.date) return
      const ed = new Date(e.date)
      if (ed.getMonth() === mi && ed.getFullYear() === yr) rsu += e.vestValue
    }))
    return {
      month: dt.toLocaleString('default', { month: 'short' }),
      baseSalary: p.timeMode === 'current-year' ? getBaseSalaryForMonth(p.pkg, yr, mi) / 12 : p.pkg.baseSalary / 12,
      bonus: mi === ((p.pkg.cashBonusMonth || 12) - 1) ? bonus : 0, espp: esppV / 12, rrsp: rrspV / 12, rsu,
    }
  })
  const avg = (k: MKey) => data.reduce((s, d) => s + d[k], 0) / 12
  const keyOf: Record<string, MKey> = { 'Base Salary': 'baseSalary', 'Bonus': 'bonus', 'Equity (RSU)': 'rsu', 'ESPP Profit': 'espp', 'RRSP': 'rrsp' }
  return (
    <div className="flex flex-col gap-2">
      <ChartFigure label="Monthly compensation breakdown for 12 months" className="relative w-full h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} interval={0} />
            <YAxis tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} axisLine={false} tickLine={false} width={56} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
            <Tooltip formatter={(v, n) => [cad(Number(v) || 0), String(n)]} cursor={{ fill: 'var(--color-border)' }} />
            <Bar dataKey="baseSalary" stackId="a" fill={COLORS.base} name="Base Salary" />
            <Bar dataKey="bonus" stackId="a" fill={COLORS.bonus} name="Bonus" />
            <Bar dataKey="espp" stackId="a" fill={COLORS.espp} name="ESPP Profit" />
            <Bar dataKey="rrsp" stackId="a" fill={COLORS.rrsp} name="RRSP" />
            <Bar dataKey="rsu" stackId="a" fill={COLORS.rsu} name="RSU" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
      <p className="text-[12px] text-text-secondary">Average per month</p>
      <ul className="flex flex-col">
        {p.rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 min-h-11 text-[14px] border-b border-border last:border-b-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} aria-hidden="true" />
            <span className="flex-1 text-text-secondary">{r.name}</span>
            <span className="font-medium text-text-primary tabular-nums">{cad(avg(keyOf[r.name]))}</span>
            <span className="text-[12px] text-text-secondary">/ mo</span>
          </li>
        ))}
      </ul>
      {p.showAfterTax && <p className="text-[12px] text-text-secondary">Monthly bars are shown gross. After-tax figures are annual estimates.</p>}
    </div>
  )
}

/* The breakdown with its Annualized / Monthly Cash Flow switch. */
const Breakdown: React.FC<{ p: Parts; bars?: boolean; bare?: boolean }> = ({ p, bars, bare }) => {
  const [view, setView] = useState('annual')
  const body = (
    <div className="flex flex-col gap-3">
      <Seg label="Breakdown view" value={view} onChange={setView} items={[{ id: 'annual', label: 'Annualized' }, { id: 'monthly', label: 'Monthly Cash Flow' }]} />
      {view === 'annual' ? <Legend p={p} bars={bars} /> : <MonthlyChart p={p} />}
    </div>
  )
  return bare ? body : <Card>{body}</Card>
}

const Details: React.FC<{ p: Parts }> = ({ p }) => {
  const setPrimaryPackage = useCompensationStore((s) => s.setPrimaryPackage)
  const rows: [string, string][] = [
    [p.timeMode === 'current-year' ? 'Blended Base Salary' : 'Current Base Salary', cad(calcAnnualBaseSalary(p.pkg, p.timeMode))],
    ['Target Bonus', `${p.pkg.cashBonusPercent}%`],
    ['RSU Grants', `${p.pkg.rsuGrants.length} Active`],
    ['Benefits Match', `${p.pkg.rrspMatchPercent}% RRSP, ${p.pkg.esppContributionPercent}% ESPP`],
  ]
  return (
    <dl className="flex flex-col">
      <div className="flex justify-between gap-3 min-h-12 items-center text-[14px] border-b border-border">
        <dt><label htmlFor="comp-stock-price" className="text-text-secondary">Current Stock Price {p.useCadConversion ? '(CAD)' : '(USD)'}</label></dt>
        <dd className="flex items-center gap-1 font-medium text-text-primary">
          <span>$</span>
          <NumberInput id="comp-stock-price" value={p.pkg.companyCurrentPrice ?? 0} onCommit={(n) => setPrimaryPackage({ companyCurrentPrice: n })} maxDecimals={3}
            disabled={p.useCadConversion} className="w-28 min-h-11 bg-bg-primary/50 border border-border rounded-xl px-3 text-[14px] text-right disabled:opacity-60 focus:border-accent" />
        </dd>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between min-h-11 items-center text-[14px] border-b border-border last:border-b-0">
          <dt className="text-text-secondary">{k}</dt><dd className="font-medium text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`themed-card rounded-2xl p-4 ${className}`}>{children}</div>
)

/* Shown only while After-Tax is on: the three take-home stats, the notice, the estimate note and the Salary & Tax link. */
const AfterTaxBlock: React.FC<{ p: Parts }> = ({ p }) => {
  const navigate = useNavigate()
  const [replace, setReplace] = useState<{ saved: number; total: number } | null>(null)
  if (!p.showAfterTax) return null
  const hasStock = p.pkg.rsuGrants.length > 0 || p.pkg.esppContributionPercent > 0
  const open = () => {
    const { inputs, setInput } = usePlannerStore.getState()
    const saved = inputs['salary-tax']?.income
    const total = Math.round(p.total)
    if (typeof saved === 'number' && Math.round(saved) !== total) { setReplace({ saved, total }); return }
    setInput('salary-tax', 'income', total)
    navigate('/planner/salary-tax')
  }
  const finish = (yes: boolean) => {
    if (yes && replace) usePlannerStore.getState().setInput('salary-tax', 'income', replace.total)
    setReplace(null)
    navigate('/planner/salary-tax')
  }
  return (
    <Card className="flex flex-col gap-3">
      <div className="grid grid-cols-3 divide-x divide-border text-center">
        {[['Deductions', `${p.deductionPct.toFixed(1)}%`], ['Net Monthly', cad(p.takeHome.net / 12)], ['Net Biweekly', cad(p.takeHome.net / 26)]].map(([k, v]) => (
          <div key={k} className="px-1"><p className="text-[12px] text-text-secondary">{k}</p><p className="text-[15px] font-semibold text-text-primary tabular-nums">{v}</p></div>
        ))}
      </div>
      <TaxYearNotice />
      <p className="text-[12px] text-text-secondary">
        Estimate. Treats all compensation as {PROVINCIAL_TAX[p.province].name} employment income for the year. RRSP match is actually tax-sheltered; ESPP and RSU values assume sale at vest.
        {!p.useCadConversion && hasStock && ' Stock components are in USD; brackets assume CAD.'}
      </p>
      <button type="button" onClick={open} className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-accent/40 bg-accent/10 text-[14px] font-medium text-accent">
        <ExternalLink size={16} />Full Breakdown in Salary &amp; Tax
      </button>
      <ConfirmDialog
        open={replace !== null}
        title="Replace saved income?"
        message={replace ? `Salary & Tax currently uses ${cad(replace.saved)}. Replace it with your total compensation of ${cad(replace.total)}?` : ''}
        confirmLabel="Replace"
        cancelLabel="Keep Saved"
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </Card>
  )
}

/** One tap flips between two values and both stay visible, the active one lit. */
const Flip: React.FC<{ label: string; options: [string, string]; active: 0 | 1; onFlip: () => void; className?: string }> = ({ label, options, active, onFlip, className = '' }) => (
  <button type="button" onClick={onFlip} aria-label={`${label}: ${options[active]}. Switch to ${options[1 - active]}`}
    className={`flex items-center min-h-[44px] p-1 gap-1 ${className}`}>
    {options.map((o, i) => (
      <span key={o} className={`flex-1 flex items-center justify-center min-h-[36px] px-1 rounded-full text-[12px] font-medium whitespace-nowrap ${i === active ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-secondary'}`}>{o}</span>
    ))}
  </button>
)

const FlipPeriod: React.FC<{ p: Parts; className?: string }> = ({ p, className }) => (
  <Flip label="Period" options={['Current Year', 'Next 1 Year']} active={p.timeMode === 'current-year' ? 0 : 1}
    onFlip={() => p.setTimeMode(p.timeMode === 'current-year' ? 'next-1-year' : 'current-year')} className={className} />
)

const FlipTax: React.FC<{ p: Parts; className?: string }> = ({ p, className }) => (
  <Flip label="Gross or After-Tax" options={['Gross', 'After-Tax']} active={p.showAfterTax ? 1 : 0} onFlip={p.toggleAfterTax} className={className} />
)

interface CompensationMobileProps {
  /** The Equity Vesting Schedule widget. */
  equity: React.ReactNode
  /** The Compare Another Offer button and, once opened, the compare view. */
  compare: React.ReactNode
}

/** Phone Compensation: the donut and total lead, two flip toggles for the period and gross or after-tax,
 *  the after-tax block only while After-Tax is on, then breakdown, package, price, equity and compare. */
export const CompensationMobile: React.FC<CompensationMobileProps> = ({ equity, compare }) => {
  const p = useParts()
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4"><Donut p={p} size={104} /><Figure p={p} /></Card>
      <div className="flex flex-col gap-2">
        <FlipPeriod p={p} className="rounded-full border border-border bg-bg-secondary" />
        <FlipTax p={p} className="rounded-full border border-border bg-bg-secondary" />
      </div>
      <AfterTaxBlock p={p} />
      <Breakdown p={p} bars />
      <Card><h2 className="text-[15px] font-semibold mb-1">Package Details</h2><Details p={p} /></Card>
      <CompPriceCardMobile />
      {equity}
      {compare}
    </div>
  )
}
