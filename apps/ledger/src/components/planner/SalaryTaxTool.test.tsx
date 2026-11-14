import { fireEvent, render, screen } from '@testing-library/react'
import { BracketBar, SalaryTaxTool } from './SalaryTaxTool'
import { usePlannerStore } from '../../store/usePlannerStore'
import { annualSalaryTax, salaryMarginalRate } from '../../utils/finance/canadaTax'
import { formatMoney } from './format'
import { getTool } from './toolRegistry'

const initialState = usePlannerStore.getState()
beforeEach(() => {
  localStorage.clear()
  usePlannerStore.setState(initialState, true)
})

describe('BracketBar', () => {
  it('only shows rate labels when the segment is wide enough (container query)', () => {
    render(
      <BracketBar
        title="Federal"
        income={100000}
        brackets={[
          { upTo: 57375, rate: 0.15 },
          { upTo: 114750, rate: 0.205 },
          { upTo: Infinity, rate: 0.26 },
        ]}
      />,
    )
    const label = screen.getByText('15.0%')
    // hidden by default, shown only from 44px container width up
    expect(label.className).toContain('hidden')
    expect(label.className).toContain('@min-[44px]:flex')
    // the segment box the label sits in must be a container for the query to work
    expect((label.parentElement as HTMLElement).className).toContain('@container')
  })

  it('keeps the open-ended bracket caption intact (no truncation of the "+")', () => {
    render(
      <BracketBar
        title="Federal"
        income={100000}
        brackets={[
          { upTo: 57375, rate: 0.15 },
          { upTo: 114750, rate: 0.205 },
          { upTo: Infinity, rate: 0.26 },
        ]}
      />,
    )
    const caption = screen.getByText('$114,750+')
    const classes = caption.className.split(/\s+/)
    expect(classes).not.toContain('truncate') // truncation would drop the trailing "+"
  })

  it('lays segments out so the row can never overflow into a scrollbar', () => {
    const { container } = render(
      <BracketBar
        title="Ontario"
        income={193000}
        brackets={[
          { upTo: 53891, rate: 0.0505 },
          { upTo: 107785, rate: 0.0915 },
          { upTo: 150000, rate: 0.1116 },
          { upTo: 220000, rate: 0.1216 },
          { upTo: Infinity, rate: 0.1316 },
        ]}
      />,
    )
    // nothing in the subtree may scroll horizontally
    expect(container.querySelectorAll('.overflow-x-auto')).toHaveLength(0)
    const segment = screen.getByText('$0 to $53,891').parentElement as HTMLElement
    // proportional but shrinkable: gaps come out of the segments, not the row
    expect(segment.style.flex).not.toBe('')
    expect(segment.style.flex).toContain('1 0')
    expect(segment.style.minWidth).toBe('')
    expect(segment.className).toContain('min-w-0')
    expect(segment.className).not.toContain('shrink-0')
  })

  it('shortens the range caption in segments too narrow for the full figures', () => {
    render(
      <BracketBar
        title="Ontario"
        income={193000}
        brackets={[
          { upTo: 53891, rate: 0.0505 },
          { upTo: 107785, rate: 0.0915 },
          { upTo: 150000, rate: 0.1116 },
          { upTo: 220000, rate: 0.1216 },
          { upTo: Infinity, rate: 0.1316 },
        ]}
      />,
    )
    const full = screen.getByText('$0 to $53,891')
    const compact = screen.getByText('$0 to $54k')
    // the segment must be its own query container for the swap to resolve
    expect((full.parentElement as HTMLElement).className).toContain('@container')
    expect(full.className).toContain('@min-[120px]:block')
    expect(compact.className).toContain('@min-[120px]:hidden')
  })

  it('hides the caption entirely below 88px, and bounds the segment column so nothing can paint over a neighbour', () => {
    render(
      <BracketBar
        title="Ontario"
        income={193000}
        brackets={[
          { upTo: 53891, rate: 0.0505 },
          { upTo: 107785, rate: 0.0915 },
          { upTo: 150000, rate: 0.1116 },
          { upTo: 220000, rate: 0.1216 },
          { upTo: Infinity, rate: 0.1316 },
        ]}
      />,
    )
    const compact = screen.getByText('$0 to $54k')
    expect(compact.className).toContain('hidden')
    expect(compact.className).toContain('@min-[88px]:block')
    const column = screen.getByText('$0 to $53,891').closest('.min-w-0') as HTMLElement
    expect(column.className).toContain('overflow-hidden')
  })
})

describe('SalaryTaxTool layout', () => {
  it('spaces the annual Ontario premium note and keeps the bracket explanation behind help', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 58_523)
    render(<SalaryTaxTool />)

    const annualNote = screen.getByText('Included in annual Provincial Tax:').parentElement
    expect(annualNote?.textContent).toBe('Included in annual Provincial Tax: Annual Ontario Health Premium $600')
    expect(screen.queryByText(/Filled portion = income inside each bracket/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'About brackets and marginal rates' }))
    expect(screen.getByRole('dialog', { name: 'Brackets and marginal rates help' })).toHaveTextContent(
      'Federal brackets use $57,973 taxable income after deductions',
    )
  })

  it('puts readable spaces between the marginal rate components', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 58_523)
    render(<SalaryTaxTool />)

    const equation = screen.getByText('Marginal Rate Breakdown').parentElement?.nextElementSibling
    expect(equation?.textContent).toBe('Federal 12.94% + Provincial 8.73% = 21.67%')
    expect(equation?.lastElementChild).toHaveClass('font-semibold')
  })

  it('omits a zero provincial marginal adjustment and identifies the taxable bracket income', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 60_000)
    usePlannerStore.getState().setInput('salary-tax', 'province', 'AB')
    render(<SalaryTaxTool />)

    expect(screen.getByText('Federal 19.37%')).toBeInTheDocument()
    expect(screen.getByText('+ Provincial 7.39%')).toBeInTheDocument()
    expect(screen.queryByText(/Provincial adjustments 0.00%/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'About brackets and marginal rates' }))
    expect(screen.getByRole('dialog', { name: 'Brackets and marginal rates help' })).toHaveTextContent(
      'Federal brackets use $59,435 taxable income',
    )
  })

  it('keeps a nonzero provincial marginal adjustment visible', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 35_000)
    usePlannerStore.getState().setInput('salary-tax', 'province', 'BC')
    render(<SalaryTaxTool />)

    expect(screen.getByText(/Provincial adjustments 3.52%/)).toBeInTheDocument()
  })

  it('keeps the marginal percentages and separately shows the annual Ontario health premium', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 100_000)
    usePlannerStore.getState().setInput('salary-tax', 'rrsp', 10_000)
    usePlannerStore.getState().setInput('salary-tax', 'fhsa', 8_000)
    render(<SalaryTaxTool />)

    expect(screen.getByText('Marginal Rate Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Marginal Rate Breakdown').parentElement?.nextElementSibling).toHaveTextContent('29.65%')
    expect(screen.queryByText(/Provincial adjustments 0.00%/)).not.toBeInTheDocument()
    expect(screen.getByText('Annual Ontario Health Premium').parentElement).toHaveTextContent('$750')
  })

  it('shows the Ontario tax reduction separately when it offsets the annual premium', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 25_000)
    render(<SalaryTaxTool />)

    expect(screen.getByText('Annual Ontario Health Premium').parentElement).toHaveTextContent('$287')
    expect(screen.getByText('Ontario tax reduction').parentElement).toHaveTextContent('-$79')
  })

  it('includes the Ontario premium in total income tax and divides annual net across pay periods', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 100_000)
    render(<SalaryTaxTool />)
    const t = annualSalaryTax(100_000, 'ON')
    expect(t.provincialAdjustments).toBe(750)
    expect(screen.getByText('Total Income Tax').parentElement?.lastElementChild).toHaveTextContent(formatMoney(t.federal + t.provincial))
    expect(screen.getByText('Net Monthly').parentElement?.lastElementChild).toHaveTextContent(formatMoney(t.net / 12))
    expect(screen.getByText('Net Biweekly').parentElement?.lastElementChild).toHaveTextContent(formatMoney(t.net / 26))
  })

  it('explains the annual employee estimate in the tool help', () => {
    expect(getTool('salary-tax')?.info.howTo).toContain('2026 annual employee estimate using standard credits and contributions')
  })

  it('shows annual income tax equal to the federal and provincial deductions with RRSP and FHSA', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 100_000)
    usePlannerStore.getState().setInput('salary-tax', 'rrsp', 10_000)
    usePlannerStore.getState().setInput('salary-tax', 'fhsa', 8_000)
    render(<SalaryTaxTool />)
    const taxCard = screen.getByText('Total Income Tax').parentElement?.lastElementChild?.textContent
    const federalRow = screen.getByText('Federal Tax').parentElement?.lastElementChild?.textContent
    const provincialRow = screen.getByText('Provincial Tax').parentElement?.lastElementChild?.textContent
    const money = (value: string | null | undefined) => Number(value?.replace(/[$,]/g, ''))
    // Each displayed component is independently rounded to the nearest dollar.
    expect(Math.abs(money(taxCard) - money(federalRow) - money(provincialRow))).toBeLessThanOrEqual(1)
    const t = annualSalaryTax(100_000, 'ON', 10_000, 8_000)
    expect(taxCard).toBe(formatMoney(t.federal + t.provincial))
    expect(screen.getByText(`${salaryMarginalRate(100_000, 'ON', 10_000, 8_000).toFixed(2)}%`)).toBeInTheDocument()
  })

  it('offers an optional CRA RRSP deduction limit field', () => {
    render(<SalaryTaxTool />)
    expect(screen.getByLabelText('CRA RRSP Deduction Limit')).toBeInTheDocument()
    expect(screen.getByText(/Leave it at \$0 if unknown/i)).toBeInTheDocument()
  })

  it('renders the deductions block and the RRSP efficiency block side by side', () => {
    const { container } = render(<SalaryTaxTool />)
    expect(screen.getByText(/^Where \$/)).toBeInTheDocument()
    expect(screen.getByText('RRSP Efficiency')).toBeInTheDocument()
    const pair = container.querySelector('.lg\\:grid-cols-\\[1\\.35fr_1fr\\]')
    expect(pair).not.toBeNull()
    expect(pair?.children).toHaveLength(2)
  })

  it('stretches the paired cards to a common height instead of aligning to the top', () => {
    const { container } = render(<SalaryTaxTool />)
    const pair = container.querySelector('.lg\\:grid-cols-\\[1\\.35fr_1fr\\]')
    expect(pair).not.toBeNull()
    expect(pair?.className).not.toContain('items-start')
  })

  it('shows no invented RRSP room when no CRA limit was entered', () => {
    render(<SalaryTaxTool />)
    expect(screen.getByLabelText('CRA RRSP Deduction Limit')).toBeInTheDocument()
    expect(screen.getByText(/Enter your CRA RRSP deduction limit to compare with available room/i)).toBeInTheDocument()
    expect(screen.queryByText(/estimated remaining room/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: /remaining room used/i })).not.toBeInTheDocument()
  })

  it('caps modeled RRSP deduction at the entered CRA limit but keeps full cash outflow', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 100_000)
    usePlannerStore.getState().setInput('salary-tax', 'rrsp', 10_000)
    usePlannerStore.getState().setInput('salary-tax', 'rrspRoom', 6_000)
    render(<SalaryTaxTool />)
    const capped = annualSalaryTax(100_000, 'ON', 6_000)
    const noRrsp = annualSalaryTax(100_000, 'ON')
    const savings = noRrsp.federal + noRrsp.provincial - capped.federal - capped.provincial
    expect(screen.getByText('Taxable Income').parentElement?.lastElementChild).toHaveTextContent(formatMoney(capped.taxableIncome))
    expect(screen.getByText('Tax Savings From Contributions').parentElement?.lastElementChild).toHaveTextContent(formatMoney(savings))
    expect(screen.getByText('Net After Contributions').parentElement?.lastElementChild).toHaveTextContent(formatMoney(capped.net - 10_000))
    expect(screen.getByText(/exceeds the CRA limit entered by \$4,000/i)).toBeInTheDocument()
  })

  it('uses gross pay for effective rate after RRSP and FHSA deductions', () => {
    usePlannerStore.getState().setInput('salary-tax', 'income', 100_000)
    usePlannerStore.getState().setInput('salary-tax', 'rrsp', 10_000)
    usePlannerStore.getState().setInput('salary-tax', 'fhsa', 8_000)
    render(<SalaryTaxTool />)
    const t = annualSalaryTax(100_000, 'ON', 10_000, 8_000)
    expect(screen.getByText('Effective Rate').parentElement?.lastElementChild).toHaveTextContent(
      `${(((t.federal + t.provincial) / 100_000) * 100).toFixed(2)}%`)
  })
})

describe('SalaryTaxTool tax year', () => {
  it('names the tax year on the result', () => {
    render(<SalaryTaxTool />)
    expect(screen.getByText(/2026 tax year/i)).toBeInTheDocument()
  })

  it('does not warn about a stale year while the current year is still the tax year', () => {
    render(<SalaryTaxTool />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  describe('once the tax year has passed', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2027-03-01T00:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('warns when the tax year has passed', () => {
      render(<SalaryTaxTool />)
      expect(
        screen.getByText(/These are 2026 rates\. Brackets and contribution limits have not been updated for 2027\./i),
      ).toBeInTheDocument()
    })
  })
})
