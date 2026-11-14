/** Shared recharts tooltip styling: themed box AND themed text (recharts
 *  defaults item text to near-black, which is invisible on dark themes).
 *
 *  `wrapperStyle.zIndex` is what keeps a tooltip in front of anything a chart
 *  is layered under. A donut with a centred total (CompHeroWidget) renders that
 *  label as an absolutely positioned sibling AFTER the chart, so with both at
 *  the default `z-index: auto` the label won at paint time and the hovered
 *  slice's figure appeared behind it. */
export const chartTooltipStyles = {
  wrapperStyle: { zIndex: 10 },
  contentStyle: {
    backgroundColor: 'var(--dropdown-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
  },
  itemStyle: { color: 'var(--text-primary)' },
  labelStyle: { color: 'var(--text-secondary)' },
} as const

/** Theme-defined categorical chart colours, in slice order. */
const BASE_SLICE_COLORS = [
  'var(--accent)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
]

/** Each pass beyond the first mixes the base colour toward white or black, so
 *  a seventh slice reads as a lighter variant rather than an exact repeat of
 *  the first. Five passes give 30 distinct fills before any colour recurs. */
const SLICE_MIXES: ({ toward: string; keep: number } | null)[] = [
  null,
  { toward: '#ffffff', keep: 58 },
  { toward: '#000000', keep: 58 },
  { toward: '#ffffff', keep: 32 },
  { toward: '#000000', keep: 32 },
]

/** Fill for the nth slice of a pie, donut, or its legend swatch. Charts used
 *  to index the base palette with `i % 6`, which handed identical colours to
 *  slices 1 and 7 of any portfolio with more than six holdings. */
export function sliceColor(i: number): string {
  const base = BASE_SLICE_COLORS[i % BASE_SLICE_COLORS.length]
  const mix = SLICE_MIXES[Math.floor(i / BASE_SLICE_COLORS.length) % SLICE_MIXES.length]
  return mix ? `color-mix(in srgb, ${base} ${mix.keep}%, ${mix.toward})` : base
}

/** The shape Recharts hands a custom Tooltip `content` component. Recharts types
 *  this loosely, so this is the narrow subset our tooltips actually read. */
export interface ChartTooltipPayloadItem {
  dataKey?: string | number
  name?: string
  value?: number
  color?: string
}

export interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: string | number
}
