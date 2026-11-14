import React from 'react'
import { marginalSlices, type MarginalSlice, type Province } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'

const Rung: React.FC<{ slice: MarginalSlice; hot?: boolean }> = ({ slice, hot = false }) => (
  <div
    className={`flex items-center gap-3 rounded-md px-2.5 py-2 border ${
      hot ? 'border-accent/50 bg-accent/10' : 'border-transparent bg-bg-primary/40'
    }`}
  >
    <span className={`text-[13px] font-semibold w-14 shrink-0 ${hot ? 'text-accent' : 'text-text-primary'}`}>
      {slice.rate.toFixed(1)}%
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[13px] text-text-primary">{formatMoney(slice.amount)}</span>
      <span className="block text-meta text-text-secondary">
        {/* The top rung is open-ended from the reader's point of view: it is the
            band their last dollar lands in, so name the floor, not the ceiling. */}
        {hot ? `above ${formatMoney(slice.from)}` : `${formatMoney(slice.from)} to ${formatMoney(slice.to)}`}
      </span>
    </span>
    <span className="text-[13px] text-text-primary w-20 text-right shrink-0">
      {formatMoney(slice.taxSaved)}
    </span>
  </div>
)

/** How much income sits in each marginal band, and what an RRSP contribution
 *  that clears the top band is worth. Savings come from the tax functions
 *  themselves, so surtax and credit phase-outs are already accounted for. */
export const RrspEfficiencyCard: React.FC<{
  gross: number
  taxableIncome: number
  rrsp: number
  fhsa: number
  province: Province
  room: number | null
}> = ({ gross, taxableIncome, rrsp, fhsa, province, room }) => {
  const slices = marginalSlices(gross, province, rrsp, fhsa)
  const top = slices[0]

  if (!top || top.rate <= 0) {
    return (
      <div className="themed-card rounded-lg p-4 flex flex-col gap-2 h-full">
        <p className="text-[12px] uppercase tracking-wide text-text-secondary">RRSP Efficiency</p>
        <p className="text-[13px] text-text-secondary">
          {taxableIncome <= 0
            ? 'No taxable income to shelter.'
            : 'You pay no income tax at this income, so an RRSP deduction saves nothing this year.'}
        </p>
      </div>
    )
  }

  const shown = slices.slice(0, 2)
  const rest = slices[2]
  const roomKnown = room !== null
  const fits = roomKnown && top.amount <= room
  const usedPct = roomKnown && room > 0 ? Math.min((top.amount / room) * 100, 100) : 0

  return (
    <div className="themed-card rounded-lg p-4 flex flex-col gap-3 h-full">
      <p className="text-[12px] uppercase tracking-wide text-text-secondary">RRSP Efficiency</p>

      <div className="flex items-baseline gap-2">
        <span className="text-[26px] font-semibold text-accent leading-none">{top.rate.toFixed(1)}%</span>
        <span className="text-[12px] text-text-secondary">potential tax saved per additional deductible RRSP dollar</span>
      </div>

      <div className="flex flex-col gap-1 mt-1">
        <span className="text-meta uppercase tracking-wide text-text-secondary">Income by saving rate</span>
        {shown.map((s, i) => (
          <Rung key={s.from} slice={s} hot={i === 0} />
        ))}
        {rest && (
          <div className="flex items-center gap-3 rounded-md px-2.5 py-2 text-text-secondary">
            <span className="text-[13px] w-14 shrink-0">{rest.rate.toFixed(1)}%</span>
            <span className="flex-1 min-w-0 text-[12px]">
              {formatMoney(rest.to)} and below, the lowest-value dollars to shelter
            </span>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3 flex flex-col gap-1.5">
        <p className="text-[13px] text-text-primary">
          If deductible, {formatMoney(top.amount)} RRSP clears your top band, saving {formatMoney(top.taxSaved)}
        </p>
        {room === null ? (
          <p className="text-[12px] text-text-secondary">
            Enter your CRA RRSP deduction limit to compare with available room.
          </p>
        ) : room === 0 ? (
          <p className="text-[12px] text-text-secondary">
            No entered RRSP deduction room remains.
          </p>
        ) : (
          <>
            <div
              className="h-1.5 rounded bg-bg-primary/50 overflow-hidden"
              role="progressbar"
              aria-label="Remaining room used"
              aria-valuenow={Math.round(usedPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded bg-accent" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="text-[12px] text-text-secondary">
              {fits
                ? `Uses ${usedPct.toFixed(0)}% of your ${formatMoney(room)} remaining CRA room`
                : `Exceeds your ${formatMoney(room)} remaining CRA room by ${formatMoney(top.amount - room)}`}
            </p>
          </>
        )}
      </div>

      <p className="text-[12px] text-text-secondary">
        Your CRA notice of assessment gives your RRSP deduction limit. Without it, this rate assumes
        another dollar would be deductible. An annual estimate, not tax advice.
      </p>
    </div>
  )
}
