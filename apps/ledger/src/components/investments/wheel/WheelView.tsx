import React, { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { CircleDollarSign, FileUp, Search, Trash2 } from 'lucide-react'
import { useWheelStore } from '../../../store/useWheelStore'
import { processIBKR, type RawRow } from '../../../utils/investments/wheel/ibkrActivityParser'
import { calculateNetPL } from '../../../utils/investments/wheel/calculations'
import type { TickerState } from '../../../utils/investments/wheel/types'
import { WheelTickerCard } from './WheelTickerCard'
import { WheelLedgerSheet } from './WheelLedgerSheet'
import { EmptyState } from '../../ui/EmptyState'
import { SelectField } from '../../planner/SelectField'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { useIsDesktop } from '../../../hooks/useMediaQuery'
import { WheelMobile } from './WheelMobile'

type SortMode = 'alpha' | 'plHighToLow' | 'plLowToHigh'

export const WheelView: React.FC = () => {
  const { rawRows, fileCount, addRows, clearAll } = useWheelStore()
  const [status, setStatus] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'active' | 'closed'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alpha')
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const phone = !useIsDesktop()

  const tickers = useMemo(
    () => Object.values(processIBKR(rawRows)).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [rawRows],
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileArr = Array.from(files)
    e.target.value = ''
    setStatus('Parsing CSV(s)…')

    Promise.all(
      fileArr.map(
        (file) =>
          new Promise<{ rows: RawRow[]; failed: boolean }>((resolve) => {
            try {
              Papa.parse(file, {
                skipEmptyLines: true,
                complete: (results) => resolve({ rows: results.data as RawRow[], failed: false }),
                error: () => resolve({ rows: [], failed: true }),
              })
            } catch {
              resolve({ rows: [], failed: true })
            }
          }),
      ),
    ).then((parsed) => {
      try {
        const failed = parsed.filter((p) => p.failed).length
        const newRows = parsed.flatMap((p) => p.rows)
        const before = useWheelStore.getState().rawRows.length
        addRows(newRows, fileArr.length - failed)
        const added = useWheelStore.getState().rawRows.length - before
        if (failed === fileArr.length) {
          setStatus('Could not read the selected file(s).')
        } else if (added <= 0) {
          setStatus(
            `No new IBKR activity rows found (already imported, or not an Activity Statement CSV).${failed > 0 ? ` (${failed} file(s) failed)` : ''}`,
          )
        } else {
          setStatus(`Added ${added} activity rows${failed > 0 ? ` (${failed} file(s) failed)` : ''}.`)
        }
      } catch (err) {
        setStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    }).catch((err) => {
      setStatus(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    })
  }

  const handleClear = () => setConfirmClearOpen(true)

  const filterAndSort = (arr: TickerState[]) => {
    let out = arr
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      out = out.filter((t) => t.ticker.toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => {
      if (sortMode === 'alpha') return a.ticker.localeCompare(b.ticker)
      const plA = calculateNetPL(a, a.currentPrice)
      const plB = calculateNetPL(b, b.currentPrice)
      return sortMode === 'plHighToLow' ? plB - plA : plA - plB
    })
  }

  const activeStockWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld > 0))
  const optionsOnlyWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld === 0 && t.hasOpenPosition))
  const closedWheels = filterAndSort(tickers.filter((t) => t.opSharesHeld === 0 && !t.hasOpenPosition))

  if (tickers.length === 0) {
    return (
      <div className="themed-card rounded-lg p-10">
        <EmptyState
          icon={CircleDollarSign}
          message="No wheel data yet"
          hint="Upload one or more Interactive Brokers Activity Statement CSVs to track options premium, cost basis, and true breakeven per ticker."
        />
        <div className="flex justify-center mt-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity cursor-pointer">
            <FileUp className="w-4 h-4" /> Upload CSVs
            <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="sr-only" />
          </label>
        </div>
        {status && <p className="text-[13px] text-text-secondary text-center mt-3">{status}</p>}
      </div>
    )
  }

  const section = (title: string, items: TickerState[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold text-text-primary">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((t) => (
            <WheelTickerCard key={t.ticker} data={t} onViewDetails={setSelectedTicker} />
          ))}
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      {phone ? (
        <>
          <WheelMobile tickers={tickers} fileCount={fileCount} status={status} onUpload={handleFileUpload} onClear={handleClear} onViewDetails={setSelectedTicker} />
        </>
      ) : (
        <>
      <div className="themed-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-text-secondary">
          {fileCount} statement{fileCount === 1 ? '' : 's'} aggregated · {tickers.length} tickers
          {status && <span className="ml-2">{status}</span>}
        </span>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors cursor-pointer">
            <FileUp className="w-4 h-4" /> Add CSVs
            <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="sr-only" />
          </label>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-error hover:border-error transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-text-secondary">Search</span>
            <div className="flex items-center gap-2 bg-bg-primary/50 border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
              <Search className="w-4 h-4 text-text-secondary" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickers…"
                className="bg-transparent outline-none text-[14px] text-text-primary w-36"
              />
            </div>
          </label>
          <SelectField
            label="Sort"
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
            options={[
              { value: 'alpha', label: 'Alphabetical (A-Z)' },
              { value: 'plHighToLow', label: 'Highest Net P/L' },
              { value: 'plLowToHigh', label: 'Lowest Net P/L' },
            ]}
          />
        </div>
        <div className="flex gap-2">
          {(['active', 'closed'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
                viewMode === m ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {m === 'active' ? 'Active Wheels' : 'History (Closed)'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'active' ? (
        <>
          {section('Active Stock Wheels', activeStockWheels)}
          {section('Cash-Secured Puts (Options Only)', optionsOnlyWheels)}
          {activeStockWheels.length === 0 && optionsOnlyWheels.length === 0 && (
            <p className="text-[13px] text-text-secondary text-center">No matching active positions found.</p>
          )}
        </>
      ) : (
        <>
          {section('Closed Wheels (History)', closedWheels)}
          {closedWheels.length === 0 && (
            <p className="text-[13px] text-text-secondary text-center">No matching closed positions found.</p>
          )}
        </>
      )}

        </>
      )}

      <WheelLedgerSheet
        data={selectedTicker ? tickers.find((t) => t.ticker === selectedTicker) ?? null : null}
        onClose={() => setSelectedTicker(null)}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear wheel data?"
        message="All wheel tracker data will be deleted. This cannot be undone."
        confirmLabel="Clear Data"
        tone="danger"
        onConfirm={() => {
          clearAll()
          setSelectedTicker(null)
          setConfirmClearOpen(false)
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>
  )
}
