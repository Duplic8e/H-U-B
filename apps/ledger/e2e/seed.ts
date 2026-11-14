import type { Page } from '@playwright/test'

/** One realistic dataset shared by every desktop guard, so a guard that only
 *  passes on an empty app cannot exist. Long account names are deliberate:
 *  they are what exposed the tablet row collapse. */
export async function seedApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ls = window.localStorage
    ls.setItem('ledger-disclaimer-ack', new Date().toISOString())

    ls.setItem('accounts-storage', JSON.stringify({
      state: {
        accounts: [
          { id: 'a1', name: 'Main Checking', value: 15230.44, type: 'bank', currency: 'CAD' },
          { id: 'a2', name: 'EQ Bank High Interest Savings', value: 48210, type: 'bank', currency: 'CAD' },
          { id: 'a3', name: 'Questrade TFSA', value: 96430.12, type: 'investment', currency: 'CAD' },
          { id: 'a4', name: 'Mortgage - 12 Maplewood Crescent', value: 412500, type: 'debt', currency: 'CAD' },
        ],
        history: [],
        pendingCurrencyReviewIds: [],
        currencySupportStartedAt: new Date().toISOString().slice(0, 10),
        pendingEditSnapshotDate: null,
      },
    }))

    const holding = (ticker: string, quantity: number, avgCost: number, currency: string) =>
      ({ id: ticker, ticker, quantity, avgCost, currency, account: 'Questrade TFSA' })
    // Fifteen more tickers on top of the original two, so the stacked
    // allocation bar's "By holding" cut genuinely has to lay out 17
    // segments instead of two. Real large-cap tickers, no significance to
    // the choice beyond being distinct and recognizable.
    ls.setItem('ledger-portfolio', JSON.stringify({
      state: {
        holdings: [
          holding('VFV', 210, 98.4, 'CAD'),
          holding('AAPL', 60, 171.2, 'USD'),
          holding('MSFT', 40, 310.1, 'USD'),
          holding('GOOGL', 35, 128.7, 'USD'),
          holding('AMZN', 25, 142.3, 'USD'),
          holding('TSLA', 18, 210.9, 'USD'),
          holding('NVDA', 30, 410.6, 'USD'),
          holding('META', 20, 298.4, 'USD'),
          holding('JPM', 22, 145.2, 'USD'),
          holding('V', 15, 234.8, 'USD'),
          holding('KO', 50, 58.6, 'USD'),
          holding('PEP', 28, 168.9, 'USD'),
          holding('XOM', 33, 104.5, 'USD'),
          holding('JNJ', 26, 156.1, 'USD'),
          holding('PG', 24, 148.7, 'USD'),
          holding('DIS', 19, 91.3, 'USD'),
          holding('NFLX', 12, 402.7, 'USD'),
        ],
        importedAt: new Date().toISOString(),
        currencyReviewPending: false,
      },
      version: 2,
    }))

    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    // Seven more expense category groups and seven more income categories on
    // top of the originals, each with one transaction this month, so
    // ExpenseWidget and IncomeWidget's max-h-[200px] lists genuinely overflow
    // instead of rendering one row.
    ls.setItem('ledger-budget', JSON.stringify({
      state: {
        categoryGroups: {
          'g-house': { id: 'g-house', name: 'Housing', kind: 'expense' },
          'g-food': { id: 'g-food', name: 'Food & Dining', kind: 'expense' },
          'g-transport': { id: 'g-transport', name: 'Transportation', kind: 'expense' },
          'g-utils': { id: 'g-utils', name: 'Utilities', kind: 'expense' },
          'g-fun': { id: 'g-fun', name: 'Entertainment', kind: 'expense' },
          'g-ins': { id: 'g-ins', name: 'Insurance', kind: 'expense' },
          'g-health': { id: 'g-health', name: 'Health & Fitness', kind: 'expense' },
          'g-subs': { id: 'g-subs', name: 'Subscriptions', kind: 'expense' },
          'g-inc': { id: 'g-inc', name: 'Income', kind: 'income' },
        },
        categories: {
          'c-rent': { id: 'c-rent', groupId: 'g-house', name: 'Rent', targetAmount: 2100 },
          'c-food': { id: 'c-food', groupId: 'g-food', name: 'Groceries', targetAmount: 600 },
          'c-transport': { id: 'c-transport', groupId: 'g-transport', name: 'Gas', targetAmount: 150 },
          'c-utils': { id: 'c-utils', groupId: 'g-utils', name: 'Electricity', targetAmount: 120 },
          'c-fun': { id: 'c-fun', groupId: 'g-fun', name: 'Streaming', targetAmount: 40 },
          'c-ins': { id: 'c-ins', groupId: 'g-ins', name: 'Home Insurance', targetAmount: 90 },
          'c-health': { id: 'c-health', groupId: 'g-health', name: 'Gym', targetAmount: 60 },
          'c-subs': { id: 'c-subs', groupId: 'g-subs', name: 'Software', targetAmount: 30 },
          'c-sal': { id: 'c-sal', groupId: 'g-inc', name: 'Salary', targetAmount: 0 },
          'c-bonus': { id: 'c-bonus', groupId: 'g-inc', name: 'Bonus', targetAmount: 0 },
          'c-freelance': { id: 'c-freelance', groupId: 'g-inc', name: 'Freelance', targetAmount: 0 },
          'c-div': { id: 'c-div', groupId: 'g-inc', name: 'Dividends', targetAmount: 0 },
          'c-int': { id: 'c-int', groupId: 'g-inc', name: 'Interest', targetAmount: 0 },
          'c-rental': { id: 'c-rental', groupId: 'g-inc', name: 'Rental Income', targetAmount: 0 },
          'c-refund': { id: 'c-refund', groupId: 'g-inc', name: 'Refunds', targetAmount: 0 },
          'c-gift': { id: 'c-gift', groupId: 'g-inc', name: 'Gifts', targetAmount: 0 },
        },
        transactions: {
          t1: { id: 't1', date: `${prefix}-01`, amount: 2100, description: 'Rent - 12 Maplewood Crescent', type: 'expense', categoryId: 'c-rent' },
          t2: { id: 't2', date: `${prefix}-15`, amount: 4820.55, description: 'Paycheque', type: 'income', categoryId: 'c-sal' },
          t3: { id: 't3', date: `${prefix}-18`, amount: 77.89, description: 'Metro', type: 'expense', categoryId: 'c-rent' },
          t4: { id: 't4', date: `${prefix}-02`, amount: 310.4, description: 'Groceries', type: 'expense', categoryId: 'c-food' },
          t5: { id: 't5', date: `${prefix}-03`, amount: 88.2, description: 'Gas', type: 'expense', categoryId: 'c-transport' },
          t6: { id: 't6', date: `${prefix}-04`, amount: 115.6, description: 'Hydro', type: 'expense', categoryId: 'c-utils' },
          t7: { id: 't7', date: `${prefix}-05`, amount: 38.99, description: 'Streaming bundle', type: 'expense', categoryId: 'c-fun' },
          t8: { id: 't8', date: `${prefix}-06`, amount: 84.5, description: 'Home insurance premium', type: 'expense', categoryId: 'c-ins' },
          t9: { id: 't9', date: `${prefix}-07`, amount: 54.0, description: 'Gym membership', type: 'expense', categoryId: 'c-health' },
          t10: { id: 't10', date: `${prefix}-08`, amount: 27.99, description: 'Cloud storage', type: 'expense', categoryId: 'c-subs' },
          t11: { id: 't11', date: `${prefix}-16`, amount: 1500, description: 'Year-end bonus', type: 'income', categoryId: 'c-bonus' },
          t12: { id: 't12', date: `${prefix}-17`, amount: 620.5, description: 'Contract invoice', type: 'income', categoryId: 'c-freelance' },
          t13: { id: 't13', date: `${prefix}-19`, amount: 42.1, description: 'ETF distribution', type: 'income', categoryId: 'c-div' },
          t14: { id: 't14', date: `${prefix}-20`, amount: 9.75, description: 'Savings interest', type: 'income', categoryId: 'c-int' },
          t15: { id: 't15', date: `${prefix}-21`, amount: 900, description: 'Basement rental', type: 'income', categoryId: 'c-rental' },
          t16: { id: 't16', date: `${prefix}-22`, amount: 65.3, description: 'Return refund', type: 'income', categoryId: 'c-refund' },
          t17: { id: 't17', date: `${prefix}-23`, amount: 120, description: 'Birthday gift', type: 'income', categoryId: 'c-gift' },
        },
      },
      version: 3,
    }))

    ls.setItem('ledger-compensation', JSON.stringify({
      state: {
        primaryPackage: {
          id: 'p1', name: 'Current Offer', companyTicker: 'MSFT', companyCurrentPrice: 428.5,
          baseSalary: 165000, pastSalaryChanges: [], cashBonusPercent: 12, cashBonusMonth: 2,
          esppContributionPercent: 10, esppDiscountPercent: 15, esppLockedInPrice: 0,
          rrspMatchPercent: 5, rrspMatchCap: 12000,
          rsuGrants: [{
            id: 'g1', grantName: '2024 Refresh', grantShares: 1200, grantPrice: 310,
            grantStartDate: '2024-03-01',
            vestingSchedule: { preset: '4yr-1yr-cliff', totalVestMonths: 48, cliffMonths: 12, frequency: 'quarterly' },
          }],
        },
        comparePackage: null, compareMode: false, timeMode: 'current-year',
        useCadConversion: false, showAfterTax: false,
      },
      version: 0,
    }))
  })
}
