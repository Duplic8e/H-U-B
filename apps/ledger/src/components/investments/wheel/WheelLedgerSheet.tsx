import React from 'react'
import { X } from 'lucide-react'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { formatWheelMoney } from '../../../utils/investments/wheel/calculations'
import { Sheet } from '../../ui/Sheet'

interface WheelLedgerSheetProps {
  data: TickerState | null
  onClose: () => void
}

export const WheelLedgerSheet: React.FC<WheelLedgerSheetProps> = ({ data, onClose }) => {
  const sortedHistory = data ? [...data.history].sort((a, b) => a.date.localeCompare(b.date)) : []
  const money = (v: number) => formatWheelMoney(v, data?.currency)
  const totalCashFlow = sortedHistory.reduce((s, h) => s + h.proceeds + h.commFee, 0)

  // The panel is capped at 85dvh, but a cap alone does nothing: with the
  // default visible overflow the ledger simply painted outside the panel and
  // the rounded card edge read as cutting the table off. Measured on a 60 row
  // ledger: the panel clamped to 612px while the table's bottom sat 1659px
  // past it, and the inner scroll container could not scroll because nothing
  // bounded its height (scrollHeight === clientHeight). Making the panel a
  // bounded flex column gives that container something to shrink against, so
  // the table scrolls inside the sheet and the header with its close button
  // stays pinned on a long ledger.
  return (
    <Sheet
      open={data !== null}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Detailed ledger"
      title={<>{data?.ticker} Detailed Ledger</>}
      panelClassName="themed-menu desktop:rounded-lg w-full max-w-3xl desktop:p-6 desktop:max-h-[85dvh] desktop:flex desktop:flex-col desktop:overflow-hidden"
      contentClassName="flex flex-col gap-3 min-h-0 desktop:flex-1"
    >
      <div className="hidden desktop:flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-text-primary">{data?.ticker} Detailed Ledger</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-text-secondary hover:text-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-auto min-h-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Instrument</th>
              <th className="py-2 pr-3 font-medium text-right">Qty</th>
              <th className="py-2 pr-3 font-medium text-right">Price</th>
              <th className="py-2 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistory.map((h, i) => {
              const cashflow = h.proceeds + h.commFee
              return (
                <tr key={i} className="border-b border-border/50 text-text-primary">
                  <td className="py-2 pr-3 whitespace-nowrap">{h.date}</td>
                  <td className="py-2 pr-3">{h.description}</td>
                  <td className={`py-2 pr-3 text-right ${h.quantity > 0 ? 'text-accent' : h.quantity < 0 ? 'text-error' : ''}`}>{h.quantity}</td>
                  <td className="py-2 pr-3 text-right">{money(h.price)}</td>
                  <td className={`py-2 text-right ${cashflow > 0 ? 'text-accent' : cashflow < 0 ? 'text-error' : ''}`}>{money(cashflow)}</td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={4} className="py-2 pr-3 text-right font-semibold text-text-primary">Net Cash Flow:</td>
              <td className={`py-2 text-right font-semibold ${totalCashFlow > 0 ? 'text-accent' : totalCashFlow < 0 ? 'text-error' : 'text-text-primary'}`}>
                {money(totalCashFlow)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Sheet>
  )
}
