import React, { useState } from 'react'
import { Pencil, Plus, RefreshCw } from 'lucide-react'
import { PageHeader, TopBarAction } from '../components/ui/PageHeader'
import { CompHeroWidget } from '../components/compensation/CompHeroWidget'
import { CompensationModal } from '../components/compensation/CompensationModal'
import { EquityVestingWidget } from '../components/compensation/EquityVestingWidget'
import { EsppCard } from '../components/compensation/EsppCard'
import { CompareView } from '../components/compensation/CompareView'
import { useCompensationStore, calcTotalComp, calcAnnualBaseSalary } from '../store/useCompensationStore'
import { useCompensationDisplay } from '../hooks/useCompensationDisplay'
import { NumberInput } from '../components/ui/NumberInput'
import { fxKey, todayKey } from '../services/marketData'
import { useMarketDataStore } from '../store/useMarketDataStore'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { CompensationMobile } from '../components/compensation/CompensationMobile'

export const Compensation: React.FC = () => {
  const { setPrimaryPackage, compareMode, toggleCompareMode, timeMode, useCadConversion, toggleCadConversion } =
    useCompensationStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [manualPriceDraft, setManualPriceDraft] = useState(0)

  const {
    pkg,
    rawPrice,
    fxRate,
    fxStatus,
    fxAvailable,
    fxDate,
    fxSource,
    fxStale,
    priceStatus,
    priceSource,
    priceStale,
    refreshPrice,
    setManualPrice,
    clearManualPrice,
  } = useCompensationDisplay()

  const fxOverrideKey = fxKey('USD', 'CAD', todayKey())
  const fxOverride = useMarketDataStore((s) => s.overrides[fxOverrideKey])
  const setOverride = useMarketDataStore((s) => s.setOverride)
  const clearOverride = useMarketDataStore((s) => s.clearOverride)

  const isDesktop = useIsDesktop()
  const totalComp = calcTotalComp(pkg, timeMode)
  const isPopulated = totalComp > 0

  const handleManualPriceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualPriceDraft > 0) {
      setManualPrice(manualPriceDraft)
      setManualPriceDraft(0)
    }
  }

  // Desktop only: a phone shows the populated page through CompensationMobile, which has its own
  // price card, so this toolbar never competes with the total for the top of the screen.
  const priceToolbar = isPopulated && (
    <div className="themed-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[13px] text-[var(--color-text-secondary)]">
          Stock price (USD): <span className="font-medium text-[var(--color-text-primary)]">${rawPrice.toFixed(2)}</span>
          {priceSource && <span className="ml-1 text-meta uppercase text-[var(--color-text-secondary)]">({priceSource}{priceStale ? ', stale' : ''})</span>}
        </span>
        <button
          type="button"
          onClick={() => priceSource === 'override' ? clearManualPrice() : refreshPrice(true)}
          aria-label="Refresh price"
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-bg-secondary)] border control-border rounded-md text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors"
        >
          <RefreshCw size={14} className={priceStatus === 'loading' ? 'animate-spin' : ''} />
          Refresh Price
        </button>
        {priceStatus === 'error' && (
          <span role="alert" className="text-[12px] text-[var(--color-error)]">
            Live price unavailable. Try again or enter a manual price.
          </span>
        )}
        <form onSubmit={handleManualPriceSubmit} className="flex items-center gap-1">
          <label htmlFor="comp-manual-price" className="sr-only">
            Set stock price manually, in USD
          </label>
          <NumberInput
            id="comp-manual-price"
            value={manualPriceDraft}
            onCommit={setManualPriceDraft}
            placeholder="Manual price"
            className="w-28 bg-[var(--color-bg-secondary)] border control-border rounded-md px-2 py-1 text-[12px] text-[var(--color-text-primary)] transition-colors"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-[var(--color-bg-secondary)] border control-border rounded-md text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors"
          >
            Set
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggleCadConversion}
          aria-pressed={useCadConversion}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
            useCadConversion
              ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-[var(--color-accent)]'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] control-border hover:text-[var(--color-text-primary)]'
          }`}
        >
          Convert to CAD
          {useCadConversion && (
            <span className="ml-1 font-normal">
              {fxAvailable
                ? `(1 USD = ${fxRate.toFixed(4)} CAD${
                    fxSource === 'override' ? ', manual' : fxStale && fxDate ? `, as of ${fxDate}` : ''
                  }${fxStatus === 'loading' ? ', updating' : ''})`
                : '(rate unavailable, set a manual rate)'}
            </span>
          )}
        </button>

        {useCadConversion && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
              Manual rate
              <NumberInput
                value={fxOverride ?? 0}
                placeholder={fxAvailable ? fxRate.toFixed(4) : '1.3700'}
                onCommit={(v) => { if (v > 0) setOverride(fxOverrideKey, v) }}
                className="w-24 bg-[var(--color-bg-secondary)] border control-border rounded-md px-2 py-1 text-[12px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            {fxOverride !== undefined && (
              <button
                onClick={() => clearOverride(fxOverrideKey)}
                className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              >
                Use live
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 w-full min-h-full animate-fade-in">
      <PageHeader
        title="Compensation"
        subtitle="Analyze your base salary, bonuses, equity, and benefits to understand your true earning potential."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            {isPopulated ? 'Edit Package' : 'Add Compensation Package'}
          </button>
        }
        phoneAction={
          <TopBarAction
            icon={isPopulated ? Pencil : Plus}
            label={isPopulated ? 'Edit Package' : 'Add Compensation Package'}
            onClick={() => setIsModalOpen(true)}
          />
        }
      />

      {!isDesktop && isPopulated && (
        <CompensationMobile
          equity={<><EsppCard /><EquityVestingWidget /></>}
          compare={
            <>
              <button
                id="compare-toggle-btn"
                onClick={toggleCompareMode}
                className="min-h-[44px] px-4 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-xl text-[14px] font-medium"
              >
                Compare Another Offer
              </button>
              {compareMode && <CompareView />}
            </>
          }
        />
      )}
      {(isDesktop || !isPopulated) && (<>
        {isDesktop && priceToolbar}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CompHeroWidget className="h-full" />
          </div>

          <div className="themed-card rounded-xl p-6 flex flex-col gap-4">
            <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Package Details</h2>
            {isPopulated ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                  <label htmlFor="comp-stock-price" className="text-[14px] text-[var(--color-text-secondary)]">
                    Current Stock Price {useCadConversion ? '(CAD)' : '(USD)'}
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[14px] font-medium text-[var(--color-text-primary)]">$</span>
                    <NumberInput
                      id="comp-stock-price"
                      value={pkg.companyCurrentPrice ?? 0}
                      onCommit={(n) => setPrimaryPackage({ companyCurrentPrice: n })}
                      maxDecimals={3}
                      disabled={useCadConversion}
                      className="w-28 bg-[var(--color-bg-primary)] border control-border rounded-md px-2 py-1 text-[14px] font-medium text-[var(--color-text-primary)] text-right transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                  <span className="text-[14px] text-[var(--color-text-secondary)]">
                    {timeMode === 'current-year' ? 'Blended Base Salary' : 'Current Base Salary'}
                  </span>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    ${calcAnnualBaseSalary(pkg, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                  <span className="text-[14px] text-[var(--color-text-secondary)]">Target Bonus</span>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    {pkg.cashBonusPercent}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                  <span className="text-[14px] text-[var(--color-text-secondary)]">RSU Grants</span>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    {pkg.rsuGrants.length} Active
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-[14px] text-[var(--color-text-secondary)]">Benefits Match</span>
                  <span className="text-[14px] font-medium text-[var(--color-text-primary)]">
                    {pkg.rrspMatchPercent}% RRSP, {pkg.esppContributionPercent}% ESPP
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <p className="text-[14px] text-[var(--color-text-secondary)] mb-4">
                  No compensation data added yet. Start by adding your current offer or current package.
                </p>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
                >
                  Add Compensation Package
                </button>
              </div>
            )}
          </div>
        </div>

        {isPopulated && (
          <>
            <EsppCard />
            <EquityVestingWidget />

            <div className="flex justify-end">
              <button
                id="compare-toggle-btn"
                onClick={toggleCompareMode}
                className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
              >
                Compare Another Offer
              </button>
            </div>

            {compareMode && <CompareView />}
          </>
        )}
      </>)}

      <CompensationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
