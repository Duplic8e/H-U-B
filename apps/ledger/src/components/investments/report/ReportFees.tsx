import React from 'react'
import type { PAReport } from '../../../utils/investments/ibkrPortfolioAnalyst'
import { formatMoney } from '../../planner/format'
import { feeTotal } from './reportMetrics'
import { Section } from './Section'

export const ReportFees: React.FC<{ report: PAReport }> = ({ report }) => {
  if (report.fees.length === 0) return null

  return (
    <Section title={`Fees (${formatMoney(feeTotal(report.fees))} net)`}>
      <div
        role="group"
        aria-label="Fees"
        tabIndex={0}
        className="max-h-[240px] overflow-y-auto text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {report.fees.map((f, i) => (
          <div key={i} className="flex justify-between py-0.5">
            <span className="text-text-secondary">{f.date} <span className="text-text-primary">{f.description}</span></span>
            <span className={f.amount >= 0 ? 'text-accent' : 'text-error'}>{formatMoney(f.amount)}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
