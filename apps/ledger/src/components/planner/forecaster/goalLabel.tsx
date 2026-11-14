import React from 'react'

interface LabelProps { viewBox?: { x?: number; y?: number } }

/** Chart label for a goal line on a phone: the goal's name on a small chip inside the plot, just under the top
 *  edge and beside the line. `flip` puts it to the left of the line, for a goal late in the forecast, so the chip
 *  never runs off the right edge. A bare 11px label above the line was clipped by the top of the plot and read
 *  as part of the line. */
export const goalChip = (text: string, flip: boolean) => {
  const Chip = ({ viewBox }: LabelProps): React.ReactElement => {
    const x = viewBox?.x ?? 0
    const y = (viewBox?.y ?? 0) + 6
    const width = text.length * 6.6 + 12
    const left = flip ? x - width - 4 : x + 4
    return (
      <g>
        <rect x={left} y={y} width={width} height={20} rx={6} fill="var(--bg-primary)" stroke="var(--accent)" strokeOpacity={0.6} />
        <text x={left + 6} y={y + 14} fill="var(--accent)" fontSize={12} fontWeight={600}>{text}</text>
      </g>
    )
  }
  return Chip
}
