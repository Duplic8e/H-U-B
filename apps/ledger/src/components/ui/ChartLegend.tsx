import React from 'react'

interface ChartLegendItem {
  name: string
  color: string
  value?: string
  /** Swatch opacity, for a series drawn as a translucent area. */
  opacity?: number
}

/** The legend pattern from AllocationBars, extracted so every multi-series
 *  chart uses it.
 *
 *  Text below the graphic rather than labels inside it: several --chart-*
 *  tokens are mid-tone and clear 4.5:1 against neither white nor black across
 *  the six themes, so text on a series colour would be a contrast problem to
 *  solve six times over. Naming the series underneath sidesteps that, and
 *  doubles as the non-colour channel the marks themselves cannot provide.
 *
 *  The swatch is aria-hidden: it carries no information the name does not,
 *  and announcing "image" before every series name is noise. */
export const ChartLegend: React.FC<{ items: ChartLegendItem[]; centered?: boolean }> = ({ items, centered }) => (
  <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 list-none p-0${centered ? ' justify-center' : ''}`}>
    {items.map((item) => (
      <li key={item.name} className="inline-flex items-center gap-1.5 text-meta text-text-secondary">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color, opacity: item.opacity }} aria-hidden="true" />
        <span className="tabular-nums">
          {item.name}
          {item.value ? ` · ${item.value}` : ''}
        </span>
      </li>
    ))}
  </ul>
)
