import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatLocalDate } from '@ct/shared';
import ChartTooltip from './ChartTooltip.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

/**
 * Raw weigh-ins with the 7-day trailing average over the top.
 *
 * Body weight moves a kilo or more a day on water and salt alone, so the raw
 * line is mostly noise. The average is the line that answers the actual
 * question, and showing both makes clear why it is there.
 */
export default function WeightTrend({ weight }) {
  const reduced = useReducedMotion();

  if (weight.length === 0) {
    return <p className="hint">No weigh-ins in this range. Log one on the Weight page.</p>;
  }

  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weight} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(5).replace('-', '/')}
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              width={52}
            />
            <Tooltip
              content={<ChartTooltip unit=" kg" formatLabel={formatLocalDate} />}
              cursor={{ stroke: 'var(--ink)', strokeWidth: 1 }}
            />
            <Line
              type="linear"
              dataKey="weightKg"
              name="Weigh-in"
              stroke="var(--muted)"
              strokeWidth={1}
              dot={{ r: 2, fill: 'var(--muted)', strokeWidth: 0 }}
              isAnimationActive={!reduced}
            />
            <Line
              type="monotone"
              dataKey="trend"
              name="7-day average"
              stroke="var(--protein)"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={!reduced}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--muted)' }} />
          Daily weigh-in
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--protein)' }} />
          7-day average
        </span>
      </div>
    </>
  );
}
