import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { formatLocalDate } from '@ct/shared';
import ChartTooltip from './ChartTooltip.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

const shortDate = (date) => date.slice(5).replace('-', '/');

/**
 * Calories per day against the target.
 *
 * Area rather than bars: the question is "is the trend drifting", which a
 * continuous shape answers better than 30 discrete columns. The dashed
 * reference line is the target, so over and under read instantly without
 * needing the axis.
 */
export default function CalorieTrend({ series, target }) {
  const reduced = useReducedMotion();

  return (
    <>
      <div className="chart chart-tall">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="kcalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--ink)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--hairline)" vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              width={52}
            />

            <Tooltip
              content={<ChartTooltip unit=" kcal" formatLabel={formatLocalDate} />}
              cursor={{ stroke: 'var(--ink)', strokeWidth: 1 }}
            />

            {target && (
              <ReferenceLine
                y={target}
                stroke="var(--over)"
                strokeDasharray="4 4"
                label={{
                  value: `target ${target}`,
                  position: 'insideTopRight',
                  fill: 'var(--over)',
                  fontSize: 10,
                  fontFamily: 'var(--font-data)',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="kcal"
              name="Calories"
              stroke="var(--ink)"
              strokeWidth={1.75}
              fill="url(#kcalFill)"
              isAnimationActive={!reduced}
              // Days with no entries are gaps, not zeroes — a line dropping to
              // the axis would claim you ate nothing rather than logged nothing.
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="hint">Days you did not log appear as gaps, not as zero.</p>
    </>
  );
}
