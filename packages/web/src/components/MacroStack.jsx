import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MACRO_KEYS, KCAL_PER_GRAM, formatLocalDate } from '@ct/shared';
import ChartTooltip from './ChartTooltip.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

const COLOR = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };
const NAME = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };

/**
 * Where the calories came from, day by day.
 *
 * Stacked by calories rather than grams, because a gram of fat carries 9 kcal
 * against 4 for protein and carbs — stacking grams would make fat look like a
 * smaller part of the day than it is.
 */
export default function MacroStack({ series }) {
  const reduced = useReducedMotion();

  const data = series.map((day) => ({
    date: day.date,
    ...Object.fromEntries(
      MACRO_KEYS.map((key) => [key, Math.round((day[key] ?? 0) * KCAL_PER_GRAM[key])]),
    ),
  }));

  return (
    <>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(8)}
              tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-data)' }}
              stroke="var(--hairline)"
              width={52}
            />
            <Tooltip
              content={<ChartTooltip unit=" kcal" formatLabel={formatLocalDate} />}
              cursor={{ fill: 'var(--hairline)', fillOpacity: 0.5 }}
            />
            {MACRO_KEYS.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                name={NAME[key]}
                stackId="macros"
                fill={COLOR[key]}
                isAnimationActive={!reduced}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="legend">
        {MACRO_KEYS.map((key) => (
          <span className="legend-item" key={key}>
            <span className="legend-swatch" style={{ background: COLOR[key] }} />
            {NAME[key]}
          </span>
        ))}
      </div>
    </>
  );
}
