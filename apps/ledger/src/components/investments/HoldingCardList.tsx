import React, { useId } from 'react'
import type { Currency } from '../../services/marketData/types'
import type { Holding } from '../../store/usePortfolioStore'
import type { FxRates } from '../../utils/investments/portfolioMetrics'
import { PHONE_HOLDINGS_LIMIT, useShowMore } from '../../hooks/useShowMore'
import { ShowMoreButton } from '../ui/ShowMoreButton'
import { HoldingCard } from './HoldingCard'

interface HoldingCardListProps {
  account: string
  /** Already sorted; the largest by value come first by default. */
  holdings: Holding[]
  rates: FxRates
  totalValueCad: number
  onPrice: (id: string, price: number, currency: Currency | null) => void
}

/** The card list PortfolioView shows below the `wide` breakpoint. Rule 4 of
 *  docs/mobile-layout-rules.md caps it at eight per account. Cards that are
 *  not shown do not mount and so never call onPrice; the totals stay right
 *  because the desktop table's rows are always mounted (CSS-hidden here) and
 *  report every holding. */
export const HoldingCardList: React.FC<HoldingCardListProps> = ({ account, holdings, rates, totalValueCad, onPrice }) => {
  const list = useShowMore(holdings, PHONE_HOLDINGS_LIMIT)
  const listId = useId()
  return (
    <div data-testid={`portfolio-cards-${account}`} className="wide:hidden flex flex-col gap-2">
      <div id={listId} className="flex flex-col gap-2">
        {list.visible.map((h) => (
          <HoldingCard key={h.id} holding={h} rates={rates} totalValueCad={totalValueCad} onPrice={onPrice} />
        ))}
      </div>
      {list.truncates && (
        <ShowMoreButton total={holdings.length} noun="holdings" expanded={list.expanded} onToggle={list.toggle} controls={listId} />
      )}
    </div>
  )
}
