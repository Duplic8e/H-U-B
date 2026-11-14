import { render, screen } from '@testing-library/react'
import { RrspEfficiencyCard } from './RrspEfficiencyCard'
import { annualSalaryTax, marginalSlices } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'

function renderCard(gross: number, room: number | null) {
  return render(
    <RrspEfficiencyCard
      gross={gross}
      taxableIncome={annualSalaryTax(gross, 'ON').taxableIncome}
      rrsp={0}
      fhsa={0}
      province="ON"
      room={room}
    />,
  )
}

describe('RrspEfficiencyCard', () => {
  it('uses fixed gross and current contributions for the next RRSP saving', () => {
    const gross = 193_000
    const rrsp = 20_000
    const fhsa = 8_000
    const slices = marginalSlices(gross, 'ON', rrsp, fhsa)
    const t = annualSalaryTax(gross, 'ON', rrsp, fhsa)
    render(<RrspEfficiencyCard gross={gross} taxableIncome={t.taxableIncome} rrsp={rrsp} fhsa={fhsa} province="ON" room={13_810} />)
    expect(screen.getAllByText(`${slices[0].rate.toFixed(1)}%`)).toHaveLength(2)
  })

  it('names the displayed rate as a potential deduction saving', () => {
    renderCard(193_000, 33_810)
    expect(screen.getByText(/potential tax saved per additional deductible RRSP dollar/i)).toBeInTheDocument()
    expect(screen.getByText(/If deductible, \$10,433 RRSP clears your top band/i)).toBeInTheDocument()
  })

  it('shows the money sitting in the top marginal band', () => {
    renderCard(193_000, 33_810)
    expect(screen.getByText('$10,433')).toBeInTheDocument()
    expect(screen.getByText('above $181,440')).toBeInTheDocument()
  })

  it('gives a contribution target that clears the top band', () => {
    renderCard(193_000, 33_810)
    expect(screen.getByText(/If deductible, \$10,433 RRSP clears your top band/i)).toBeInTheDocument()
    const before = annualSalaryTax(193_000, 'ON')
    const after = annualSalaryTax(193_000, 'ON', 10_433)
    const saved = before.federal + before.provincial - after.federal - after.provincial
    expect(screen.getByText(`If deductible, $10,433 RRSP clears your top band, saving ${formatMoney(saved)}`)).toBeInTheDocument()
  })

  it('summarises everything below the top two bands in one rung', () => {
    renderCard(193_000, 33_810)
    expect(screen.getByText(/and below/)).toBeInTheDocument()
  })

  it('withholds room comparison when room is unknown', () => {
    renderCard(193_000, null)
    expect(screen.getByText(/Enter your CRA RRSP deduction limit to compare with available room/i)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: /remaining room used/i })).not.toBeInTheDocument()
  })

  it('shows the entered CRA room and exhaustion', () => {
    const view = renderCard(193_000, 20_000)
    expect(screen.getByText(/\$20,000 remaining CRA room/i)).toBeInTheDocument()
    view.rerender(<RrspEfficiencyCard gross={193_000} taxableIncome={annualSalaryTax(193_000, 'ON').taxableIncome} rrsp={0} fhsa={0} province="ON" room={0} />)
    expect(screen.getByText(/No entered RRSP deduction room remains/i)).toBeInTheDocument()
  })

  it('says so when the target does not fit in the room', () => {
    renderCard(193_000, 5_000)
    expect(screen.getByText(/exceeds your .*remaining CRA room by/i)).toBeInTheDocument()
  })

  it('handles income with nothing to shelter', () => {
    renderCard(0, 0)
    expect(screen.getByText(/no taxable income to shelter/i)).toBeInTheDocument()
  })

  it('handles income that sits in a single rate band', () => {
    renderCard(10_000, 1_800)
    expect(screen.getByText(/pay no income tax at this income/i)).toBeInTheDocument()
  })

  it('keeps the remaining-room progress bar before its caption', () => {
    renderCard(193_000, 33_810)
    const caption = screen.getByText(/Uses \d+% of your \$33,810 remaining CRA room/i)
    const bar = screen.getByRole('progressbar', { name: /remaining room used/i })
    // the bar states the figure the caption then names, so the bar comes first
    expect(bar.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
