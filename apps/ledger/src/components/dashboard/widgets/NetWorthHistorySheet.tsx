import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
import { ThemedDatePicker } from '../../ui/ThemedDatePicker'
import { NumberInput } from '../../ui/NumberInput'
import { useAccountsStore } from '../../../store/useAccountsStore'
import { formatMoney } from '../../planner/format'

interface NetWorthHistorySheetProps {
  open: boolean
  onClose: () => void
}

/** Add, correct or remove the dated points behind the net worth trend. The app
 *  records one point per day it is opened, which only covers the time since you
 *  installed it; this is how earlier figures get in. */
export const NetWorthHistorySheet: React.FC<NetWorthHistorySheetProps> = ({ open, onClose }) => {
  const history = useAccountsStore((s) => s.history)
  const setSnapshot = useAccountsStore((s) => s.setSnapshot)
  const removeSnapshot = useAccountsStore((s) => s.removeSnapshot)
  const currencySupportStartedAt = useAccountsStore((s) => s.currencySupportStartedAt)

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [value, setValue] = useState(0)

  const rows = [...history].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Net worth history"
      title="Net worth history"
      panelClassName="w-full max-w-md bg-[var(--color-bg-primary)] desktop:rounded-xl shadow-lg border border-[var(--color-border)]"
      contentClassName="flex flex-col gap-4 p-4"
    >
      <p className="text-[13px] text-text-secondary">
        The trend is drawn from these points. One is recorded each day you open the app and each
        time you change an account. Add earlier figures here to backfill the chart.
      </p>
      {currencySupportStartedAt && <p className="rounded-md border border-border p-3 text-[12px] text-text-secondary">
        Currency support began on {currencySupportStartedAt}. Earlier totals may have treated foreign balances as CAD.
      </p>}

      <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
        <label htmlFor="snapshot-date" className="text-[12px] font-medium text-text-secondary">Date</label>
        <ThemedDatePicker
          id="snapshot-date"
          ariaLabel="Snapshot date"
          value={date}
          onChange={setDate}
          className="bg-bg-secondary border-border rounded-md text-[14px]"
        />
        <label htmlFor="snapshot-value" className="text-[12px] font-medium text-text-secondary">Net worth on that date</label>
        <NumberInput
          id="snapshot-value"
          value={value}
          onCommit={setValue}
          ariaLabel="Snapshot value"
          className="w-full bg-bg-secondary border border-border rounded-md p-2 text-[14px] text-text-primary focus:border-accent focus:outline-none"
          placeholder="0.00"
        />
        <button
          type="button"
          onClick={() => setSnapshot(date, value)}
          className="self-start px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent text-[var(--color-bg-primary)]"
        >
          Add snapshot
        </button>
      </div>

      <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
        {rows.map((h) => (
          <div
            key={h.date}
            data-testid="snapshot-row"
            className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-secondary"
          >
            <span className="text-[13px] text-text-secondary tabular-nums">{h.date}</span>
            <span className="text-[13px] text-text-primary tabular-nums">{formatMoney(h.value)}</span>
            <button
              type="button"
              aria-label={`Delete snapshot for ${h.date}`}
              onClick={() => removeSnapshot(h.date)}
              className="p-2 text-text-secondary hover:text-error rounded-md"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
