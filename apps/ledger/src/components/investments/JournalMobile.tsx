import React, { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useAnalysisStore, type InvestmentAnalysis, type Position } from '../../store/useAnalysisStore'
import { useCurrentPrice } from '../../services/marketData'
import { planRow, planFundSummary, actualFundSummary } from '../../utils/investments/planMetrics'
import {
  avgCostBasis, counterfactualValue, currentValue, plDollars, plPct, sharesFromLots, thesisChangePct, totalInvested, variance,
} from '../../utils/investments/analysisMetrics'
import { useResolvedPriceFor } from '../../utils/investments/priceFor'
import { formatMoney } from '../planner/format'
import { NumberInput } from '../ui/NumberInput'
import { Sheet } from '../ui/Sheet'
import { AddTradeForm } from './AddTradeForm'
import { AnalysisModal } from './AnalysisModal'
import { SwapSimulator } from './SwapSimulator'

type Side = 'plan' | 'actual'

const tone = (n: number) => (n >= 0 ? 'text-accent' : 'text-error')
const pctText = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

const Pill: React.FC<{ v: number | null }> = ({ v }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-meta font-semibold tabular-nums ${(v ?? 0) >= 0 ? 'bg-accent/15 text-accent' : 'bg-error/15 text-error'}`}>
    {pctText(v)}
  </span>
)

const Chip: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: string }> = ({ label, value, sub, tone: t }) => (
  <div className="flex-1 min-w-0 rounded-lg bg-bg-primary/50 px-3 py-2">
    <p className="text-meta uppercase tracking-wide text-text-secondary">{label}</p>
    <div className={`text-[14px] font-semibold tabular-nums truncate ${t ?? 'text-text-primary'}`}>{value}</div>
    {sub && <p className="text-meta text-text-secondary tabular-nums truncate">{sub}</p>}
  </div>
)

/** Return and value for one analysis, either as planned or as actually traded. */
function analysisFigures(a: InvestmentAnalysis, priceFor: (p: Position) => number, side: Side) {
  if (side === 'plan') {
    const budget = a.plannedBudget ?? 0
    const s = planFundSummary(a.positions.map((p) => planRow(p, budget, priceFor(p))), budget)
    return { base: s.totalInvested, value: s.currentValue, pct: s.totalReturnPct }
  }
  const s = actualFundSummary(a.positions, priceFor)
  return { base: s.totalInvested, value: s.currentValue, pct: s.totalReturnPct }
}

/** Two taps, so a stray touch cannot delete something. */
const DeleteButton: React.FC<{ label: string; confirm: string; onDelete: () => void }> = ({ label, confirm, onDelete }) => {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={onDelete} className="h-10 px-3 rounded-lg bg-error text-bg-primary text-[13px] font-semibold">{confirm}</button>
      <button type="button" onClick={() => setArmed(false)} className="h-10 px-2 text-[13px] text-text-secondary">Cancel</button>
    </span>
  ) : (
    <button type="button" aria-label={label} onClick={() => setArmed(true)} className="h-10 w-10 rounded-full bg-bg-primary/50 text-text-secondary flex items-center justify-center">
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

interface LineProps {
  analysis: InvestmentAnalysis
  position: Position
  side: Side
  totals: { plannedAll: number; currentAll: number }
}

/** One position as a one-line row; tapping it opens the numbers and the controls
 *  that used to sit on the position card (price override, refresh, acted, lots,
 *  delete) and, on the Plan side, the allocation field. */
const PositionLine: React.FC<LineProps> = ({ analysis, position: p, side, totals }) => {
  const { updatePosition, removePosition, removeLot } = useAnalysisStore.getState()
  const quote = useCurrentPrice(p.ticker, p.exchange)
  const price = quote.data?.value.price ?? p.startPrice
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(0)
  const budget = analysis.plannedBudget ?? 0
  const pr = planRow(p, budget, price)
  const invested = totalInvested(p.lots)
  const value = currentValue(p.lots, price)
  const isPlan = side === 'plan'
  const traded = p.lots.length > 0
  const ret = isPlan ? pr.returnPct : traded ? plPct(p.lots, price) : null
  const shown = isPlan ? pr.currentValue : value
  const detailId = `journal-detail-${p.id}`
  const overridden = quote.data?.source === 'override'

  const cells: [string, string][] = [
    ['Start Price', p.startPrice.toFixed(2)],
    ['Now', `${price.toFixed(2)} ${pctText(thesisChangePct(p.startPrice, price))}`],
    ['Planned', formatMoney(p.plannedAmount)],
    ['Invested', `${formatMoney(invested)} (${formatMoney(variance(p.plannedAmount, p.lots))} vs plan)`],
    ['Avg Cost', avgCostBasis(p.lots)?.toFixed(2) ?? '-'],
    ['Shares', (isPlan ? pr.shares : sharesFromLots(p.lots)).toFixed(2)],
    ['If Fully Executed', formatMoney(counterfactualValue(p.plannedAmount, p.startPrice, price))],
    ['P/L', formatMoney(plDollars(p.lots, price))],
  ]

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        aria-label={`Details for ${p.ticker}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[56px] py-2 flex items-center gap-3 text-left rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-text-primary">
            {p.ticker}{p.exchange ? <span className="text-text-secondary text-[13px] font-normal"> · {p.exchange}</span> : null}
          </span>
          <span className="block text-meta text-text-secondary tabular-nums">
            {isPlan ? `${pr.allocationPct}% · Planned ${formatMoney(pr.plannedDollars)}` : traded ? `Invested ${formatMoney(invested)} · ${sharesFromLots(p.lots).toFixed(2)} Shares` : 'No trades yet'}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[14px] font-medium text-text-primary tabular-nums">{!isPlan && !traded ? '-' : formatMoney(shown)}</span>
          <Pill v={ret} />
        </span>
      </button>
      {open && (
        <div id={detailId} className="pb-3 flex flex-col gap-2">
          {isPlan && (
            <label className="flex items-center justify-between gap-3 rounded-md bg-bg-primary/50 px-3 py-1.5 text-[13px]">
              <span className="text-text-secondary">Allocation %</span>
              <NumberInput
                min={0}
                max={100}
                ariaLabel={`Allocation % for ${p.ticker}`}
                value={pr.allocationPct}
                onCommit={(n) => updatePosition(analysis.id, p.id, { allocationPct: n, plannedAmount: (budget * n) / 100 })}
                className="w-20 bg-transparent text-right text-[13px] text-text-primary outline-none focus:text-accent"
              />
            </label>
          )}
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            {cells.map(([label, v]) => (
              <div key={label} className="rounded-md bg-bg-primary/50 px-2 py-1.5">
                <dt className="text-meta uppercase tracking-wide text-text-secondary">{label}</dt>
                <dd className="tabular-nums text-text-primary">{v}</dd>
              </div>
            ))}
            <div className="rounded-md bg-bg-primary/50 px-2 py-1.5">
              <dt className="text-meta uppercase tracking-wide text-text-secondary">Allocation Now</dt>
              <dd className="tabular-nums text-text-primary">{totals.currentAll > 0 ? pctText((value / totals.currentAll) * 100) : '-'}</dd>
            </div>
            <div className="rounded-md bg-bg-primary/50 px-2 py-1.5">
              <dt className="text-meta uppercase tracking-wide text-text-secondary">Acted</dt>
              <dd>
                <button type="button" onClick={() => updatePosition(analysis.id, p.id, { acted: !p.acted })} className="tap-exempt min-h-0 text-left text-text-primary underline decoration-dotted">
                  {p.acted ? 'Yes' : 'No, still watching'}
                </button>
              </dd>
            </div>
          </dl>
          {quote.status === 'error' && <p className="text-[12px] text-error">Live price unavailable, using the start price.</p>}
          <form
            onSubmit={(e) => { e.preventDefault(); if (draft > 0) { quote.setManual(draft); setDraft(0) } }}
            className="flex items-center gap-2"
          >
            <NumberInput
              value={draft}
              onCommit={setDraft}
              ariaLabel={`Manual price for ${p.ticker}`}
              placeholder={`Manual price${quote.data ? ` (${quote.data.source}${quote.data.stale ? ', stale' : ''})` : ''}`}
              className="flex-1 min-w-0 bg-bg-primary/50 border border-border rounded-lg px-3 text-[14px] text-text-primary focus:border-accent focus:outline-none"
            />
            <button type="submit" className="h-10 px-3 rounded-lg border border-border text-[13px] font-medium text-text-primary">Set</button>
            {overridden && (
              <button type="button" onClick={() => quote.clearManual()} className="h-10 px-2 text-[13px] text-text-secondary underline decoration-dotted">Clear</button>
            )}
            <button type="button" aria-label="Refresh price" onClick={() => quote.refresh(true)} className="h-10 w-10 shrink-0 rounded-lg border border-border text-text-secondary flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${quote.status === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </form>
          {p.lots.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer text-text-secondary">Buy Lots ({p.lots.length})</summary>
              <div className="flex flex-col mt-1">
                {p.lots.map((l) => (
                  <div key={l.id} className="flex items-center justify-between border-b border-border last:border-b-0">
                    <span className="text-text-secondary tabular-nums">{l.date}: {formatMoney(l.amountInvested)} @ {l.price.toFixed(2)}</span>
                    <button type="button" aria-label="Remove lot" onClick={() => removeLot(analysis.id, p.id, l.id)} className="tap-exempt h-11 w-10 flex items-center justify-center text-text-secondary">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="flex justify-end">
            <DeleteButton label="Delete position" confirm={`Delete ${p.ticker}`} onDelete={() => removePosition(analysis.id, p.id)} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Everything one analysis offers, in a sheet: Plan and Actual, the budget, the swap what-if and its positions. */
const AnalysisDetail: React.FC<{ analysis: InvestmentAnalysis; totals: { plannedAll: number; currentAll: number }; onDeleted: () => void }> = ({ analysis, totals, onDeleted }) => {
  const removeAnalysis = useAnalysisStore((s) => s.removeAnalysis)
  const updateAnalysis = useAnalysisStore((s) => s.updateAnalysis)
  const updatePosition = useAnalysisStore((s) => s.updatePosition)
  const priceFor = useResolvedPriceFor()
  const [side, setSide] = useState<Side>('plan')
  const [addOpen, setAddOpen] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)
  const f = analysisFigures(analysis, priceFor, side)
  const hasPositions = analysis.positions.length > 0
  const hasLots = analysis.positions.some((p) => p.lots.length > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta text-text-secondary">Analyzed {analysis.analysisDate} · {analysis.positions.length} Position{analysis.positions.length === 1 ? '' : 's'}</p>
          {analysis.thesis && <p className="text-[13px] text-text-secondary mt-1">{analysis.thesis}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {side === 'actual' && hasPositions ? (
            <button type="button" aria-label="Add trade" onClick={() => setTradeOpen(true)} className="h-10 px-3 rounded-full bg-bg-primary/50 text-[13px] font-medium text-text-primary flex items-center gap-1"><Plus className="w-4 h-4" /> Trade</button>
          ) : (
            <button type="button" aria-label="Add position" onClick={() => setAddOpen(true)} className="h-10 px-3 rounded-full bg-bg-primary/50 text-[13px] font-medium text-text-primary flex items-center gap-1"><Plus className="w-4 h-4" /> Position</button>
          )}
          <DeleteButton label="Delete analysis" confirm="Delete" onDelete={() => { removeAnalysis(analysis.id); onDeleted() }} />
        </div>
      </div>

      {!hasPositions ? (
        <p className="text-[13px] text-text-secondary">No positions yet. Add one to start tracking.</p>
      ) : (
        <>
          <div role="group" aria-label="Plan or actual" className="flex rounded-full bg-bg-primary/50 p-0.5">
            {(['plan', 'actual'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={`flex-1 h-8 rounded-full text-[13px] font-medium ${side === s ? 'bg-accent text-bg-primary' : 'text-text-secondary'}`}>
                {s === 'plan' ? 'Plan' : 'Actual'}
              </button>
            ))}
          </div>

          {side === 'actual' && <AddTradeForm analysis={analysis} open={tradeOpen} onOpenChange={setTradeOpen} />}

          <div className="flex gap-2">
            <Chip
              label={side === 'plan' ? 'Budget' : 'Invested'}
              value={side === 'plan' ? (
                <NumberInput
                  min={0}
                  ariaLabel="Planned Budget ($)"
                  value={analysis.plannedBudget ?? 0}
                  onCommit={(budget) => {
                    updateAnalysis(analysis.id, { plannedBudget: budget })
                    analysis.positions.forEach((p) => updatePosition(analysis.id, p.id, { plannedAmount: (budget * (p.allocationPct ?? 0)) / 100 }))
                  }}
                  className="w-full bg-transparent p-0 border-0 text-[14px] font-semibold text-text-primary outline-none focus:text-accent"
                />
              ) : formatMoney(f.base)}
            />
            <Chip label="Value" value={formatMoney(f.value)} />
            <Chip label="Return" value={pctText(f.pct)} tone={tone(f.pct ?? 0)} />
          </div>

          {(side === 'plan' || hasLots) && (
            <SwapSimulator
              analysis={analysis}
              side={side}
              priceFor={priceFor}
              investedFor={(p: Position) => (side === 'plan' ? planRow(p, analysis.plannedBudget ?? 0, priceFor(p)).plannedDollars : totalInvested(p.lots))}
            />
          )}
          {side === 'actual' && !hasLots && (
            <p className="text-[13px] text-text-secondary">No trades recorded yet. Add your first trade to see actual performance.</p>
          )}

          <div>
            {analysis.positions.map((p) => <PositionLine key={p.id} analysis={analysis} position={p} side={side} totals={totals} />)}
          </div>
        </>
      )}

      <AnalysisModal isOpen={addOpen} onClose={() => setAddOpen(false)} analysisId={analysis.id} />
    </div>
  )
}

interface JournalMobileProps {
  analyses: InvestmentAnalysis[]
  /** Planned, invested and current value across every analysis, as the page header computes them. */
  planned: number
  invested: number
  current: number
}

/** The phone Plan vs Actual tab: the totals, then one compact row per analysis
 *  (name, planned against invested, value and return). Tapping a row opens that
 *  analysis in a sheet. Desktop keeps the stat cards and analysis cards. */
export const JournalMobile: React.FC<JournalMobileProps> = ({ analyses, planned, invested, current }) => {
  const priceFor = useResolvedPriceFor()
  const [openId, setOpenId] = useState<string | null>(null)
  const selected = analyses.find((a) => a.id === openId) ?? null
  const ret = current - invested

  return (
    <div className="flex flex-col gap-3">
      <div className="themed-card rounded-lg p-4 flex flex-col gap-3">
        <div>
          <p className="text-[12px] uppercase text-text-secondary">Current Value</p>
          <p data-key-figure className="text-[34px] font-semibold tabular-nums leading-none mt-2 text-text-primary">{formatMoney(current)}</p>
          <p className={`text-[14px] font-medium tabular-nums mt-2 ${tone(ret)}`}>
            <span aria-hidden="true">{ret >= 0 ? '▲' : '▼'}</span> {ret >= 0 ? '+' : ''}{formatMoney(ret)} since invested
          </p>
        </div>
        <div className="flex gap-2">
          <Chip label="Planned" value={formatMoney(planned)} />
          <Chip label="Invested" value={formatMoney(invested)} sub={`${formatMoney(invested - planned)} vs plan`} />
        </div>
      </div>

      <div className="themed-card rounded-lg px-4">
        {analyses.map((a) => {
          const f = analysisFigures(a, priceFor, 'actual')
          const budget = a.plannedBudget ?? 0
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              aria-label={`Open ${a.name}`}
              className="w-full min-h-[72px] py-3 flex items-center gap-3 text-left border-b border-border last:border-b-0"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-text-primary truncate">{a.name}</span>
                <span className="block text-meta text-text-secondary tabular-nums">{a.analysisDate} · Plan {formatMoney(budget)} · In {formatMoney(f.base)}</span>
                <span className="block h-1.5 rounded-full bg-border overflow-hidden mt-2" aria-hidden="true">
                  <span className="block h-full bg-accent" style={{ width: `${budget > 0 ? Math.min((f.base / budget) * 100, 100) : 0}%` }} />
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[14px] font-medium text-text-primary tabular-nums">{formatMoney(f.value)}</span>
                <Pill v={f.pct} />
              </span>
            </button>
          )
        })}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => setOpenId(null)}
        desktop="modal"
        ariaLabel="Analysis"
        title={selected?.name}
        panelClassName="themed-menu desktop:rounded-lg w-full max-w-lg desktop:p-6"
      >
        {selected && <AnalysisDetail analysis={selected} totals={{ plannedAll: planned, currentAll: current }} onDeleted={() => setOpenId(null)} />}
      </Sheet>
    </div>
  )
}
