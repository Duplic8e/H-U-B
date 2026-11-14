import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from './storageKeys'

export type VestingPreset = '4yr-1yr-cliff' | '3yr-no-cliff' | 'custom'
export type VestingFrequency = 'monthly' | 'quarterly'
export type TimeMode = 'current-year' | 'next-1-year'

export interface VestingSchedule {
  preset: VestingPreset
  totalVestMonths: number
  cliffMonths: number
  frequency: VestingFrequency
}

export interface RSUGrant {
  id: string
  grantName: string
  grantShares: number
  grantPrice: number
  vestingSchedule: VestingSchedule
  grantStartDate: string
}

export interface PastSalary {
  id: string;
  salary: number;
  changeMonth: number;
}

export interface CompensationPackage {
  id: string
  name: string
  companyTicker?: string
  companyCurrentPrice: number
  baseSalary: number
  pastSalaryChanges: PastSalary[]
  cashBonusPercent: number
  cashBonusMonth: number
  esppContributionPercent: number
  esppDiscountPercent: number
  esppLockedInPrice: number
  esppLockInEndDate?: string
  /** The day this offering period started (the enrollment date). */
  esppEnrollmentDate?: string
  /** How long the offering period runs, in months (24 for a two-year lookback). */
  esppOfferingMonths?: number
  /** The share price at enrollment that the lookback compares against. */
  esppLookbackPrice?: number
  rrspMatchPercent: number
  rrspMatchCap: number
  rsuGrants: RSUGrant[]
}

export interface VestEvent {
  monthIndex: number
  date?: string
  label: string
  vestValue: number
  cumulativeVested: number
}

export function getBaseSalaryForMonth(pkg: CompensationPackage, year: number, monthIndex: number): number {
  const currentYear = new Date().getFullYear();
  if (year > currentYear) return pkg.baseSalary;
  
  const changes = (pkg.pastSalaryChanges || [])
    .filter(c => c.salary > 0 && c.changeMonth >= 1 && c.changeMonth <= 12)
    .sort((a, b) => a.changeMonth - b.changeMonth);
    
  if (changes.length === 0) return pkg.baseSalary;

  if (year < currentYear) {
    return changes[0].salary;
  }

  // Current year
  for (const change of changes) {
    if (monthIndex < change.changeMonth - 1) {
      return change.salary;
    }
  }
  
  return pkg.baseSalary;
}

export function calcAnnualBaseSalary(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  if (timeMode === 'next-1-year') {
    return pkg.baseSalary;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  
  let totalBase = 0;
  for (let i = 0; i < 12; i++) {
    totalBase += getBaseSalaryForMonth(pkg, currentYear, i) / 12;
  }
  return totalBase;
}

export function calcAnnualBonus(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  return calcAnnualBaseSalary(pkg, timeMode) * (pkg.cashBonusPercent / 100)
}

export function calcAnnualESPP(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  const companyCurrentPrice = pkg.companyCurrentPrice || 0;
  const esppLockedInPrice = pkg.esppLockedInPrice || 0;

  if (pkg.esppContributionPercent === 0 || companyCurrentPrice === 0) return 0;
  const contributionAmount = calcAnnualBaseSalary(pkg, timeMode) * (pkg.esppContributionPercent / 100);
  
  const today = new Date();
  const isLockInActive = esppLockedInPrice > 0 && (!pkg.esppLockInEndDate || new Date(pkg.esppLockInEndDate) >= today);

  const purchasePrice = isLockInActive
    ? esppLockedInPrice
    : companyCurrentPrice * (1 - (pkg.esppDiscountPercent / 100));

  if (purchasePrice <= 0) return 0;
  const sharesBought = contributionAmount / purchasePrice;
  const currentValue = sharesBought * companyCurrentPrice;
  return Math.max(0, currentValue - contributionAmount);
}

/** ISO date `months` after `start`, or undefined when either is missing. */
export function esppOfferingEnd(start: string | undefined, months: number | undefined): string | undefined {
  if (!start || !months || months <= 0) return undefined
  const [y, m, d] = start.split('-').map(Number)
  if (!y || !m || !d) return undefined
  const end = new Date(Date.UTC(y, m - 1 + months, d))
  return end.toISOString().slice(0, 10)
}

export interface EsppSummary {
  /** Contribution per year, taken from pay. */
  annualContribution: number
  /** The price shares are bought at: the locked price while it holds, else today's price less the discount. */
  purchasePrice: number
  /** What the plan terms alone would give: the lower of lookback and current price, less the discount. */
  expectedPurchasePrice: number
  offeringEnd?: string
  /** Whole months left in the offering period; 0 once it has ended. */
  monthsLeft?: number
  sharesPerYear: number
  /** Value of a year's shares at today's price, less what was paid for them. */
  annualGain: number
}

export function esppSummary(pkg: CompensationPackage, today: Date = new Date()): EsppSummary {
  const price = pkg.companyCurrentPrice || 0
  const discount = (pkg.esppDiscountPercent || 0) / 100
  const annualContribution = (pkg.baseSalary || 0) * ((pkg.esppContributionPercent || 0) / 100)
  const lookback = pkg.esppLookbackPrice || 0
  const reference = lookback > 0 && price > 0 ? Math.min(lookback, price) : lookback || price
  const expectedPurchasePrice = reference * (1 - discount)
  const offeringEnd = esppOfferingEnd(pkg.esppEnrollmentDate, pkg.esppOfferingMonths) ?? pkg.esppLockInEndDate
  const locked = pkg.esppLockedInPrice || 0
  const lockActive = locked > 0 && (!offeringEnd || new Date(`${offeringEnd}T23:59:59`) >= today)
  const purchasePrice = lockActive ? locked : price * (1 - discount)
  let monthsLeft: number | undefined
  if (offeringEnd) {
    const end = new Date(`${offeringEnd}T00:00:00`)
    monthsLeft = Math.max(0, (end.getFullYear() - today.getFullYear()) * 12 + end.getMonth() - today.getMonth() - (end.getDate() < today.getDate() ? 1 : 0))
  }
  const sharesPerYear = purchasePrice > 0 ? annualContribution / purchasePrice : 0
  return {
    annualContribution, purchasePrice, expectedPurchasePrice, offeringEnd, monthsLeft, sharesPerYear,
    annualGain: Math.max(0, sharesPerYear * price - annualContribution),
  }
}

export function calcAnnualRRSP(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  return Math.min(calcAnnualBaseSalary(pkg, timeMode) * (pkg.rrspMatchPercent / 100), pkg.rrspMatchCap)
}

export function calcAnnualRSU(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  const companyCurrentPrice = pkg.companyCurrentPrice || 0;
  const today = new Date();
  
  return pkg.rsuGrants.reduce((total, grant) => {
    const events = generateVestEvents(grant, companyCurrentPrice)
    
    const filteredEvents = events.filter((e) => {
      if (!e.date) return e.monthIndex <= 12; // Fallback if date is missing
      
      const eventDate = new Date(e.date);
      if (timeMode === 'current-year') {
        return eventDate.getFullYear() === today.getFullYear();
      } else {
        const nextYear = new Date(today);
        nextYear.setFullYear(today.getFullYear() + 1);
        return eventDate >= today && eventDate <= nextYear;
      }
    });
    
    return total + filteredEvents.reduce((sum, e) => sum + e.vestValue, 0)
  }, 0)
}

export function calcTotalComp(pkg: CompensationPackage, timeMode: TimeMode = 'current-year'): number {
  return (
    calcAnnualBaseSalary(pkg, timeMode) +
    calcAnnualBonus(pkg, timeMode) +
    calcAnnualESPP(pkg, timeMode) +
    calcAnnualRRSP(pkg, timeMode) +
    calcAnnualRSU(pkg, timeMode)
  )
}

export function generateVestEvents(grant: RSUGrant, currentPrice: number): VestEvent[] {
  const { grantShares, vestingSchedule: sched, grantStartDate } = grant
  const { totalVestMonths, cliffMonths, frequency } = sched

  const totalShares = grantShares || 0;
  const safeCurrentPrice = currentPrice || 0;
  
  const startDate = grantStartDate ? new Date(grantStartDate) : new Date();

  const freqMonths = frequency === 'quarterly' ? 3 : 1
  const events: VestEvent[] = []
  let cumulativeShares = 0

  if (cliffMonths > 0) {
    const cliffPct = cliffMonths / totalVestMonths
    const cliffShares = totalShares * cliffPct
    cumulativeShares += cliffShares
    
    const eventDate = new Date(startDate);
    eventDate.setMonth(startDate.getMonth() + cliffMonths);
    
    events.push({
      monthIndex: cliffMonths,
      date: eventDate.toISOString(),
      label: `Month ${cliffMonths} (Cliff)`,
      vestValue: cliffShares * safeCurrentPrice,
      cumulativeVested: cumulativeShares * safeCurrentPrice,
    })
  }

  const postCliffMonths = totalVestMonths - cliffMonths
  const postCliffShares =
    cliffMonths > 0
      ? totalShares * ((totalVestMonths - cliffMonths) / totalVestMonths)
      : totalShares
  const vestCountPostCliff = Math.floor(postCliffMonths / freqMonths)
  const perEventShares = vestCountPostCliff > 0 ? postCliffShares / vestCountPostCliff : 0

  for (let m = cliffMonths + freqMonths; m <= totalVestMonths; m += freqMonths) {
    cumulativeShares += perEventShares
    
    const eventDate = new Date(startDate);
    eventDate.setMonth(startDate.getMonth() + m);
    
    events.push({
      monthIndex: m,
      date: eventDate.toISOString(),
      label: `Month ${m}`,
      vestValue: perEventShares * safeCurrentPrice,
      cumulativeVested: cumulativeShares * safeCurrentPrice,
    })
  }

  return events
}

interface CompensationState {
  primaryPackage: CompensationPackage
  comparePackage: CompensationPackage | null
  compareMode: boolean
  timeMode: TimeMode
  useCadConversion: boolean
  showAfterTax: boolean

  setPrimaryPackage: (updates: Partial<CompensationPackage>) => void
  setComparePackage: (pkg: CompensationPackage | null) => void
  toggleCompareMode: () => void
  setTimeMode: (mode: TimeMode) => void
  addRSUGrant: (grant: RSUGrant) => void
  removeRSUGrant: (id: string) => void
  updateRSUGrant: (id: string, updates: Partial<RSUGrant>) => void
  toggleCadConversion: () => void
  toggleAfterTax: () => void
}

export const defaultPrimaryPackage: CompensationPackage = {
  id: 'primary',
  name: 'Current Offer',
  companyCurrentPrice: 100,
  baseSalary: 0,
  pastSalaryChanges: [],
  cashBonusPercent: 0,
  cashBonusMonth: 12,
  esppContributionPercent: 0,
  esppDiscountPercent: 15,
  esppLockedInPrice: 100,
  rrspMatchPercent: 0,
  rrspMatchCap: 0,
  rsuGrants: [],
}

export const useCompensationStore = create<CompensationState>()(
  persist(
    (set) => ({
      primaryPackage: defaultPrimaryPackage,
      comparePackage: null,
      compareMode: false,
      timeMode: 'current-year',
      useCadConversion: false,
      showAfterTax: false,

      setPrimaryPackage: (updates) =>
        set((state) => ({
          primaryPackage: { ...state.primaryPackage, ...updates },
        })),
      setComparePackage: (pkg) => set({ comparePackage: pkg }),
      toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),
      setTimeMode: (mode) => set({ timeMode: mode }),
      toggleCadConversion: () => set((state) => ({ useCadConversion: !state.useCadConversion })),
      toggleAfterTax: () => set((state) => ({ showAfterTax: !state.showAfterTax })),
      addRSUGrant: (grant) =>
        set((state) => ({
          primaryPackage: {
            ...state.primaryPackage,
            rsuGrants: [...state.primaryPackage.rsuGrants, grant],
          },
        })),
      removeRSUGrant: (id) =>
        set((state) => ({
          primaryPackage: {
            ...state.primaryPackage,
            rsuGrants: state.primaryPackage.rsuGrants.filter((g) => g.id !== id),
          },
        })),
      updateRSUGrant: (id, updates) =>
        set((state) => ({
          primaryPackage: {
            ...state.primaryPackage,
            rsuGrants: state.primaryPackage.rsuGrants.map((g) =>
              g.id === id ? { ...g, ...updates } : g
            ),
          },
        })),
    }),
    {
      name: STORAGE_KEYS.compensation,
      version: 1,
      // Existing installs wrote version 0 with this exact shape, so v0 to v1
      // is an identity migration. It exists so the next schema change has a
      // hook instead of a silent reinterpretation of whatever is on disk.
      migrate: (persisted: unknown) => persisted,
    }
  )
)
