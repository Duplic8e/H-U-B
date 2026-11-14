import React from 'react'

interface ChartFigureProps {
  /** A sentence that carries the same information the chart does, for anyone
   *  who cannot see it. Recharts renders role="application" with no name, so
   *  without this a screen reader announces an unnamed application. */
  label: string
  className?: string
  children: React.ReactNode
}

/** role="img" makes the whole subtree presentational, which is what we want:
 *  the SVG's internals are noise, and `label` carries the meaning. */
export const ChartFigure: React.FC<ChartFigureProps> = ({ label, className = '', children }) => (
  <div role="img" aria-label={label} className={className}>
    {children}
  </div>
)
