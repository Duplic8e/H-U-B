import React, { useId } from 'react'
import { useCompensationStore, esppOfferingEnd, esppSummary } from '../../store/useCompensationStore'
import { NumberInput } from '../ui/NumberInput'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { formatMoney, formatMoneyWithCents } from '../planner/format'

const FIELD = 'w-full min-h-[44px] px-3 rounded-[10px] bg-[color-mix(in_srgb,var(--text-secondary)_14%,transparent)] text-[16px] text-text-primary'
const LABEL = 'text-[13px] font-medium text-text-secondary'

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** The employee stock purchase plan: what comes off each pay, the offering
 *  period, the lookback price and the price that locked. Edits save as you
 *  type, and the contribution feeds the Cash Plan in Budgeting. */
export const EsppCard: React.FC = () => {
  const pkg = useCompensationStore((s) => s.primaryPackage)
  const update = useCompensationStore((s) => s.setPrimaryPackage)
  const ids = { pct: useId(), disc: useId(), start: useId(), months: useId(), lookback: useId(), locked: useId() }
  const summary = esppSummary(pkg)

  /** Keeps the lock-in end date, which the compensation totals read, in step with the offering period. */
  const setPeriod = (start: string | undefined, months: number | undefined) => {
    update({ esppEnrollmentDate: start || undefined, esppOfferingMonths: months || undefined, esppLockInEndDate: esppOfferingEnd(start, months) ?? pkg.esppLockInEndDate })
  }

  const stat = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="text-[13px] text-text-secondary">{label}</p>
      <p className="text-[17px] font-semibold truncate">{value}</p>
    </div>
  )

  return (
    <section className="themed-card p-4 flex flex-col gap-4" aria-label="ESPP" data-testid="espp-card">
      <div>
        <h2 className="text-[20px] font-semibold">ESPP</h2>
        <p className="text-[13px] text-text-secondary">Your contribution comes off each pay and is taken out of the Cash Plan in Budgeting.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.pct} className={LABEL}>Contribution (% of pay)</label>
          <NumberInput id={ids.pct} value={pkg.esppContributionPercent} min={0} max={100} onCommit={(n) => update({ esppContributionPercent: n })} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.disc} className={LABEL}>Discount (%)</label>
          <NumberInput id={ids.disc} value={pkg.esppDiscountPercent} min={0} max={100} onCommit={(n) => update({ esppDiscountPercent: n })} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.start} className={LABEL}>Enrolled on</label>
          <ThemedDatePicker id={ids.start} value={pkg.esppEnrollmentDate ?? ''} onChange={(value) => setPeriod(value, pkg.esppOfferingMonths)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.months} className={LABEL}>Enrollment period (months)</label>
          <NumberInput id={ids.months} value={pkg.esppOfferingMonths ?? 0} min={0} max={120} placeholder="24" onCommit={(n) => setPeriod(pkg.esppEnrollmentDate, Math.round(n))} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.lookback} className={LABEL}>Lookback price</label>
          <NumberInput id={ids.lookback} value={pkg.esppLookbackPrice ?? 0} min={0} maxDecimals={2} onCommit={(n) => update({ esppLookbackPrice: n || undefined })} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.locked} className={LABEL}>Locked purchase price</label>
          <NumberInput id={ids.locked} value={pkg.esppLockedInPrice} min={0} maxDecimals={2} onCommit={(n) => update({ esppLockedInPrice: n })} className={FIELD} />
        </div>
      </div>
      <p className="text-[13px] text-text-secondary -mt-1">
        Lookback price is the share price on the day you enrolled. Locked purchase price is what you actually pay per share; enter 0 if nothing is locked and today's price less the discount is used.
        {summary.expectedPurchasePrice > 0 && (pkg.esppLookbackPrice ?? 0) > 0 && <> By the plan terms it would be {formatMoneyWithCents(summary.expectedPurchasePrice)}.</>}
      </p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border pt-3">
        {stat('From pay, per month', formatMoney(summary.annualContribution / 12))}
        {stat('From pay, per year', formatMoney(summary.annualContribution))}
        {stat('Buying at', summary.purchasePrice > 0 ? formatMoneyWithCents(summary.purchasePrice) : 'Not set')}
        {stat('Gain per year at today’s price', formatMoney(summary.annualGain))}
        {summary.offeringEnd && stat('Period ends', longDate(summary.offeringEnd))}
        {summary.monthsLeft !== undefined && stat('Time left', summary.monthsLeft === 0 ? 'Ended' : `${summary.monthsLeft} month${summary.monthsLeft === 1 ? '' : 's'}`)}
      </div>
    </section>
  )
}
