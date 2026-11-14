import React from 'react'
import type { PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { formatMoney } from '../../planner/format'
import { incomeTotals } from './reportMetrics'
import { Section } from './Section'

export const ReportIncome: React.FC<{ report: PAReport }> = ({ report }) => {
  if (report.dividends.length === 0 && report.projectedIncome.length === 0) return null
  const totals = incomeTotals(report.dividends, report.projectedIncome)

  return (
    <Section title="Dividends & Projected Income">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px]">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-text-secondary mb-2">
            Received ({formatMoney(totals.dividends)})
          </p>
          {report.dividends.map((d, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span className="text-text-primary">{d.symbol} <span className="text-text-secondary">{d.payDate}</span></span>
              <span>{formatMoney(d.amount)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-wide text-text-secondary mb-2">
            Projected annual ({formatMoney(totals.projectedAnnual)})
          </p>
          {report.projectedIncome.map((p, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span className="text-text-primary">{p.symbol} <span className="text-text-secondary">{p.frequency}, {p.currentYieldPct.toFixed(2)}%</span></span>
              <span>{formatMoney(p.estAnnualIncome)}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
