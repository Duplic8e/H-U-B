import React from 'react'
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts'
import type { SankeyNodeProps } from 'recharts'
import { WidgetWrapper } from '../dashboard/WidgetWrapper'
import { useBudgetStore } from '../../store/useBudgetStore'
import { formatMoney } from '../planner/format'
import { chartTooltipStyles } from '../../utils/chartTheme'
import { countsAsIncome } from '../../utils/budget/sharedExpenses'
import { inRange, type MonthRange } from '../../utils/budget/period'
import { splitParts } from '../../utils/budget/splits'
import { ChartFigure } from '../ui/ChartFigure'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { foldSmallest } from '../../utils/budget/foldSmallest'

type NodeKind = 'income' | 'credit' | 'pool' | 'expense' | 'savings'

interface LinkRenderProps {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetControlX: number
  targetX: number
  targetY: number
  linkWidth: number
  index: number
}

// Income and expense credits enter in the accent colour, expenses leave in
// the error colour, and the remaining flow is drawn brighter.
function renderLink(sourceLinkCount: number, savingsIndex: number) {
  return ({ sourceX, sourceY, sourceControlX, targetControlX, targetX, targetY, linkWidth, index }: LinkRenderProps) => {
    const isSource = index < sourceLinkCount
    const isSavings = index === savingsIndex
    const stroke = isSavings ? 'var(--success)' : isSource ? 'var(--accent)' : 'var(--error)'
    const opacity = isSavings ? 0.55 : 0.28
    return (
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={stroke}
        strokeWidth={Math.max(1, linkWidth)}
        strokeOpacity={opacity}
      />
    )
  }
}

// On a phone each label carries its amount on a second line, and spending and
// savings add their share of what came in. Desktop keeps the one-line label.
function renderNode(phone: boolean, inflow: number) {
  return ({ x, y, width, height, payload }: SankeyNodeProps) => {
    const kind = (payload as { kind?: NodeKind }).kind
    const name = String(payload.name)
    const onLeft = kind === 'income' || kind === 'credit'
    // The left margin is narrower than the right on a phone, so sources truncate sooner.
    const max = phone ? (onLeft ? 11 : 13) : 16
    const label = name.length > max ? `${name.slice(0, max - 1)}…` : name
    const fill = kind === 'expense' ? 'var(--error)' : kind === 'pool' ? 'var(--text-secondary)' : kind === 'savings' ? 'var(--success)' : 'var(--accent)'
    const tx = onLeft ? x - 6 : x + width + 6
    const value = Number((payload as { value?: number }).value ?? 0)
    const share = !onLeft && inflow > 0 ? ` · ${Math.round((value / inflow) * 100)}%` : ''
    return (
      <g>
        <title>{name}</title>
        <rect x={x} y={y} width={width} height={height} fill={fill} stroke="var(--border-color)" />
        {kind === 'pool' ? null : phone ? (
          <text x={tx} y={y + height / 2} textAnchor={onLeft ? 'end' : 'start'} fill="var(--text-primary)">
            <tspan x={tx} dy="-0.3em" fontSize={13} fill={kind === 'savings' ? 'var(--success)' : 'var(--text-primary)'}>{label}</tspan>
            <tspan x={tx} dy="1.3em" fontSize={12} fill="var(--text-secondary)">{`${formatMoney(value)}${share}`}</tspan>
          </text>
        ) : (
          <text
            x={tx}
            y={y + height / 2}
            textAnchor={onLeft ? 'end' : 'start'}
            dominantBaseline="middle"
            fill={kind === 'savings' ? 'var(--success)' : 'var(--text-primary)'}
            fontSize={12}
          >
            {label}
          </text>
        )}
      </g>
    )
  }
}

export const CashFlowWidget: React.FC<{ range: MonthRange }> = ({ range }) => {
  const isDesktop = useIsDesktop()
  const transactions = useBudgetStore((s) => s.transactions)
  const categories = useBudgetStore((s) => s.categories)
  const categoryGroups = useBudgetStore((s) => s.categoryGroups)

  const incomeByCat = new Map<string, number>()
  const expenseByGroup = new Map<string, number>()
  for (const t of Object.values(transactions)) {
    if (!inRange(t.date, range)) continue
    if (t.type === 'income') {
      if (!countsAsIncome(t)) continue
      for (const part of splitParts(t)) {
        const name = (part.categoryId && categories[part.categoryId]?.name) || 'Other income'
        incomeByCat.set(name, (incomeByCat.get(name) ?? 0) + part.amount)
      }
    } else {
      for (const part of splitParts(t)) {
        const groupId = part.categoryId ? categories[part.categoryId]?.groupId : undefined
        const name = (groupId && categoryGroups[groupId]?.name) || 'Uncategorized'
        expenseByGroup.set(name, (expenseByGroup.get(name) ?? 0) + part.amount)
      }
    }
  }

  const incomeNames = [...incomeByCat.keys()]
  const expenseEntries = [...expenseByGroup.entries()].filter(([, value]) => value > 0)
  const creditEntries: [string, number][] = [...expenseByGroup.entries()]
    .filter(([, value]) => value < 0)
    .map(([name, value]) => [`${name} credit`, -value])
  const hasCredits = creditEntries.length > 0

  // Zero net groups contribute no flow, but credit-only periods have sources.
  if (incomeNames.length === 0 && expenseEntries.length === 0 && !hasCredits) {
    return (
      <WidgetWrapper title="Cash Flow">
        <p className="text-[13px] text-text-secondary mt-2">No transactions this month.</p>
      </WidgetWrapper>
    )
  }

  const totalIncome = [...incomeByCat.values()].reduce((s, v) => s + v, 0)
  const totalExpense = expenseEntries.reduce((s, [, value]) => s + value, 0)
  const totalCredits = creditEntries.reduce((s, [, value]) => s + value, 0)
  const savings = Math.max(0, totalIncome + totalCredits - totalExpense)

  // Rule 6 of docs/mobile-layout-rules.md. At 375px this Sankey drew nine
  // income labels and nine expense labels down a 240px chart. A phone keeps
  // the three largest income sources, three largest credits and four largest
  // spending groups and folds the rest separately; narration keeps real counts.
  const incomeEntries: [string, number][] = [...incomeByCat.entries()]
  const drawnIncome = isDesktop ? incomeEntries : foldSmallest(incomeEntries, 3, 'Other sources')
  const drawnCredits = isDesktop ? creditEntries : foldSmallest(creditEntries, 3, 'Other expense credits')
  const drawnExpense = isDesktop ? expenseEntries : foldSmallest(expenseEntries, 4, 'Other spending')

  const poolIdx = drawnIncome.length + drawnCredits.length
  const nodes = [
    ...drawnIncome.map(([name]) => ({ name, kind: 'income' as const })),
    ...drawnCredits.map(([name]) => ({ name, kind: 'credit' as const })),
    { name: hasCredits ? 'Available funds' : 'Income', kind: 'pool' as const },
    ...drawnExpense.map(([name]) => ({ name, kind: 'expense' as const })),
    ...(savings > 0 ? [{ name: hasCredits ? 'Net remaining' : 'Savings', kind: 'savings' as const }] : []),
  ]

  const incomeLinks = drawnIncome.map(([, value], i) => ({ source: i, target: poolIdx, value }))
  const creditLinks = drawnCredits.map(([, value], i) => ({ source: drawnIncome.length + i, target: poolIdx, value }))
  const expenseLinks = drawnExpense.map(([, value], i) => ({ source: poolIdx, target: poolIdx + 1 + i, value }))
  const savingsLinks = savings > 0 ? [{ source: poolIdx, target: nodes.length - 1, value: savings }] : []
  const sourceLinks = [...incomeLinks, ...creditLinks].filter((l) => l.value > 0)
  const links = [...sourceLinks, ...expenseLinks, ...savingsLinks].filter((l) => l.value > 0)

  const savingsIndex = savings > 0 ? links.length - 1 : -1

  return (
    <WidgetWrapper title="Cash Flow">
      <ChartFigure
        label={hasCredits
          ? `Cash flow this period: ${formatMoney(totalIncome)} income across ${incomeNames.length} sources plus ${formatMoney(totalCredits)} expense credits across ${creditEntries.length} groups into ${formatMoney(totalExpense)} of positive net expenses across ${expenseEntries.length} groups, leaving ${formatMoney(savings)} net remaining`
          : `Cash flow this period: ${formatMoney(totalIncome)} income across ${incomeNames.length} sources into ${formatMoney(totalExpense)} of expenses across ${expenseEntries.length} groups, leaving ${formatMoney(savings)} saved`}
        className="h-[380px] desktop:h-[300px] mt-2"
      >
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={{ nodes, links }}
            nodePadding={isDesktop ? 24 : 34}
            margin={isDesktop ? { top: 24, right: 110, bottom: 10, left: 100 } : { top: 18, right: 110, bottom: 12, left: 92 }}
            link={renderLink(sourceLinks.length, savingsIndex)}
            node={renderNode(!isDesktop, totalIncome + totalCredits)}
          >
            <Tooltip formatter={(value) => formatMoney(Number(value))} {...chartTooltipStyles} />
          </Sankey>
        </ResponsiveContainer>
      </ChartFigure>
      {hasCredits && <p className="text-[13px] text-text-secondary mt-2">Expense credits reduce spending and are not income.</p>}
    </WidgetWrapper>
  )
}
