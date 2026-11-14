import type { Account, AccountType, NetWorthSnapshot } from '../../store/useAccountsStore'

export interface AccountValuation {
  cadById: Record<string, number | null>
  totals: Record<AccountType, number | null>
  netWorth: number | null
}

export function valueAccounts(accounts: readonly Account[], usdCadRate?: number): AccountValuation {
  const totals: AccountValuation['totals'] = { bank: 0, investment: 0, debt: 0, receivable: 0, other: 0 }
  const cadById: AccountValuation['cadById'] = {}
  const validRate = usdCadRate !== undefined && Number.isFinite(usdCadRate) && usdCadRate > 0
  for (const account of accounts) {
    const cad = account.currency === 'CAD' ? account.value : validRate ? account.value * usdCadRate! : null
    cadById[account.id] = cad
    const subtotal = totals[account.type]
    totals[account.type] = subtotal === null || cad === null ? null : subtotal + cad
  }
  const complete = Object.values(totals).every((value) => value !== null)
  const netWorth = complete
    ? totals.bank! + totals.investment! + totals.receivable! + totals.other! - totals.debt!
    : null
  return { cadById, totals, netWorth }
}

export function netWorthTrend(current: number | null, history: readonly NetWorthSnapshot[], now = new Date()): number | null {
  if (current === null) return null
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const endOfLastMonth = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`
  const pastSnapshot = history
    .filter((snapshot) => snapshot.date <= endOfLastMonth)
    .reduce<NetWorthSnapshot | null>((latest, snapshot) => !latest || snapshot.date > latest.date ? snapshot : latest, null)
  if (!pastSnapshot || pastSnapshot.value === 0) return 0
  return ((current - pastSnapshot.value) / pastSnapshot.value) * 100
}
