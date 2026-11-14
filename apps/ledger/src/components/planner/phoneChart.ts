/** Phone chart layout shared by the Planner charts: a slim value axis with compact labels
 *  keeps the plot wide instead of leaving an empty gutter on the left. */
export const PHONE_Y_AXIS = {
  width: 40,
  tick: { fill: 'var(--text-secondary)', fontSize: 11 },
  tickCount: 5,
} as const

export const PHONE_CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const
