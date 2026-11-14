import React from 'react'
import type { TakeHome } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'

// Net pay is deliberately not a chart colour: the deductions carry the
// palette, and what is left over reads as neutral space beside them.
const NET_COLOR = 'color-mix(in srgb, var(--text-secondary) 30%, transparent)'

/** Where gross income goes: one stacked bar of the whole salary, then the
 *  deductions as bars scaled to gross so they stay comparable to each other. */
export const DeductionsBreakdown: React.FC<{ t: TakeHome }> = ({ t }) => {
  const rows = [
    { label: 'Federal Tax', value: t.federal, color: 'var(--chart-1)' },
    { label: 'Provincial Tax', value: t.provincial, color: 'var(--chart-2)' },
    { label: `${t.plan} (incl. ${t.plan}2)`, value: t.pension, color: 'var(--chart-3)' },
    { label: 'EI', value: t.ei, color: 'var(--chart-4)' },
    ...(t.plan === 'QPP' ? [{ label: 'QPIP', value: t.qpip, color: 'var(--chart-5)' }] : []),
  ]
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  const denominator = t.gross > 0 ? t.gross : 1
  const pct = (v: number) => (v / denominator) * 100
  const legend = [...rows, { label: 'Net Pay', value: t.net, color: NET_COLOR }]
  const description = [
    ...rows.map((r, index) => `${index === 0 ? 'Federal tax' : index === 1 ? 'provincial tax' : r.label} ${formatMoney(r.value)}`),
    `net pay ${formatMoney(t.net)}`,
  ].join(', ')

  const totalPct = pct(total)
  const totalPctRounded = totalPct.toFixed(0)

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-3 h-full">
      <p className="text-[12px] uppercase tracking-wide text-text-secondary">
        Where {formatMoney(t.gross)} Goes
      </p>

      <div
        className="flex h-7 rounded-md overflow-hidden bg-bg-primary/50"
        role="img"
        aria-label={`${description}, of ${formatMoney(t.gross)} gross income`}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            style={{ width: `${pct(r.value)}%`, background: r.color }}
            title={`${r.label} ${formatMoney(r.value)}`}
          />
        ))}
        <div
          className="flex items-center justify-center min-w-0"
          style={{ width: `${pct(t.net)}%`, background: NET_COLOR }}
          title={`Net Pay ${formatMoney(t.net)}`}
        >
          <span className="text-meta font-medium text-text-primary truncate px-2">
            Net {formatMoney(t.net)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-secondary">
        {legend.map((r) => (
          <span key={r.label} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-[2px] shrink-0"
              style={{ background: r.color }}
              aria-hidden="true"
            />
            {r.label} {formatMoney(r.value)}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2 py-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-[13px] text-text-secondary w-36 shrink-0">{r.label}</span>
            <div className="flex-1 h-2 rounded bg-bg-primary/50 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${pct(r.value)}%`, background: r.color }} />
            </div>
            <span className="text-[12px] text-text-secondary w-10 text-right">
              {pct(r.value).toFixed(0)}%
            </span>
            <span className="text-[13px] text-text-primary w-24 text-right">{formatMoney(r.value)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 flex items-center gap-3">
        <span className="text-[13px] text-text-primary w-36 shrink-0">Total Deductions</span>
        <div className="flex-1 h-2 rounded bg-bg-primary/50 overflow-hidden flex">
          {rows.map((r) => (
            <div key={r.label} style={{ width: `${pct(r.value)}%`, background: r.color }} />
          ))}
        </div>
        <span className="text-[12px] text-text-secondary w-10 text-right">{totalPctRounded}%</span>
        <span className="text-[13px] text-text-primary font-semibold w-24 text-right">{formatMoney(total)}</span>
      </div>

      <p className="text-[12px] text-text-secondary">
        Bars are each deduction's share of gross income. Net pay here still includes any RRSP or
        FHSA contribution you entered.
      </p>
      <p className="text-[12px] text-text-secondary">
        2026 rates for a full-year employee. Includes standard employee credits: basic personal,
        Canada employment, and eligible CPP/QPP, EI, and QPIP contribution credits. This is an
        annual estimate, not payroll advice.
      </p>
    </div>
  )
}
