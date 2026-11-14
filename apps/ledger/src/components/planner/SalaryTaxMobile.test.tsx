import { fireEvent, render, screen } from '@testing-library/react'
import { SalaryTaxMobile } from './SalaryTaxMobile'
import { useSalaryTax } from './useSalaryTax'
import { usePlannerStore } from '../../store/usePlannerStore'
import { takeHomeWithDeductions } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'

const initial = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initial, true)
})

const Harness = () => <SalaryTaxMobile s={useSalaryTax()} />

it('leads with net pay per year and rescales it by pay period', () => {
  render(<Harness />)
  const net = takeHomeWithDeductions(100000, 'ON', 0, 0).net
  expect(screen.getByText('Net Pay Per Year')).toBeInTheDocument()
  expect(screen.getAllByText(formatMoney(net)).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Month' }))
  expect(screen.getByText('Net Pay Per Month')).toBeInTheDocument()
  expect(screen.getAllByText(formatMoney(net / 12)).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Biweekly' }))
  expect(screen.getByText('Net Pay Per Pay Period')).toBeInTheDocument()
})

it('summarises income and province, and labels the pension row with its extra tier', () => {
  render(<Harness />)
  expect(screen.getByText(/\$100,000 · Ontario/)).toBeInTheDocument()
  expect(screen.getByText('CPP (incl. CPP2)')).toBeInTheDocument()
})

it('shows the tax year only inside the info button', () => {
  render(<Harness />)
  expect(screen.queryByText(/tax year/i)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'About These Numbers' }))
  expect(screen.getByText(/tax year\./)).toBeInTheDocument()
})

it('shows what was contributed, the net after contributions, and the over-limit note', () => {
  usePlannerStore.getState().setInput('salary-tax', 'rrsp', 12000)
  usePlannerStore.getState().setInput('salary-tax', 'rrspRoom', 10000)
  render(<Harness />)
  expect(screen.getByText('$12,000 Contributed')).toBeInTheDocument()
  const t = takeHomeWithDeductions(100000, 'ON', 10000, 0)
  expect(screen.getByText('Net After Contributions').nextSibling).toHaveTextContent(formatMoney(t.net - 12000))
  expect(screen.getByText(/over the CRA limit entered by \$2,000/)).toBeInTheDocument()
})

it('switches the bracket ladder between Federal and Provincial', () => {
  render(<Harness />)
  expect(screen.getByText('14.0%')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Provincial' }))
  expect(screen.getByText('5.1%')).toBeInTheDocument()
  expect(screen.getByText(/Marginal Rate Breakdown/)).toBeInTheDocument()
})

it('folds RRSP Efficiency with the income in its top slice, and explains differing rates', () => {
  render(<Harness />)
  expect(screen.getByText(/^\$[\d,]+ in Slice$/)).toBeInTheDocument()
})

it('adds a Why This Rate Is Higher button only on the slice where a premium phases in', () => {
  usePlannerStore.getState().setInput('salary-tax', 'income', 230000)
  usePlannerStore.getState().setInput('salary-tax', 'rrsp', 20000)
  render(<Harness />)
  expect(screen.getAllByRole('button', { name: 'Why This Rate Is Higher' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Why This Rate Is Higher' }))
  expect(screen.getByText(/Ontario Health Premium near/)).toBeInTheDocument()
})

it('has no Why This Rate Is Higher button when the slice rates only step down', () => {
  usePlannerStore.getState().setInput('salary-tax', 'income', 150000)
  render(<Harness />)
  expect(screen.queryByRole('button', { name: 'Why This Rate Is Higher' })).not.toBeInTheDocument()
})

it('keeps the provincial premium lines inside the marginal rate info button', () => {
  render(<Harness />)
  expect(screen.queryByText(/Included in Provincial Tax/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'How To Read These Rates' }))
  expect(screen.getByText(/Included in Provincial Tax/)).toBeInTheDocument()
  expect(screen.getByText(/Ontario Health Premium/)).toBeInTheDocument()
})

it('puts the marginal rate calculation inside the info button, not on the page', () => {
  render(<Harness />)
  expect(screen.queryByText(/Fed \d/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'How To Read These Rates' }))
  expect(screen.getByText(/Fed \d+\.\d+% \+ Prov/)).toBeInTheDocument()
})

it('puts the CRA limit prompt behind an info button beside RRSP Efficiency', () => {
  render(<Harness />)
  expect(screen.queryByText(/Enter your CRA RRSP deduction limit to compare/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'About RRSP Room' }))
  expect(screen.getByText(/Enter your CRA RRSP deduction limit to compare/)).toBeInTheDocument()
})

it('drops that info button once a CRA limit is entered', () => {
  usePlannerStore.getState().setInput('salary-tax', 'rrspRoom', 20000)
  render(<Harness />)
  expect(screen.queryByRole('button', { name: 'About RRSP Room' })).not.toBeInTheDocument()
})
