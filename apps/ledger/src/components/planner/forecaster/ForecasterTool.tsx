import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { useAccountsStore, type NetWorthSnapshot } from '../../../store/useAccountsStore'
import { CalculatorField } from '../CalculatorField'
import { ResultCard } from '../ResultCard'
import { formatMoney } from '../format'
import { ForecastChart } from './ForecastChart'
import { ListEditor } from './ListEditor'
import { MonteCarloSection } from './MonteCarloSection'
import { useForecasterSettings, type Goal, type LifeEvent } from './useForecasterSettings'
import { monthsToReach } from '../../../utils/finance/fire'
import { buildForecastModel, formatMonthsOut, type ForecasterData } from './forecastModel'
import { ForecasterMobile } from './ForecasterMobile'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { Sheet } from '../../ui/Sheet'
import { TaxYearNotice } from '../../ui/TaxYearNotice'

/** Toggle between an auto-fed value and a manual field. */
const AutoField: React.FC<{
  label: string
  auto: boolean
  autoValue: number | null
  autoHint: string
  manualValue: number
  onToggle: (auto: boolean) => void
  onManual: (v: number) => void
}> = ({ label, auto, autoValue, autoHint, manualValue, onToggle, onManual }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      <button
        onClick={() => onToggle(!auto)}
        className={`text-meta px-2 py-0.5 rounded border transition-colors ${
          auto ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
        }`}
      >
        {auto ? autoHint : 'Manual'}
      </button>
    </div>
    {auto ? (
      <div className="bg-bg-primary/50 border border-border rounded-lg px-3 py-2 text-text-primary text-[15px]">
        {autoValue === null ? 'Conversion Needed' : formatMoney(autoValue)}
      </div>
    ) : (
      <CalculatorField label="" value={manualValue} onChange={onManual} step={100} prefix="$" />
    )}
  </div>
)

export const ForecasterTool: React.FC = () => {
  const data = useForecasterSettings()
  const { settings, setSetting, events, saveEvents, goals, saveGoals, autoFeed, resolved, compTax } = data
  const history = useAccountsStore((s) => s.history)
  const gearRef = useRef<HTMLButtonElement>(null)
  const [taxOpen, setTaxOpen] = useState(false)
  const isPhone = !useMediaQuery('(min-width: 768px)')

  if (isPhone) return <ForecasterMobile data={data} />

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-fed inputs with manual overrides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <AutoField
          label="Starting Balance"
          auto={settings.autoStart as boolean}
          autoValue={autoFeed.startBalance}
          autoHint="Dashboard Net Worth"
          manualValue={settings.manualStart}
          onToggle={(v) => setSetting('autoStart', v)}
          onManual={(v) => setSetting('manualStart', v)}
        />
        <AutoField
          label="Monthly Savings"
          auto={settings.autoSavings as boolean}
          autoValue={resolved.monthlySavings}
          autoHint="Budget Average (3 Months)"
          manualValue={settings.manualSavings}
          onToggle={(v) => setSetting('autoSavings', v)}
          onManual={(v) => setSetting('manualSavings', v)}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-secondary">Comp Events / Debt Drag</span>
          <div className="flex gap-2 items-stretch">
            <button
              onClick={() => setSetting('autoComp', !settings.autoComp)}
              aria-pressed={settings.autoComp}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.autoComp ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              Comp Events
              {settings.autoComp && <span className="ml-1 font-normal">({autoFeed.compLumps.length})</span>}
            </button>
            <button
              onClick={() => setSetting('includeDebtDrag', !settings.includeDebtDrag)}
              aria-pressed={settings.includeDebtDrag}
              className={`flex-1 text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.includeDebtDrag ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              Debt Drag
              {autoFeed.debtDrag && <span className="ml-1 font-normal">({formatMoney(autoFeed.debtDrag.amount)}/mo)</span>}
            </button>
            <button
              ref={gearRef}
              aria-label="Comp event tax settings"
              onClick={() => setTaxOpen(true)}
              className={`px-2 rounded-lg border transition-colors ${
                settings.compTaxEnabled ? 'border-accent text-accent' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <Settings2 size={14} />
            </button>
          </div>
          <Sheet
            open={taxOpen}
            onClose={() => setTaxOpen(false)}
            desktop="popover"
            anchorRef={gearRef}
            ariaLabel="Comp event tax settings"
            panelClassName="themed-menu rounded-lg p-4 w-[280px] flex flex-col gap-2"
          >
            <button
              onClick={() => setSetting('compTaxEnabled', !settings.compTaxEnabled)}
              aria-pressed={settings.compTaxEnabled}
              className={`text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                settings.compTaxEnabled ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
              }`}
            >
              Tax Comp Events
            </button>
            {settings.compTaxEnabled ? (
              <button
                onClick={() => setSetting('compTaxAuto', !settings.compTaxAuto)}
                className={`text-[12px] px-2 py-2 rounded-lg border transition-colors ${
                  settings.compTaxAuto ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
                }`}
              >
                {settings.compTaxAuto ? `Marginal ${compTax.ratePct.toFixed(0)}% (${compTax.province})` : 'Manual Rate'}
              </button>
            ) : null}
            {settings.compTaxEnabled && !settings.compTaxAuto ? (
              <CalculatorField label="Manual Rate" suffix="%" step={1} value={settings.compTaxManualPct as number} onChange={(v) => setSetting('compTaxManualPct', v)} />
            ) : null}
            {/* The staleness warning lives on the main body now, next to the
                chart and result cards it actually describes, since this
                popover starts closed and those figures render regardless.
                Repeating the same sentence in here too would just be a
                second copy of it on screen at once whenever both are open. */}
            <p className="text-meta text-text-secondary">
              Comp events taxed at your marginal rate; RSU/ESPP treated as employment income.
            </p>
          </Sheet>
        </div>
      </div>

      {/* What-if sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <CalculatorField label="Years" min={1} max={50} value={settings.years} onChange={(v) => setSetting('years', v)} />
        <CalculatorField label="Return" suffix="%" step={0.1} value={settings.annualReturnPct} onChange={(v) => setSetting('annualReturnPct', v)} />
        <CalculatorField label="Inflation" suffix="%" step={0.1} value={settings.inflationPct} onChange={(v) => setSetting('inflationPct', v)} />
        <CalculatorField label="Contribution Step-Up" suffix="%/yr" step={0.5} value={settings.stepUpPct} onChange={(v) => setSetting('stepUpPct', v)} />
        <CalculatorField label="Scenario Spread" suffix="± %" step={0.5} value={settings.spreadPct} onChange={(v) => setSetting('spreadPct', v)} />
      </div>

      {/* View toggles */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSetting('showReal', !settings.showReal)}
          className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-colors ${
            settings.showReal ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-secondary'
          }`}
        >
          {settings.showReal ? "Real (Today's Dollars)" : 'Nominal'}
        </button>
        <button
          onClick={() => setSetting('view', settings.view === 'line' ? 'stacked' : 'line')}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          {settings.view === 'line' ? 'Show Contributions vs Growth' : 'Show Scenario Bands'}
        </button>
      </div>

      {resolved.startBalance === null ? (
        <p className="text-sm text-text-secondary">Conversion Needed to calculate a forecast from dashboard net worth. <Link to="/" className="text-accent underline">Review accounts</Link></p>
      ) : (
        <ForecasterResults data={{ settings, setSetting, events, saveEvents, goals, saveGoals, autoFeed, resolved, compTax }} history={history} startBalance={resolved.startBalance} />
      )}
    </div>
  )
}

const ForecasterResults: React.FC<{ data: ForecasterData; history: NetWorthSnapshot[]; startBalance: number }> = ({ data, history, startBalance }) => {
  const { settings, setSetting, events, saveEvents, goals, saveGoals, resolved } = data
  const { lumps, points, fi, fiMonth, coast, goalMarkers } = buildForecastModel(data, startBalance)

  return <>
      <ForecastChart
        points={points}
        history={history}
        showReal={settings.showReal as boolean}
        view={settings.view as 'line' | 'stacked'}
        goalMarkers={goalMarkers}
      />

      {/* Sits between the chart above and the FI/Coast-FI cards below,
          the same figures compTaxEnabled + compTaxAuto feed via the comp
          lumps. compTaxEnabled and compTaxAuto both default to true, so
          the chart, FI Number, Coast-FI and every goal's Projected date
          below are tax-derived by default; a manual rate never touches
          canadaTax.ts's tables, so it has nothing to go stale. */}
      {settings.compTaxEnabled && settings.compTaxAuto ? <TaxYearNotice /> : null}

      {/* FIRE engine */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CalculatorField label="Annual Spending in Retirement" prefix="$" step={1000} value={settings.annualSpending} onChange={(v) => setSetting('annualSpending', v)} />
        <CalculatorField label="Withdrawal Rate" suffix="%" step={0.1} value={settings.withdrawalRatePct} onChange={(v) => setSetting('withdrawalRatePct', v)} />
        <ResultCard label="FI Number" value={formatMoney(fi)} highlight />
        <ResultCard label="Projected FI Date" value={formatMonthsOut(fiMonth)} />
      </div>
      <ResultCard
        label={`Coast-FI (Needed Today to Coast for ${settings.years}y)`}
        value={`${formatMoney(coast)}, you have ${formatMoney(startBalance)} (${startBalance >= coast ? 'coasting ✓' : 'not yet'})`}
      />

      {/* Goals + life events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListEditor<Goal>
          title="Goals (Net-Worth Targets)"
          items={goals}
          columns={[
            { key: 'label', label: 'Goal', type: 'text' },
            { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
          ]}
          makeNew={() => ({ id: `g${Date.now()}`, label: 'New goal', amount: 100000 })}
          onChange={saveGoals}
          renderExtra={(g) => (
            <>
              <span className="text-[13px] font-medium text-text-secondary">Projected</span>
              <span className="text-[15px] text-text-primary py-2">{formatMonthsOut(monthsToReach(points, g.amount))}</span>
            </>
          )}
        />
        <ListEditor<LifeEvent>
          title="Life Events (Negative = Cost, Positive = Windfall)"
          items={events}
          columns={[
            { key: 'label', label: 'Event', type: 'text' },
            { key: 'yearsFromNow', label: 'Years From Now', type: 'number', step: 0.5 },
            { key: 'amount', label: 'Amount ($)', type: 'number', step: 1000 },
          ]}
          makeNew={() => ({ id: `e${Date.now()}`, label: 'House down payment', yearsFromNow: 3, amount: -100000 })}
          onChange={saveEvents}
          renderExtra={(e) => (
            <>
              <span className="text-[13px] font-medium text-text-secondary">Lands</span>
              <span className="text-[15px] text-text-primary py-2">{formatMonthsOut(Math.max(1, Math.round(e.yearsFromNow * 12)))}</span>
            </>
          )}
        />
      </div>

      <MonteCarloSection
        startBalance={startBalance}
        monthlySavings={resolved.monthlySavings}
        years={settings.years}
        meanReturnPct={settings.annualReturnPct}
        stdDevPct={settings.mcStdDevPct}
        stepUpPct={settings.stepUpPct}
        lumpSums={lumps}
        target={fi}
        onStdDevChange={(v) => setSetting('mcStdDevPct', v)}
      />
  </>
}
