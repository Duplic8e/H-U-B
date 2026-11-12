import { shortDate } from './kit';

/** Line chart with a soft area fill. `label` describes it for screen readers. */
export function LineChart({ values, dates, unit, label }: { values: number[]; dates: string[]; unit: string; label: string }) {
  if (values.length < 2) return <p class="muted small">The chart appears after two sessions.</p>;
  const W = 320, H = 160, P = 24;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (values.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const change = values[values.length - 1]! - values[0]!;
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: from ${Math.round(values[0]!)} to ${Math.round(values[values.length - 1]!)} ${unit} over ${values.length} sessions`}>
      <path class="area" d={area} />
      <path class="line" d={line} />
      {values.map((v, i) => <circle key={i} class="dot" cx={x(i)} cy={y(v)} r={values.length > 24 ? 1.5 : 3} />)}
      <text x={P} y={14}>{Math.round(max).toLocaleString()} {unit}</text>
      <text x={W - P} y={14} text-anchor="end" class={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : '−'}{Math.abs(Math.round(change)).toLocaleString()} {unit}</text>
      <text x={P} y={H - 6}>{shortDate(dates[0]!)}</text>
      <text x={W - P} y={H - 6} text-anchor="end">{shortDate(dates[dates.length - 1]!)}</text>
    </svg>
  );
}

/** Vertical bars, one per period, the latest highlighted. */
export function BarChart({ bars, label, format = (n: number) => String(Math.round(n)) }: { bars: Array<{ key: string; value: number; tick?: string }>; label: string; format?: (n: number) => string }) {
  const W = 320, H = 150, P = 22;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = (W - 2 * P) / bars.length;
  const bw = Math.min(22, slot * 0.62);
  return (
    <svg class="chart bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${bars.map((b) => format(b.value)).join(', ')}`}>
      <text x={P} y={12}>{format(max)}</text>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} class="axis" />
      {bars.map((b, i) => {
        const h = (b.value / max) * (H - 2 * P - 6);
        const cx = P + slot * i + slot / 2;
        return (
          <g key={b.key}>
            <rect class={i === bars.length - 1 ? 'bar now' : 'bar'} x={cx - bw / 2} y={H - P - Math.max(h, b.value > 0 ? 3 : 0)} width={bw} height={Math.max(h, b.value > 0 ? 3 : 0)} rx={4} />
            {b.tick && <text x={cx} y={H - 6} text-anchor="middle">{b.tick}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars for a ranked breakdown. */
export function RankBars({ rows, unit }: { rows: Array<{ name: string; value: number }>; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul class="rank">
      {rows.map((r) => (
        <li key={r.name}>
          <span class="rank-name">{r.name}</span>
          <span class="rank-track" aria-hidden="true"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span class="rank-value">{r.value} {unit}</span>
        </li>
      ))}
    </ul>
  );
}
