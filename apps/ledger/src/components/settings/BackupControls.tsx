import React, { useState } from 'react'
import { Download, Upload, Sparkles, X } from 'lucide-react'
import { backupToBlob, backupFilename, parseBackupText, restoreBackup } from '../../utils/backup'
import { buildDemoData, buildDemoCategoryGroups, isDemoActive, setDemoActive as setDemoFlag } from '../../utils/demoData'
import { useBudgetStore } from '../../store/useBudgetStore'
import { useUndoStore } from '../../store/useUndoStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { PHONE_SECONDARY_ACTION } from './actionStyles'

/** Same id-prefix scheme the backup scrub in utils/backup.ts relies on to
 *  keep demo rows out of backups and Drive sync. Reusing the prefix here
 *  keeps "Clear demo data" symmetric with that scrub: both treat a
 *  demo-prefixed id as the sole signal that a record is demo data. */
const isDemoId = (id: string) => id.startsWith('demo-')

/** Drops only demo-prefixed keys from a record map, leaving any real records
 *  (including ones added while demo mode happened to be active) untouched. */
function withoutDemoRecords<T>(records: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(records).filter(([id]) => !isDemoId(id)))
}

export const BackupControls: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [demoActive, setDemoActive] = useState(() => isDemoActive())
  const [confirmLoadOpen, setConfirmLoadOpen] = useState(false)
  const offerUndo = useUndoStore((s) => s.offerUndo)
  const isDesktop = useIsDesktop()
  // Phone: the demo action shares the one secondary-action look with the other
  // full-width actions in this sheet (same height, radius and border).
  const demoActionClass = isDesktop
    ? 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors'
    : `flex items-center justify-center gap-1.5 ${PHONE_SECONDARY_ACTION}`

  const applyDemoData = () => {
    const previous = useBudgetStore.getState()
    const hadRealData =
      Object.keys(previous.transactions).length > 0 ||
      Object.keys(previous.categories).length > 0 ||
      Object.keys(previous.categoryGroups).length > 0

    const { transactions, categories } = buildDemoData()
    const categoryGroups = buildDemoCategoryGroups()
    setDemoFlag(true)
    useBudgetStore.setState({ transactions, categories, categoryGroups })
    setDemoActive(true)

    if (hadRealData) {
      offerUndo('Loaded demo data, replacing existing data', () => {
        setDemoFlag(false)
        useBudgetStore.setState({
          transactions: previous.transactions,
          categories: previous.categories,
          categoryGroups: previous.categoryGroups,
        })
        setDemoActive(false)
      })
    }
  }

  const handleLoadDemo = () => {
    const { transactions, categories, categoryGroups } = useBudgetStore.getState()
    const hasRealData =
      Object.keys(transactions).length > 0 ||
      Object.keys(categories).length > 0 ||
      Object.keys(categoryGroups).length > 0

    if (hasRealData) {
      setConfirmLoadOpen(true)
      return
    }
    applyDemoData()
  }

  const confirmLoadDemo = () => {
    setConfirmLoadOpen(false)
    applyDemoData()
  }

  const handleClearDemo = () => {
    setDemoFlag(false)
    const { transactions, categories, categoryGroups } = useBudgetStore.getState()
    useBudgetStore.setState({
      transactions: withoutDemoRecords(transactions),
      categories: withoutDemoRecords(categories),
      categoryGroups: withoutDemoRecords(categoryGroups),
    })
    setDemoActive(false)
  }

  const handleExport = () => {
    const url = URL.createObjectURL(backupToBlob())
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename()
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) {
      e.target.value = ''
      return
    }
    try {
      const env = parseBackupText(await file.text())
      restoreBackup(env)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Ledger backup file')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Download className="w-4 h-4" /> Export data
        </button>
        <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer">
          <Upload className="w-4 h-4" /> Import backup
          <input type="file" accept="application/json" onChange={handleImport} className="sr-only" />
        </label>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {demoActive ? (
        <button
          onClick={handleClearDemo}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-error hover:border-error transition-colors"
        >
          <X className="w-4 h-4" /> Clear demo data
        </button>
      ) : (
        <button
          onClick={handleLoadDemo}
          className={demoActionClass}
        >
          <Sparkles className="w-4 h-4" /> Load demo data
        </button>
      )}
      <ConfirmDialog
        open={confirmLoadOpen}
        title="Load demo data?"
        message="You already have data in Ledger. Loading demo data will replace your transactions, categories, and category groups. You can undo this right after."
        confirmLabel="Replace with demo data"
        tone="danger"
        onConfirm={confirmLoadDemo}
        onCancel={() => setConfirmLoadOpen(false)}
      />
    </div>
  )
}
