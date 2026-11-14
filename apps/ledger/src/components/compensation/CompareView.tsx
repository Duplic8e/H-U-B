import { useState } from 'react'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import {
  useCompensationStore,
  calcTotalComp,
  calcAnnualBaseSalary,
  calcAnnualBonus,
  calcAnnualESPP,
  calcAnnualRRSP,
  calcAnnualRSU
} from '../../store/useCompensationStore'
import type { RSUGrant, VestingSchedule, VestingPreset, VestingFrequency } from '../../store/useCompensationStore'
import { ThemedSelect } from '../ui/ThemedSelect'
import { ThemedDatePicker } from '../ui/ThemedDatePicker'
import { NumberInput } from '../ui/NumberInput'

const MONTH_OPTIONS = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

export function CompareView() {
  const { primaryPackage, comparePackage, setComparePackage, timeMode } = useCompensationStore()

  const [compareName] = useState('Compare Offer')
  const [compareBaseSalary, setCompareBaseSalary] = useState(0)
  const [compareCompanyCurrentPrice, setCompareCompanyCurrentPrice] = useState(100)
  const [compareCashBonusPercent, setCompareCashBonusPercent] = useState(0)
  const [compareCashBonusMonth, setCompareCashBonusMonth] = useState('12')
  const [compareEsppContributionPercent, setCompareEsppContributionPercent] = useState(0)
  const [compareEsppDiscountPercent, setCompareEsppDiscountPercent] = useState(15)
  const [compareEsppLockedInPrice, setCompareEsppLockedInPrice] = useState(100)
  const [compareEsppLockInEndDate, setCompareEsppLockInEndDate] = useState('')
  const [compareRrspMatchPercent, setCompareRrspMatchPercent] = useState(0)
  const [compareRrspMatchCap, setCompareRrspMatchCap] = useState(0)

  // RSU / Equity grants for the compare offer
  const [compareRsuGrants, setCompareRsuGrants] = useState<RSUGrant[]>([])
  const [rsuGrantName, setRsuGrantName] = useState('')
  const [rsuGrantShares, setRsuGrantShares] = useState(0)
  const [rsuGrantPrice, setRsuGrantPrice] = useState(100)
  const [rsuStartDate, setRsuStartDate] = useState(new Date().toISOString().split('T')[0])
  const [rsuPreset, setRsuPreset] = useState<VestingPreset>('4yr-1yr-cliff')
  const [rsuTotalMonths, setRsuTotalMonths] = useState(48)
  const [rsuCliffMonths, setRsuCliffMonths] = useState(12)
  const [rsuFrequency, setRsuFrequency] = useState<VestingFrequency>('monthly')

  const addCompareRsuGrant = () => {
    if (!rsuGrantName || !rsuGrantShares || !rsuGrantPrice) return

    const vestingSchedule: VestingSchedule = {
      preset: rsuPreset,
      totalVestMonths: rsuPreset === 'custom' ? rsuTotalMonths : (rsuPreset === '4yr-1yr-cliff' ? 48 : 36),
      cliffMonths: rsuPreset === 'custom' ? rsuCliffMonths : (rsuPreset === '4yr-1yr-cliff' ? 12 : 0),
      frequency: rsuFrequency
    }

    setCompareRsuGrants(prev => [...prev, {
      id: crypto.randomUUID(),
      grantName: rsuGrantName,
      grantShares: rsuGrantShares,
      grantPrice: rsuGrantPrice,
      grantStartDate: rsuStartDate,
      vestingSchedule
    }])

    setRsuGrantName('')
    setRsuGrantShares(0)
  }

  const removeCompareRsuGrant = (id: string) => {
    setCompareRsuGrants(prev => prev.filter(g => g.id !== id))
  }

  const handleCalculate = () => {
    setComparePackage({
      id: 'compare',
      name: compareName,
      companyCurrentPrice: compareCompanyCurrentPrice,
      baseSalary: compareBaseSalary,
      pastSalaryChanges: [],
      cashBonusPercent: compareCashBonusPercent,
      cashBonusMonth: Number(compareCashBonusMonth) || 12,
      esppContributionPercent: compareEsppContributionPercent,
      esppDiscountPercent: compareEsppDiscountPercent,
      esppLockedInPrice: compareEsppLockedInPrice,
      esppLockInEndDate: compareEsppLockInEndDate,
      rrspMatchPercent: compareRrspMatchPercent,
      rrspMatchCap: compareRrspMatchCap,
      rsuGrants: compareRsuGrants
    })
  }

  const inputClass = "w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md p-2 text-[14px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
  const labelClass = "text-[12px] font-medium leading-none text-[var(--color-text-secondary)]"




  return (
    <WidgetWrapper title="Offer Comparison">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Input Form */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <h3 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Compare Another Offer</h3>
          
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-3 mb-1">
              <label className={labelClass}>Company Stock Price ($)</label>
              <NumberInput value={compareCompanyCurrentPrice} onCommit={setCompareCompanyCurrentPrice} maxDecimals={3} className={inputClass} />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass}>Base Salary ($)</label>
              <NumberInput value={compareBaseSalary} onCommit={setCompareBaseSalary} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Cash Bonus (%)</label>
                <NumberInput value={compareCashBonusPercent} onCommit={setCompareCashBonusPercent} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Bonus Month</label>
                <ThemedSelect value={compareCashBonusMonth} onChange={setCompareCashBonusMonth} options={MONTH_OPTIONS} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>ESPP (%)</label>
                <NumberInput value={compareEsppContributionPercent} onCommit={setCompareEsppContributionPercent} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Discount (%)</label>
                <NumberInput value={compareEsppDiscountPercent} onCommit={setCompareEsppDiscountPercent} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Lock-In Price ($)</label>
                <NumberInput value={compareEsppLockedInPrice} onCommit={setCompareEsppLockedInPrice} maxDecimals={3} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Lock-In End Date</label>
                <ThemedDatePicker value={compareEsppLockInEndDate} onChange={setCompareEsppLockInEndDate} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>RRSP Match (%)</label>
                <NumberInput value={compareRrspMatchPercent} onCommit={setCompareRrspMatchPercent} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Match Cap ($)</label>
                <NumberInput value={compareRrspMatchCap} onCommit={setCompareRrspMatchCap} className={inputClass} />
              </div>
            </div>

            {/* RSU / Equity Grant */}
            <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-[var(--color-border)]">
              <label className={labelClass}>RSU / Equity Grant</label>

              <div className="flex flex-col gap-1">
                <label className={labelClass}>Grant Name</label>
                <input type="text" value={rsuGrantName} onChange={(e) => setRsuGrantName(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>Number of Shares</label>
                <NumberInput value={rsuGrantShares} onCommit={setRsuGrantShares} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Grant Price ($)</label>
                  <NumberInput value={rsuGrantPrice} onCommit={setRsuGrantPrice} maxDecimals={3} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Grant Start Date</label>
                  <ThemedDatePicker value={rsuStartDate} onChange={setRsuStartDate} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Vesting</label>
                  <ThemedSelect
                    value={rsuPreset}
                    onChange={(v) => setRsuPreset(v as VestingPreset)}
                    options={[
                      { value: '4yr-1yr-cliff', label: '4yr / 1yr Cliff' },
                      { value: '3yr-no-cliff', label: '3yr / No Cliff' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass}>Frequency</label>
                  <ThemedSelect
                    value={rsuFrequency}
                    onChange={(v) => setRsuFrequency(v as VestingFrequency)}
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly' },
                    ]}
                  />
                </div>
              </div>
              {rsuPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Total Vest (months)</label>
                    <NumberInput value={rsuTotalMonths} onCommit={setRsuTotalMonths} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelClass}>Cliff (months)</label>
                    <NumberInput value={rsuCliffMonths} onCommit={setRsuCliffMonths} className={inputClass} />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={addCompareRsuGrant}
                className="w-full py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md text-[14px] font-medium hover:bg-[var(--color-bg-primary)] transition-colors"
              >
                Add Grant
              </button>

              {compareRsuGrants.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {compareRsuGrants.map(grant => (
                    <div key={grant.id} className="flex justify-between items-center p-2 bg-[var(--color-bg-secondary)] rounded-md border border-[var(--color-border)]">
                      <span className="text-[14px] text-[var(--color-text-primary)]">{grant.grantName} ({grant.grantShares.toLocaleString()} shares)</span>
                      <button
                        type="button"
                        onClick={() => removeCompareRsuGrant(grant.id)}
                        className="text-[12px] text-error hover:opacity-80 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCalculate}
              className="mt-2 w-full py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity"
            >
              Calculate Comparison
            </button>
          </div>
        </div>

        {/* Delta List */}
        {comparePackage && (
          <div className="w-full lg:w-2/3 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-[var(--color-border)] pt-4 lg:pt-0 lg:pl-8">
            <h3 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Offer Comparison</h3>
            
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center py-2 border-b-2 border-[var(--color-border)] mb-2">
                <div className="w-1/4"></div>
                <div className="w-1/4 text-center">
                  <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Current Offer</span>
                </div>
                <div className="w-1/4 text-center">
                  <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Compare Offer</span>
                </div>
                <div className="w-1/4 text-right">
                  <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Delta</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                <div className="w-1/4"><span className="text-[14px] text-[var(--color-text-secondary)]">Base Salary</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualBaseSalary(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualBaseSalary(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcAnnualBaseSalary(comparePackage, timeMode) - calcAnnualBaseSalary(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                <div className="w-1/4"><span className="text-[14px] text-[var(--color-text-secondary)]">Annual Bonus</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualBonus(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualBonus(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcAnnualBonus(comparePackage, timeMode) - calcAnnualBonus(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                <div className="w-1/4"><span className="text-[14px] text-[var(--color-text-secondary)]">ESPP Benefit</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualESPP(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualESPP(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcAnnualESPP(comparePackage, timeMode) - calcAnnualESPP(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                <div className="w-1/4"><span className="text-[14px] text-[var(--color-text-secondary)]">RRSP Match</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualRRSP(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualRRSP(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcAnnualRRSP(comparePackage, timeMode) - calcAnnualRRSP(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-[var(--color-border)]">
                <div className="w-1/4"><span className="text-[14px] text-[var(--color-text-secondary)]">RSU (Annual)</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualRSU(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] text-[var(--color-text-primary)]">${calcAnnualRSU(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcAnnualRSU(comparePackage, timeMode) - calcAnnualRSU(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3">
                <div className="w-1/4"><span className="text-[14px] font-semibold text-[var(--color-text-primary)]">Total Compensation</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] font-bold text-[var(--color-text-primary)]">${calcTotalComp(primaryPackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 text-center"><span className="text-[14px] font-bold text-[var(--color-text-primary)]">${calcTotalComp(comparePackage, timeMode).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="w-1/4 flex justify-end">
                  <span className={calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode) > 0 ? "text-accent bg-accent/10 px-2 py-0.5 rounded text-[12px] font-medium" : calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode) < 0 ? "text-error bg-error/10 px-2 py-0.5 rounded text-[12px] font-medium" : "text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded text-[12px] font-medium"}>
                    {calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode) > 0 ? `+$${Math.abs(calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} more` : calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode) < 0 ? `−$${Math.abs(calcTotalComp(comparePackage, timeMode) - calcTotalComp(primaryPackage, timeMode)).toLocaleString(undefined, { maximumFractionDigits: 0 })} less` : "Equivalent"}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
