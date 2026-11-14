import React from 'react'
import { TAX_YEAR, isTaxYearStale } from '../../utils/finance/canadaTax'

interface TaxYearNoticeProps {
  /** Show the "<year> tax year" label even when the tables are current. The
   *  dedicated Salary & Tax tool always shows it, since the year is part of
   *  reading that page's numbers at all. A screen that only borrows a tax
   *  figure (Compensation, the forecaster) has no reason to add that label
   *  when nothing is wrong, only to speak up once the tables go stale. */
  showYearLabel?: boolean
}

/** Tax-table staleness notice, shared by every screen that renders a figure
 *  derived from canadaTax.ts's tables. Centralised so the three surfaces
 *  that use it read identically, and so a screen cannot be added later that
 *  computes from the same tables and forgets to say so. */
export const TaxYearNotice: React.FC<TaxYearNoticeProps> = ({ showYearLabel = false }) => {
  const stale = isTaxYearStale()
  if (!showYearLabel && !stale) return null

  return (
    <div className="flex flex-col gap-1">
      {showYearLabel && (
        <p className="text-meta uppercase tracking-wide text-text-secondary">{TAX_YEAR} tax year</p>
      )}
      {stale && (
        <p role="status" className="text-[13px] text-error">
          These are {TAX_YEAR} rates. Brackets and contribution limits have not been updated for{' '}
          {new Date().getFullYear()}.
        </p>
      )}
    </div>
  )
}
