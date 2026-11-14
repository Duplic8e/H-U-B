import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, Building2, CreditCard, Home, Hourglass, Landmark, LineChart, Percent, ShieldCheck, Target, TrendingDown, TrendingUp } from 'lucide-react'

export type PlannerToolGroup =
  | 'Forecasting & Growth'
  | 'Savings'
  | 'Debt & Housing'
  | 'Income & Tax'
  | 'Utilities'

/** Hub section + dropdown order. */
export const PLANNER_GROUPS: PlannerToolGroup[] = [
  'Forecasting & Growth',
  'Savings',
  'Income & Tax',
  'Debt & Housing',
  'Utilities',
]

export interface ToolInfo {
  howTo: string
  params: Array<{ name: string; description: string }>
}

export interface PlannerTool {
  id: string
  name: string
  description: string
  group: PlannerToolGroup
  icon: LucideIcon
  info: ToolInfo
}

// Single source of truth for Planner tools. The hub grid and the
// /planner/:toolId route both read from this list. Later Phase-4 sub-plans
// add calculators by appending entries here.
export const PLANNER_TOOLS: PlannerTool[] = [
  {
    id: 'forecaster',
    name: 'Net-Worth / FIRE Forecaster',
    description: 'Your history projected forward: scenarios, FIRE date, goals, Monte Carlo.',
    group: 'Forecasting & Growth',
    icon: TrendingUp,
    info: {
      howTo: 'Project your net worth forward. Start from your dashboard net worth or a manual balance, set monthly savings and assumptions, then read the FI Number, projected FI date, and Monte Carlo odds below the chart. FI Number is the portfolio size at which annual withdrawals at your chosen rate cover your annual spending, the point where work becomes optional.',
      params: [
        { name: 'Starting Balance', description: 'Where the projection begins. Auto mode pulls your dashboard net worth; manual lets you type any figure.' },
        { name: 'Monthly Savings', description: 'How much you add every month across all accounts. Auto mode uses your average budget surplus over the last 3 months.' },
        { name: 'Years', description: 'How far into the future the chart projects.' },
        { name: 'Return', description: 'Expected average annual investment return, in percent, before inflation.' },
        { name: 'Inflation', description: "Expected annual inflation. Real (today's dollars) mode subtracts this from returns." },
        { name: 'Contribution Step-Up', description: 'Annual percent increase to your monthly savings, modeling raises.' },
        { name: 'Scenario Spread', description: 'Plus or minus percent applied to the return to draw optimistic and pessimistic bands.' },
        { name: 'Comp Events / Debt Drag', description: 'Comp Events adds your upcoming RSU vesting payouts from Compensation as one-time boosts. Debt Drag subtracts your ongoing monthly debt payments from savings until each debt is paid off.' },
        { name: 'Annual Spending in Retirement', description: 'What you expect to spend per year once retired. Sets the FI target.' },
        { name: 'Withdrawal Rate', description: 'The percent of your portfolio you plan to withdraw each year in retirement. FI Number = annual spending divided by this rate (4% is the classic "safe withdrawal rate").' },
        { name: 'Volatility (Std Dev)', description: 'How much returns swing year to year in the Monte Carlo simulation. 15 is typical for a stock-heavy portfolio.' },
      ],
    },
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    description: 'See how a starting balance and monthly contributions grow over time.',
    group: 'Forecasting & Growth',
    icon: LineChart,
    info: {
      howTo: 'See how a starting balance plus monthly contributions grows. Adjust the rate and years and watch the balance curve.',
      params: [
        { name: 'Starting Amount', description: 'The lump sum you begin with.' },
        { name: 'Monthly Contribution', description: 'How much you add every month.' },
        { name: 'Annual Return', description: 'Expected average annual growth rate, in percent.' },
        { name: 'Years', description: 'How long the money grows before you check the result.' },
      ],
    },
  },
  {
    id: 'savings-goal',
    name: 'Savings Goal',
    description: 'Solve for any variable: contribution, time, required return, or final balance.',
    group: 'Savings',
    icon: Target,
    info: {
      howTo: 'Pick which variable to solve for, fill in the other three, and the tool computes the missing one.',
      params: [
        { name: 'Solve For', description: 'Choose the unknown: final balance, monthly contribution, years, or required return.' },
        { name: 'Starting Amount', description: 'The lump sum you begin with.' },
        { name: 'Monthly Contribution', description: 'How much you add every month.' },
        { name: 'Annual Return', description: 'Expected average annual growth rate, in percent.' },
        { name: 'Years', description: 'How long the money grows before reaching the goal.' },
      ],
    },
  },
  {
    id: 'emergency-fund',
    name: 'Emergency Fund',
    description: 'How many months of expenses you have covered, and the gap to your target.',
    group: 'Savings',
    icon: ShieldCheck,
    info: {
      howTo: 'Enter monthly expenses, current fund, and a target in months to see coverage and the gap.',
      params: [
        { name: 'Monthly Essential Expenses', description: 'What you need to cover basics each month: housing, food, utilities, minimum debt payments.' },
        { name: 'Months of Cover', description: 'How many months of expenses you want the fund to cover before you feel secure.' },
        { name: 'Current Savings', description: 'How much you already have set aside for emergencies.' },
      ],
    },
  },
  {
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'USD ⇄ CAD with live rates, historical lookup, and manual fallback.',
    group: 'Utilities',
    icon: ArrowLeftRight,
    info: {
      howTo: 'Convert USD and CAD using live rates. Pick a historical date for past rates, or type a manual rate if offline.',
      params: [
        { name: 'Amount', description: 'The amount you want to convert, in the currency you are converting from.' },
        { name: 'Direction', description: 'Swap between converting USD to CAD or CAD to USD.' },
        { name: 'Rate Date (Optional)', description: 'Look up the exchange rate as of a past date instead of the live rate.' },
        { name: 'Manual Rate Override', description: 'Type a rate to use instead of the live or historical lookup, useful when offline.' },
      ],
    },
  },
  {
    id: 'raise-inflation',
    name: 'Raise vs Inflation',
    description: 'Is my raise a real raise? Nominal vs inflation-adjusted.',
    group: 'Income & Tax',
    icon: TrendingDown,
    info: {
      howTo: 'Compare your raise to inflation to see the real change in buying power.',
      params: [
        { name: 'Old Salary', description: 'Your salary before the raise.' },
        { name: 'New Salary', description: 'Your salary after the raise.' },
        { name: 'Inflation', description: 'Expected or actual annual inflation over the period, in percent.' },
      ],
    },
  },
  {
    id: 'debt-payoff',
    name: 'Debt Payoff',
    description: 'Snowball vs avalanche: payoff date, total interest, extra-payment impact.',
    group: 'Debt & Housing',
    icon: CreditCard,
    info: {
      howTo: 'List your debts with balance, APR, and minimum payment. Choose avalanche (highest APR first) or snowball (smallest balance first), add any extra monthly amount, and compare payoff time and interest.',
      params: [
        { name: 'Balance', description: 'How much you currently owe on that debt.' },
        { name: 'APR', description: 'Annual percentage rate for that debt.' },
        { name: 'Min Payment', description: 'The minimum monthly payment required on that debt.' },
        { name: 'Extra Monthly Payment', description: 'Amount above the minimums applied to the target debt each month.' },
        { name: 'Strategy', description: 'Avalanche pays off the highest APR debt first to minimize interest. Snowball pays off the smallest balance first for quick wins.' },
      ],
    },
  },
  {
    id: 'mortgage',
    name: 'Mortgage',
    description: 'Payment, amortization curve, and how much house you can afford.',
    group: 'Debt & Housing',
    icon: Home,
    info: {
      howTo: 'Payment mode computes the monthly payment and amortization curve from price, down payment, rate, and years. Affordability mode estimates the largest home price your income supports.',
      params: [
        { name: 'Home Price', description: 'The purchase price of the home.' },
        { name: 'Down Payment', description: 'Percent of price paid upfront. The rest is the mortgage principal.' },
        { name: 'Rate', description: 'Annual interest rate. Interest compounds monthly here, a small simplification of Canadian semi-annual compounding.' },
        { name: 'Amortization (Years)', description: 'The payoff schedule length: how many years of payments it takes to fully repay the mortgage.' },
        { name: 'Gross Annual Income', description: 'Your household gross income before tax, used to estimate affordability.' },
        { name: 'GDS Ratio', description: 'Gross Debt Service: the percent of gross income lenders allow for housing costs, typically up to 39.' },
        { name: 'Property Tax / Month', description: 'Estimated monthly property tax, factored into the affordability calculation.' },
        { name: 'Extra Payments', description: 'Optional prepayments: recurring monthly extras over a year range, or one-time lump sums. Both shorten the loan and cut interest.' },
      ],
    },
  },
  {
    id: 'rent-vs-buy',
    name: 'Rent vs Buy',
    description: 'Cumulative-cost crossover: when (if ever) buying beats renting.',
    group: 'Debt & Housing',
    icon: Building2,
    info: {
      howTo: 'Compare cumulative cost of renting vs buying over time and find the crossover year, if any.',
      params: [
        { name: 'Monthly Rent', description: 'What you currently pay in rent per month.' },
        { name: 'Rent Increase', description: 'Expected annual percent increase in rent.' },
        { name: 'Home Price', description: 'The purchase price of the home you would buy instead.' },
        { name: 'Down Payment', description: 'Percent of price paid upfront. The rest becomes the mortgage principal.' },
        { name: 'Mortgage Rate', description: 'Annual interest rate on the mortgage.' },
        { name: 'Property Tax', description: 'Estimated annual property tax as a percent of home price.' },
        { name: 'Maintenance', description: 'Estimated annual maintenance and upkeep cost as a percent of home price.' },
        { name: 'Investment Return (Opportunity)', description: 'The annual return your down payment could earn if invested instead of used to buy, used to weigh the true cost of tying up that cash.' },
        { name: 'Horizon (Years)', description: 'How many years the comparison runs before it stops, even if renting is still cheaper.' },
        { name: 'Amortization (Years)', description: 'The payoff schedule length: how many years of payments it takes to fully repay the mortgage.' },
      ],
    },
  },
  {
    id: 'salary-tax',
    name: 'Salary & Tax',
    description: 'Gross to net for any province. 2026 annual employee estimate, marginal/effective rates, CPP/QPP, EI and QPIP.',
    group: 'Income & Tax',
    icon: Landmark,
    info: {
      howTo: 'Enter gross income and province for a 2026 annual employee estimate using standard credits and contributions: federal and provincial tax, CPP/QPP, EI, QPIP where applicable, and net pay per period. Add RRSP and FHSA contributions to see the estimated tax savings.',
      params: [
        { name: 'Gross Annual Income', description: 'Your total income before tax and deductions.' },
        { name: 'Province', description: 'Your province of residence, which determines the provincial tax brackets applied.' },
        { name: 'RRSP Contribution', description: 'The entered contribution is a cash outflow. If you enter a CRA deduction limit, only the amount within that limit reduces taxable income in this estimate.' },
        { name: 'CRA RRSP Deduction Limit', description: 'Optional 2026 amount from your CRA notice of assessment. If left at zero, room is unknown and the estimate assumes the entered RRSP contribution is deductible.' },
        { name: 'FHSA Contribution', description: 'First Home Savings Account deposits, deductible like RRSP. Annual limit $8,000.' },
        { name: 'Marginal Rate', description: 'The tax rate applied to your next dollar earned. It is higher than your effective rate because Canada uses progressive tax brackets.' },
        { name: 'Effective Rate', description: 'Your total tax as a percent of total income, the blended rate across all brackets, lower than your marginal rate.' },
      ],
    },
  },
  {
    id: 'inflation-adjuster',
    name: 'Inflation Adjuster',
    description: "What today's dollars cost later, or what a future amount is worth today.",
    group: 'Utilities',
    icon: Hourglass,
    info: {
      howTo: "Convert money across time. Future Cost mode shows what today's amount will cost after years of inflation. Useful for checking what a savings goal will really be worth when you reach it. Today's Value mode discounts a future amount back to present-day dollars.",
      params: [
        { name: 'Direction', description: "Today's $ → Future Cost projects forward; Future $ → Today's Value discounts back." },
        { name: 'Amount', description: 'The dollar amount to convert.' },
        { name: 'Years', description: 'How many years of inflation to apply.' },
        { name: 'Annual Inflation', description: 'Expected average yearly inflation rate. Bank of Canada targets 2%.' },
      ],
    },
  },
  {
    id: 'rate-converter',
    name: 'Rate & Return Converter',
    description: 'APR ⇄ APY across compounding frequencies, and CAGR from any start/end value.',
    group: 'Utilities',
    icon: Percent,
    info: {
      howTo: 'Normalize rates so they compare fairly. APR ⇄ APY mode converts between the nominal rate banks advertise and the effective annual rate you actually earn or pay, for a given compounding frequency. CAGR mode turns a total gain ("$10k became $14k in 3 years") into the equivalent steady annual return.',
      params: [
        { name: 'Mode', description: 'APR ⇄ APY converts rate formats; Annualized Return computes CAGR from start and end values.' },
        { name: 'Direction', description: 'Convert an advertised APR to effective APY, or back the APR out of a quoted APY.' },
        { name: 'Compounding', description: 'How often interest is applied. More frequent compounding widens the APR/APY gap.' },
        { name: 'Starting / Ending Value', description: 'The investment value at the start and end of the period (CAGR mode).' },
        { name: 'Years', description: 'The length of the period (CAGR mode). Fractions like 2.5 are fine.' },
      ],
    },
  },
]

export function getTool(id: string | undefined): PlannerTool | undefined {
  return PLANNER_TOOLS.find((t) => t.id === id)
}
