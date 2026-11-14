import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, ChevronRight, Copy, Download, Tags, X } from 'lucide-react'
import { useTriageStore } from '../../store/useTriageStore'
import { useBudgetStore } from '../../store/useBudgetStore'
import { isQueueRow } from '../../utils/budget/categorizeQueue'
import { dismissImportReminder, importReminderDue, importReminderIcs, notifyImportReminder } from '../../utils/importReminder'

const ROW = 'flex items-center gap-3 min-h-[52px] py-1.5'
const ICON = 'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-bg-primary'

/** Everything waiting on the user, in one place: this month's import, stores
 *  to categorize, and rows that need a closer look. Renders nothing when
 *  there is nothing to do. `compact` drops the explanations, for the
 *  Dashboard, where net worth should stay near the top. */
export const NeedsAttentionCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const pending = useTriageStore((s) => s.pendingTransactions)
  const lastImportAt = useTriageStore((s) => s.lastImportAt)
  const hasImports = useTriageStore((s) => Object.keys(s.importSources).length > 0)
  const hasTransactions = useBudgetStore((s) => Object.keys(s.transactions).length > 0)
  const [dismissed, setDismissed] = useState(false)

  const rows = useMemo(() => Object.values(pending), [pending])
  const toCategorize = rows.filter(isQueueRow).length
  const toReview = rows.length - toCategorize
  const importDue = !dismissed && importReminderDue({ now: new Date(), lastImportAt, hasData: hasImports || hasTransactions })
  const calendarHref = useMemo(() => `data:text/calendar;charset=utf-8,${encodeURIComponent(importReminderIcs())}`, [])

  useEffect(() => {
    if (importDue) notifyImportReminder()
  }, [importDue])

  if (!importDue && toCategorize === 0 && toReview === 0) return null
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString(undefined, { month: 'long' })

  return (
    <section className="themed-card px-4 py-2" aria-label="Needs attention" data-testid="needs-attention">
      <h2 className="text-[13px] font-medium uppercase tracking-wide text-text-secondary pt-2">Needs attention</h2>
      <ul className="divide-y divide-border">
        {importDue && (
          <li className="py-2" data-testid="import-reminder">
            <div className={ROW}>
              <span className={`${ICON} bg-accent`}><Download className="w-5 h-5" aria-hidden="true" /></span>
              <span className="flex-1 min-w-0">
                {compact
                  ? <Link to="/budget" className="block text-[17px] font-semibold">Import {lastMonth}</Link>
                  : <span className="block text-[17px] font-semibold">Import {lastMonth}</span>}
                {!compact && <span className="block text-[14px] text-text-secondary">Download last month from your bank, then tap the import button at the top of Budgeting.</span>}
              </span>
              <button type="button" aria-label="Dismiss import reminder" onClick={() => { dismissImportReminder(); setDismissed(true) }} className="shrink-0 w-11 h-11 -mr-2 flex items-center justify-center text-text-secondary">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {!compact && <a href={calendarHref} download="ledger-import-reminder.ics" className="ml-12 min-h-[44px] inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent">
              <CalendarPlus className="w-4 h-4" aria-hidden="true" /> Remind me on the 1st
            </a>}
          </li>
        )}
        {toCategorize > 0 && (
          <li>
            <Link to="/budget/categorize" data-testid="categorize-banner" className={`${ROW} active:opacity-60`}>
              <span className={`${ICON} bg-accent`}><Tags className="w-5 h-5" aria-hidden="true" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-semibold">{toCategorize.toLocaleString()} to categorize</span>
                {!compact && <span className="block text-[14px] text-text-secondary">Pick a category once per store; Ledger does the rest.</span>}
              </span>
              <ChevronRight className="w-5 h-5 shrink-0 text-text-secondary" aria-hidden="true" />
            </Link>
          </li>
        )}
        {toReview > 0 && (
          <li>
            <Link to="/budget?tab=transactions" className={`${ROW} active:opacity-60`}>
              <span className={`${ICON} bg-[color-mix(in_srgb,var(--text-secondary)_70%,transparent)]`}><Copy className="w-5 h-5" aria-hidden="true" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-semibold">{toReview.toLocaleString()} to review</span>
                {!compact && <span className="block text-[14px] text-text-secondary">Possible duplicates, transfers and card payments.</span>}
              </span>
              <ChevronRight className="w-5 h-5 shrink-0 text-text-secondary" aria-hidden="true" />
            </Link>
          </li>
        )}
      </ul>
    </section>
  )
}
