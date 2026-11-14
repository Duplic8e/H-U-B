import React, { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import {
  mapPortfolioRows, parsePortfolioText, type ColumnMapping, type UnrecognizedPortfolioCSV,
} from '../../utils/portfolioCsv'
import {
  DEFAULT_ACCOUNT, usePortfolioStore, type Holding, type ImportMode,
} from '../../store/usePortfolioStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { isPortfolioAnalystCsv, parsePortfolioAnalyst } from '../../utils/investments/ibkrPortfolioAnalyst'
import { usePortfolioReportStore } from '../../store/usePortfolioReportStore'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { holdingsFromReport } from './holdingsFromReport'
import { useIsDesktop } from '../../hooks/useMediaQuery'

const selectCls =
  'bg-bg-primary/50 border control-border rounded-lg px-3 py-2 text-text-primary text-[14px] outline-none focus:border-accent'

const MODE_LABELS: Record<ImportMode, string> = {
  replace: 'Replace this account',
  update: 'Update (merge by ticker)',
  add: 'Add as new rows',
}

/** What each mode does, as the phone steps show it. */
const MODE_BLURBS: { id: ImportMode; label: string; blurb: string }[] = [
  { id: 'replace', label: 'Replace', blurb: 'Clears this account, then loads the file.' },
  { id: 'update', label: 'Update', blurb: 'Merges by ticker. Other rows stay as they are.' },
  { id: 'add', label: 'Add', blurb: 'Keeps everything and adds the file as new rows.' },
]
const SUPPORTED = ['Interactive Brokers', 'Wealthsimple', 'PortfolioAnalyst']

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-3">
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[13px] font-semibold text-accent">{n}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-2"><div className="pt-0.5 text-[15px] font-semibold text-text-primary">{title}</div>{children}</div>
  </div>
)

export const PortfolioImport: React.FC = () => {
  const importHoldings = usePortfolioStore((s) => s.importHoldings)
  const setReport = usePortfolioReportStore((s) => s.setReport)
  const fileRef = useRef<HTMLInputElement>(null)
  const [account, setAccount] = useState(DEFAULT_ACCOUNT)
  const [mode, setMode] = useState<ImportMode>('replace')
  const [pending, setPending] = useState<UnrecognizedPortfolioCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({ ticker: '', quantity: '', totalCost: '', currency: '' })
  const [message, setMessage] = useState('')
  const phone = !useIsDesktop()
  const [holdingsPrompt, setHoldingsPrompt] = useState<Omit<Holding, 'id' | 'account'>[] | null>(null)

  const doImport = (rows: Omit<Holding, 'id' | 'account'>[], via: string) => {
    const acct = account.trim() || DEFAULT_ACCOUNT
    importHoldings(acct, mode, rows)
    setMessage(`Imported ${rows.length} holdings into "${acct}" (${MODE_LABELS[mode].toLowerCase()})${via}.`)
    setPending(null)
  }

  const onFile = async (file: File) => {
    setMessage('')
    const text = await file.text()
    if (isPortfolioAnalystCsv(text)) {
      try {
        const report = parsePortfolioAnalyst(text)
        setReport(report)
        const rows = holdingsFromReport(report)
        setMessage(`PortfolioAnalyst report imported (${report.period}).`)
        if (rows.length > 0) setHoldingsPrompt(rows)
      } catch (err) {
        setMessage(`Could not parse PortfolioAnalyst report: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
      return
    }
    const result = parsePortfolioText(text)
    if ('unrecognized' in result) {
      setPending(result)
      setMapping({ ticker: result.headers[0] ?? '', quantity: '', totalCost: '', currency: '' })
      return
    }
    doImport(result, '')
  }

  const applyMapping = () => {
    if (!pending) return
    const rows = mapPortfolioRows(pending.rows, {
      ...mapping,
      currency: mapping.currency || undefined,
    })
    doImport(rows, ' via column mapping')
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
      {phone ? (
        <div className="flex flex-col gap-5">
          <Step n={1} title="Pick the Account">
            <input
              className="min-h-11 w-full rounded-xl border control-border bg-bg-primary/50 px-3 text-[15px] text-text-primary outline-none focus:border-accent"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g. IBKR Margin"
              aria-label="Account"
            />
          </Step>
          <Step n={2} title="Choose What Happens">
            <div role="radiogroup" aria-label="Import mode" className="flex flex-col gap-2">
              {MODE_BLURBS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left ${mode === m.id ? 'border-accent bg-accent/10' : 'border-border bg-bg-secondary'}`}
                >
                  <div className={`text-[14px] font-medium ${mode === m.id ? 'text-accent' : 'text-text-primary'}`}>{m.label}</div>
                  <div className="text-[13px] text-text-secondary">{m.blurb}</div>
                </button>
              ))}
            </div>
          </Step>
          <Step n={3} title="Choose the File">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-bg-primary"
            >
              <Upload className="w-[18px] h-[18px]" aria-hidden="true" /> Import Broker CSV
            </button>
            {message && <p className="text-[13px] text-text-secondary">{message}</p>}
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED.map((s) => <span key={s} className="rounded-full border border-border bg-bg-secondary px-2.5 py-1 text-meta text-text-secondary">{s}</span>)}
            </div>
          </Step>
        </div>
      ) : (<>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Account</span>
          <input
            className={selectCls}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder="e.g. IBKR margin"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-text-secondary">Import Mode</span>
          <ThemedSelect
            value={mode}
            onChange={(v) => setMode(v as ImportMode)}
            options={(Object.keys(MODE_LABELS) as ImportMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
          />
        </label>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="w-4 h-4" /> Import broker CSV
        </button>
        {message && <span className="text-[13px] text-text-secondary">{message}</span>}
      </div>
      <p className="text-[12px] text-text-secondary">
        Interactive Brokers holdings, Wealthsimple, and IBKR PortfolioAnalyst reports are detected automatically; anything else opens the column mapper.
        "Replace" clears only the selected account; other accounts are untouched.
      </p>
      </>)}

      {pending && (
        <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
          <p className="text-[13px] text-text-primary font-medium">
            Unrecognized format. Map your columns ({pending.rows.length} rows):
          </p>
          <div className="grid grid-cols-2 desktop:grid-cols-4 gap-3">
            {([
              ['ticker', 'Ticker column'],
              ['quantity', 'Quantity column'],
              ['totalCost', 'Total cost column'],
              ['currency', 'Currency column (optional)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[13px] text-text-secondary">{label}</span>
                <ThemedSelect
                  value={mapping[key] ?? ''}
                  onChange={(v) => setMapping((m) => ({ ...m, [key]: v }))}
                  options={[
                    { value: '', label: 'None' },
                    ...pending.headers.map((h) => ({ value: h, label: h })),
                  ]}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyMapping}
              disabled={!mapping.ticker || !mapping.quantity || !mapping.totalCost}
              className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 disabled:opacity-40"
            >
              Import with mapping
            </button>
            <button onClick={() => setPending(null)} className="px-4 py-2 border control-border rounded-md text-[14px] text-text-secondary hover:text-text-primary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={holdingsPrompt !== null}
        title="Update holdings too?"
        message={`The report contains ${holdingsPrompt?.length ?? 0} stock/ETF positions. Replace the "${account.trim() || DEFAULT_ACCOUNT}" account's holdings with them? The report itself is already saved either way.`}
        confirmLabel="Update holdings"
        onConfirm={() => {
          if (holdingsPrompt) importHoldings(account.trim() || DEFAULT_ACCOUNT, 'replace', holdingsPrompt)
          setHoldingsPrompt(null)
        }}
        onCancel={() => setHoldingsPrompt(null)}
      />
    </div>
  )
}
