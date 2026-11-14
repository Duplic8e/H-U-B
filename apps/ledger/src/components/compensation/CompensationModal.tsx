import React, { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCompensationStore, calcTotalComp } from '../../store/useCompensationStore'
import { useCompensationDisplay } from '../../hooks/useCompensationDisplay'
import type { VestingPreset, VestingFrequency, PastSalary, VestingSchedule, RSUGrant } from '../../store/useCompensationStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'
import { Sheet } from '../ui/Sheet'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { CompensationFormMobile } from './CompensationFormMobile'

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

interface CompensationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CompensationModal({ isOpen, onClose }: CompensationModalProps) {
  const { primaryPackage, setPrimaryPackage, addRSUGrant, updateRSUGrant, timeMode } = useCompensationStore()
  const { rawPrice, priceSource } = useCompensationDisplay()

  const isDesktop = useIsDesktop()
  const [activeTab, setActiveTab] = useState<'base' | 'equity' | 'benefits'>('base')

  // Global Stock Price
  const [companyCurrentPrice, setCompanyCurrentPrice] = useState(rawPrice || 100)
  const [companyTicker, setCompanyTicker] = useState(primaryPackage.companyTicker || '')

  // Re-seed from the live/override price each time the modal opens, so a
  // reopened modal reflects the price the top bar shows. Deliberately NOT
  // keyed on rawPrice: a live refresh must not clobber mid-edit typing.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setCompanyCurrentPrice(rawPrice || 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Base & Cash
  const [baseSalary, setBaseSalary] = useState(primaryPackage.baseSalary)
  const [pastSalaryChanges, setPastSalaryChanges] = useState<PastSalary[]>(
    primaryPackage.pastSalaryChanges?.length > 0
      ? primaryPackage.pastSalaryChanges
      : [{ id: crypto.randomUUID(), salary: 0, changeMonth: 0 }]
  )
  const [cashBonusPercent, setCashBonusPercent] = useState(primaryPackage.cashBonusPercent)
  const [cashBonusMonth, setCashBonusMonth] = useState((primaryPackage.cashBonusMonth || 12).toString())

  // Benefits
  const [esppContributionPercent, setEsppContributionPercent] = useState(primaryPackage.esppContributionPercent)
  const [esppDiscountPercent, setEsppDiscountPercent] = useState(primaryPackage.esppDiscountPercent || 15)
  const [esppLockedInPrice, setEsppLockedInPrice] = useState(primaryPackage.esppLockedInPrice || 100)
  const [esppLockInEndDate, setEsppLockInEndDate] = useState(primaryPackage.esppLockInEndDate || '')
  const [rrspMatchPercent, setRrspMatchPercent] = useState(primaryPackage.rrspMatchPercent)
  const [rrspMatchCap, setRrspMatchCap] = useState(primaryPackage.rrspMatchCap)

  // Equity (RSU)
  const [rsuGrantName, setRsuGrantName] = useState('')
  const [rsuGrantShares, setRsuGrantShares] = useState(0)
  const [rsuGrantPrice, setRsuGrantPrice] = useState(100)
  const [rsuStartDate, setRsuStartDate] = useState(new Date().toISOString().split('T')[0])
  const [rsuPreset, setRsuPreset] = useState<VestingPreset>('4yr-1yr-cliff')
  const [rsuTotalMonths, setRsuTotalMonths] = useState(48)
  const [rsuCliffMonths, setRsuCliffMonths] = useState(12)
  const [rsuFrequency, setRsuFrequency] = useState<VestingFrequency>('monthly')
  const [editRsuGrantId, setEditRsuGrantId] = useState<string | null>(null)

  const handleSaveRSU = () => {
    if (!rsuGrantName || !rsuGrantShares || !rsuGrantPrice) return

    const schedule: VestingSchedule = {
      preset: rsuPreset,
      totalVestMonths: rsuPreset === 'custom' ? rsuTotalMonths : (rsuPreset === '4yr-1yr-cliff' ? 48 : 36),
      cliffMonths: rsuPreset === 'custom' ? rsuCliffMonths : (rsuPreset === '4yr-1yr-cliff' ? 12 : 0),
      frequency: rsuFrequency
    }

    if (editRsuGrantId) {
      updateRSUGrant(editRsuGrantId, {
        grantName: rsuGrantName,
        grantShares: rsuGrantShares,
        grantPrice: rsuGrantPrice,
        grantStartDate: rsuStartDate,
        vestingSchedule: schedule
      })
      setEditRsuGrantId(null)
    } else {
      addRSUGrant({
        id: crypto.randomUUID(),
        grantName: rsuGrantName,
        grantShares: rsuGrantShares,
        grantPrice: rsuGrantPrice,
        grantStartDate: rsuStartDate,
        vestingSchedule: schedule
      })
    }

    setRsuGrantName('')
    setRsuGrantShares(0)
  }

  const handleEditRSU = (grant: RSUGrant) => {
    setEditRsuGrantId(grant.id)
    setRsuGrantName(grant.grantName)
    setRsuGrantShares(grant.grantShares)
    setRsuGrantPrice(grant.grantPrice)
    setRsuStartDate(grant.grantStartDate || new Date().toISOString().split('T')[0])
    setRsuPreset(grant.vestingSchedule.preset)
    setRsuTotalMonths(grant.vestingSchedule.totalVestMonths)
    setRsuCliffMonths(grant.vestingSchedule.cliffMonths)
    setRsuFrequency(grant.vestingSchedule.frequency)
  }

  const handleCancelEditRSU = () => {
    setEditRsuGrantId(null)
    setRsuGrantName('')
    setRsuGrantShares(0)
  }

  const addPastSalaryChange = () => {
    setPastSalaryChanges(prev => [...prev, { id: crypto.randomUUID(), salary: 0, changeMonth: 0 }])
  }

  const removePastSalaryChange = (id: string) => {
    setPastSalaryChanges(prev => prev.filter(p => p.id !== id))
  }

  const handlePastSalaryChange = (id: string, field: 'salary' | 'changeMonth', value: number) => {
    setPastSalaryChanges(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value }
      }
      return p
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    setPrimaryPackage({
      companyTicker: companyTicker.trim().toUpperCase(),
      companyCurrentPrice,
      baseSalary,
      pastSalaryChanges: pastSalaryChanges.filter(c => c.salary > 0 && c.changeMonth > 0),
      cashBonusPercent,
      cashBonusMonth: Number(cashBonusMonth) || 12,
      esppContributionPercent,
      esppDiscountPercent,
      esppLockedInPrice,
      esppLockInEndDate: esppLockInEndDate,
      rrspMatchPercent,
      rrspMatchCap,
    })

    onClose()
  }

  const inputClass = "w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
  const labelClass = "text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      desktop="modal"
      ariaLabel="Edit Compensation Package"
      // The phone form has its own pinned Save Compensation Package button, so no title row above it.
      panelClassName="w-full max-w-2xl bg-[var(--color-bg-primary)] desktop:rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col"
    >
      {!isDesktop && (
        <CompensationFormMobile
          ticker={companyTicker} setTicker={setCompanyTicker}
          price={companyCurrentPrice} setPrice={setCompanyCurrentPrice} priceHint={priceSource === 'live' || priceSource === 'cache'}
          base={baseSalary} setBase={setBaseSalary}
          changes={pastSalaryChanges} addChange={addPastSalaryChange} removeChange={removePastSalaryChange} setChange={handlePastSalaryChange}
          bonusPct={cashBonusPercent} setBonusPct={setCashBonusPercent} bonusMonth={cashBonusMonth} setBonusMonth={setCashBonusMonth}
          grants={primaryPackage.rsuGrants} removeGrant={(id) => useCompensationStore.getState().removeRSUGrant(id)} editGrant={handleEditRSU} editId={editRsuGrantId}
          gName={rsuGrantName} setGName={setRsuGrantName} gShares={rsuGrantShares} setGShares={setRsuGrantShares}
          gPrice={rsuGrantPrice} setGPrice={setRsuGrantPrice} gStart={rsuStartDate} setGStart={setRsuStartDate}
          preset={rsuPreset} setPreset={setRsuPreset} freq={rsuFrequency} setFreq={setRsuFrequency}
          totalM={rsuTotalMonths} setTotalM={setRsuTotalMonths} cliffM={rsuCliffMonths} setCliffM={setRsuCliffMonths}
          saveGrant={handleSaveRSU} cancelGrant={handleCancelEditRSU}
          esppPct={esppContributionPercent} setEsppPct={setEsppContributionPercent} esppDisc={esppDiscountPercent} setEsppDisc={setEsppDiscountPercent}
          esppLock={esppLockedInPrice} setEsppLock={setEsppLockedInPrice} esppLockEnd={esppLockInEndDate} setEsppLockEnd={setEsppLockInEndDate}
          rrspPct={rrspMatchPercent} setRrspPct={setRrspMatchPercent} rrspCap={rrspMatchCap} setRrspCap={setRrspMatchCap}
          onSubmit={handleSubmit}
          total={calcTotalComp({
            ...primaryPackage, companyCurrentPrice, baseSalary, pastSalaryChanges: pastSalaryChanges.filter((c) => c.salary > 0 && c.changeMonth > 0),
            cashBonusPercent, cashBonusMonth: Number(cashBonusMonth) || 12, esppContributionPercent, esppDiscountPercent, esppLockedInPrice,
            rrspMatchPercent, rrspMatchCap,
          }, timeMode)}
        />
      )}
      {isDesktop && (<>
          <div className="hidden desktop:flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-[18px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">Edit Compensation Package</h2>
            <button
              onClick={onClose}
              className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 border-b border-[var(--color-border)] flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="company-ticker-input">Ticker (optional, for live price)</label>
              <input
                id="company-ticker-input"
                type="text"
                value={companyTicker}
                onChange={(e) => setCompanyTicker(e.target.value)}
                placeholder="e.g. AAPL"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="company-price-input">Company Current Stock Price (USD)</label>
              <NumberInput
                id="company-price-input"
                value={companyCurrentPrice}
                onCommit={setCompanyCurrentPrice}
                maxDecimals={3}
                className={inputClass}
              />
              {(priceSource === 'live' || priceSource === 'cache') && (
                <p className="text-meta text-[var(--color-text-secondary)]">
                  Pre-filled from the live {companyTicker.trim().toUpperCase() || 'ticker'} price, edit to override.
                </p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex p-1 bg-[var(--color-border)] rounded-lg gap-1">
              <button
                type="button"
                className={`flex-1 py-1.5 text-[14px] font-medium rounded-md transition-all ${activeTab === 'base' ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => setActiveTab('base')}
              >
                Base & Cash
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-[14px] font-medium rounded-md transition-all ${activeTab === 'equity' ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => setActiveTab('equity')}
              >
                Equity
              </button>
              <button
                type="button"
                className={`flex-1 py-1.5 text-[14px] font-medium rounded-md transition-all ${activeTab === 'benefits' ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => setActiveTab('benefits')}
              >
                Benefits
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
            {activeTab === 'base' && (
              <div className="flex flex-col gap-4">

                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="base-salary-input">Current Base Salary ($)</label>
                  <NumberInput
                    id="base-salary-input"
                    value={baseSalary}
                    onCommit={setBaseSalary}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className={labelClass}>Past Salary Changes</span>
                    <button
                      type="button"
                      onClick={addPastSalaryChange}
                      className="flex items-center gap-1 text-[13px] text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                    >
                      <Plus size={14} /> Add Change
                    </button>
                  </div>
                  {pastSalaryChanges.map((change) => (
                    <div key={change.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border)]">
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]" htmlFor={`past-salary-amount-${change.id}`}>Previous Salary ($)</label>
                        <NumberInput
                          id={`past-salary-amount-${change.id}`}
                          value={change.salary}
                          onCommit={(n) => handlePastSalaryChange(change.id, 'salary', n)}
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]" htmlFor={`past-salary-month-${change.id}`}>Change Month</label>
                        <ThemedSelect
                          id={`past-salary-month-${change.id}`}
                          value={String(change.changeMonth ?? '')}
                          onChange={(v) => handlePastSalaryChange(change.id, 'changeMonth', Number(v) || 0)}
                          options={[{ value: '', label: 'None' }, ...MONTH_OPTIONS]}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePastSalaryChange(change.id)}
                        className="p-2 text-[var(--color-text-secondary)] hover:text-error transition-colors h-[38px] flex items-center justify-center border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-border)]">
                  <label className={labelClass} htmlFor="cash-bonus-percent-input">Cash Bonus (%)</label>
                  <NumberInput
                    id="cash-bonus-percent-input"
                    value={cashBonusPercent}
                    onCommit={setCashBonusPercent}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="cash-bonus-month-select">Bonus Payout Month</label>
                  <ThemedSelect
                    id="cash-bonus-month-select"
                    value={cashBonusMonth}
                    onChange={(v) => setCashBonusMonth(v)}
                    options={MONTH_OPTIONS}
                  />
                </div>
              </div>
            )}

            {activeTab === 'equity' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="rsu-grant-name-input">RSU Grant Name</label>
                  <input
                    id="rsu-grant-name-input"
                    type="text"
                    value={rsuGrantName}
                    onChange={(e) => setRsuGrantName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="rsu-grant-shares-input">Number of Shares</label>
                  <NumberInput
                    id="rsu-grant-shares-input"
                    value={rsuGrantShares}
                    onCommit={setRsuGrantShares}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="rsu-grant-price-input">Grant Price (USD)</label>
                    <NumberInput
                      id="rsu-grant-price-input"
                      value={rsuGrantPrice}
                      onCommit={setRsuGrantPrice}
                      maxDecimals={3}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="rsu-grant-start-date">Grant Start Date</label>
                    <ThemedDatePicker
                      id="rsu-grant-start-date"
                      value={rsuStartDate}
                      onChange={setRsuStartDate}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className={labelClass}>Vesting Schedule</span>
                    <div className="flex items-center gap-2">
                      <label className={labelClass} htmlFor="rsu-frequency-select">Frequency:</label>
                      <ThemedSelect
                        id="rsu-frequency-select"
                        value={rsuFrequency}
                        onChange={(v) => setRsuFrequency(v as VestingFrequency)}
                        className="text-[12px]"
                        options={[
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'quarterly', label: 'Quarterly' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRsuPreset('4yr-1yr-cliff')}
                      className={`min-h-[44px] px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${rsuPreset === '4yr-1yr-cliff' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      4-Year with 1-Year Cliff
                    </button>
                    <button
                      type="button"
                      onClick={() => setRsuPreset('3yr-no-cliff')}
                      className={`min-h-[44px] px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${rsuPreset === '3yr-no-cliff' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      3-Year, No Cliff
                    </button>
                    <button
                      type="button"
                      onClick={() => setRsuPreset('custom')}
                      className={`min-h-[44px] px-4 py-2 rounded-md text-[14px] font-medium transition-colors ${rsuPreset === 'custom' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      Custom Schedule
                    </button>
                  </div>
                </div>

                {rsuPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className={labelClass} htmlFor="rsu-total-months-input">Total Vest (months)</label>
                      <NumberInput
                        id="rsu-total-months-input"
                        value={rsuTotalMonths}
                        onCommit={setRsuTotalMonths}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className={labelClass} htmlFor="rsu-cliff-months-input">Cliff (months)</label>
                      <NumberInput
                        id="rsu-cliff-months-input"
                        value={rsuCliffMonths}
                        onCommit={setRsuCliffMonths}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleSaveRSU}
                    className="flex-1 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-[14px] font-medium hover:bg-[var(--color-bg-primary)] transition-colors"
                  >
                    {editRsuGrantId ? 'Update RSU Grant' : 'Add RSU Grant'}
                  </button>
                  {editRsuGrantId && (
                    <button
                      type="button"
                      onClick={handleCancelEditRSU}
                      className="px-4 py-2 bg-error/10 text-error border border-error/30 rounded-md text-[14px] font-medium hover:bg-error/20 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {primaryPackage.rsuGrants.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <span className={labelClass}>Current Grants</span>
                    <div className="flex flex-col gap-2">
                      {primaryPackage.rsuGrants.map(g => {
                        const shares = g.grantShares || 0;
                        return (
                          <div key={g.id} className="flex justify-between items-center p-2 bg-[var(--color-bg-secondary)] rounded-md border border-[var(--color-border)]">
                            <span className="text-[14px]">{g.grantName} ({shares.toLocaleString()} shares)</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditRSU(g)}
                                className="text-[12px] text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => useCompensationStore.getState().removeRSUGrant(g.id)}
                                className="text-[12px] text-error hover:opacity-80 transition-opacity"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'benefits' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="espp-contribution-input">ESPP Contribution (%)</label>
                    <NumberInput
                      id="espp-contribution-input"
                      value={esppContributionPercent}
                      onCommit={setEsppContributionPercent}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="espp-discount-input">ESPP Discount (%)</label>
                    <NumberInput
                      id="espp-discount-input"
                      value={esppDiscountPercent}
                      onCommit={setEsppDiscountPercent}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="espp-lockin-price-input">ESPP Lock-In Price (USD)</label>
                    <NumberInput
                      id="espp-lockin-price-input"
                      value={esppLockedInPrice}
                      onCommit={setEsppLockedInPrice}
                      maxDecimals={3}
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClass} htmlFor="espp-lockin-end-date">Lock-In End Date (Optional)</label>
                    <ThemedDatePicker
                      id="espp-lockin-end-date"
                      value={esppLockInEndDate}
                      onChange={setEsppLockInEndDate}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="rrsp-match-percent-input">RRSP Match (%)</label>
                  <NumberInput
                    id="rrsp-match-percent-input"
                    value={rrspMatchPercent}
                    onCommit={setRrspMatchPercent}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelClass} htmlFor="rrsp-match-cap-input">RRSP Match Cap ($)</label>
                  <NumberInput
                    id="rrsp-match-cap-input"
                    value={rrspMatchCap}
                    onCommit={setRrspMatchCap}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 mt-2 border-t border-[var(--color-border)]">
              <button
                type="submit"
                className="w-full py-3 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
              >
                Save Compensation Package
              </button>
            </div>
          </form>
      </>)}
    </Sheet>
  )
}
