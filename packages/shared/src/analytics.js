import { KCAL_PER_GRAM, MACRO_KEYS, NUTRIENT_KEYS } from './constants.js';
import { shiftLocalDate } from './dates.js';

const round1 = (n) => Math.round(n * 10) / 10;

/** Calories attributable to each macro, and their share of the total. */
export function macroSplit(nutrients) {
  const kcalFrom = {};
  for (const key of MACRO_KEYS) {
    kcalFrom[key] = round1((nutrients?.[key] ?? 0) * KCAL_PER_GRAM[key]);
  }

  const total = MACRO_KEYS.reduce((sum, key) => sum + kcalFrom[key], 0);

  const share = {};
  for (const key of MACRO_KEYS) {
    share[key] = total > 0 ? round1((kcalFrom[key] / total) * 100) : 0;
  }

  return { kcalFrom, macroKcal: round1(total), share };
}

/**
 * Fill missing days with zeroes.
 *
 * The aggregation only returns days that have entries, but a trend chart needs
 * a point for every day or the line implies you ate steadily through a gap you
 * actually skipped. This runs in application code rather than the pipeline
 * because $densify cannot operate on 'YYYY-MM-DD' strings — the same string
 * dates that make our range queries trivial. That is the tradeoff.
 */
export function fillDateGaps(series, from, to) {
  const bySeries = new Map(series.map((row) => [row.date, row]));
  const filled = [];

  for (let date = from; date <= to; date = shiftLocalDate(date, 1)) {
    const existing = bySeries.get(date);

    if (existing) {
      filled.push({ ...existing, logged: true });
    } else {
      const blank = { date, logged: false };
      for (const key of NUTRIENT_KEYS) blank[key] = 0;
      filled.push(blank);
    }
  }

  return filled;
}

/**
 * Longest and current run of consecutive logged days.
 *
 * "Current" counts backwards from the most recent day, but tolerates today
 * being empty — at 9am you have not logged breakfast yet, and telling someone
 * their 30-day streak is over because of that would be both wrong and unkind.
 */
export function computeStreaks(series) {
  let longest = 0;
  let run = 0;

  for (const day of series) {
    run = day.logged ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  let current = 0;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].logged) {
      current += 1;
    } else if (i === series.length - 1) {
      continue; // today may simply not have started yet
    } else {
      break;
    }
  }

  return { longest, current, daysLogged: series.filter((d) => d.logged).length };
}

/**
 * How a day compares to the target in force that day.
 * A day with no goal is 'untracked' rather than a failure — you cannot miss a
 * target that did not exist.
 */
export function classifyDay(day, tolerance = 0.05) {
  if (!day.logged) return 'unlogged';
  if (!day.targetKcal) return 'untracked';

  const ratio = day.kcal / day.targetKcal;
  if (ratio > 1 + tolerance) return 'over';
  if (ratio < 1 - tolerance) return 'under';
  return 'on-target';
}

/** Counts of each outcome across a range, for the adherence summary. */
export function adherenceBreakdown(series, tolerance = 0.05) {
  const counts = { 'on-target': 0, over: 0, under: 0, untracked: 0, unlogged: 0 };
  for (const day of series) counts[classifyDay(day, tolerance)] += 1;

  const tracked = counts['on-target'] + counts.over + counts.under;
  return {
    ...counts,
    tracked,
    onTargetRate: tracked > 0 ? Math.round((counts['on-target'] / tracked) * 100) : null,
  };
}

/**
 * Trailing average over a fixed number of points.
 * Body weight swings a kilo or two a day on water alone, so the raw line is
 * noise. The average is what shows whether the trend is actually moving.
 */
export function movingAverage(points, windowSize, valueKey = 'weightKg') {
  return points.map((point, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = points.slice(start, i + 1);
    const sum = window.reduce((acc, p) => acc + (p[valueKey] ?? 0), 0);
    return { ...point, trend: Math.round((sum / window.length) * 100) / 100 };
  });
}
