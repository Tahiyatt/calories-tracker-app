import {
  fillDateGaps,
  computeStreaks,
  adherenceBreakdown,
  macroSplit,
  movingAverage,
  localDateFor,
  shiftLocalDate,
  NUTRIENT_KEYS,
} from '@ct/shared';
import { FoodEntry, WeightLog } from '../models/index.js';

/** Resolve a range query into concrete 'YYYY-MM-DD' bounds. */
export function resolveRange(query, user) {
  const today = localDateFor(new Date(), user.profile?.timezone);
  const to = query.to ?? today;
  const from = query.from ?? shiftLocalDate(to, -((query.days ?? 30) - 1));
  return { from, to };
}

/** Sum every nutrient in one $group stage, built from the shared key list. */
const sumNutrientStage = () =>
  Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, { $sum: `$nutrients.${key}` }]));

/**
 * Daily totals joined to whichever goal was in force that day.
 *
 * This is the pipeline the whole dashboard rests on, and the correlated $lookup
 * is the interesting part. Goals are append-only with effectiveFrom/effectiveTo
 * ranges, so "the target for this day" is a range containment question, not a
 * foreign key. Doing it in the pipeline means one round trip instead of one
 * query per day.
 *
 * It works because effectiveFrom, effectiveTo and localDate are all
 * 'YYYY-MM-DD' strings, which compare lexicographically in the same order they
 * compare chronologically. That was the reason for choosing strings back in
 * Phase 0, and this is where it pays off.
 */
export async function dailySeries({ from, to }, user) {
  const rows = await FoodEntry.aggregate([
    { $match: { userId: user._id, localDate: { $gte: from, $lte: to } } },

    { $group: { _id: '$localDate', ...sumNutrientStage(), entryCount: { $sum: 1 } } },

    {
      $lookup: {
        from: 'goals',
        let: { day: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', user._id] },
                  { $lte: ['$effectiveFrom', '$$day'] },
                  {
                    $or: [
                      { $eq: ['$effectiveTo', null] },
                      { $gte: ['$effectiveTo', '$$day'] },
                    ],
                  },
                ],
              },
            },
          },
          // The partial unique index guarantees at most one active goal, and
          // closed ranges cannot overlap, so there is only ever one match.
          { $limit: 1 },
          { $project: { _id: 0, targets: 1 } },
        ],
        as: 'goalMatch',
      },
    },

    {
      $project: {
        _id: 0,
        date: '$_id',
        entryCount: 1,
        ...Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { $round: [`$${k}`, 1] }])),
        targetKcal: { $first: '$goalMatch.targets.kcal' },
        targetProtein: { $first: '$goalMatch.targets.protein' },
        targetCarbs: { $first: '$goalMatch.targets.carbs' },
        targetFat: { $first: '$goalMatch.targets.fat' },
      },
    },

    { $sort: { date: 1 } },
  ]);

  // Gaps filled in application code: $densify cannot work on string dates.
  return fillDateGaps(rows, from, to);
}

/** Calories per meal slot across the range, for the "where do the calories go" view. */
export async function mealBreakdown({ from, to }, user) {
  const rows = await FoodEntry.aggregate([
    { $match: { userId: user._id, localDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$mealType',
        kcal: { $sum: '$nutrients.kcal' },
        entryCount: { $sum: 1 },
        days: { $addToSet: '$localDate' },
      },
    },
    {
      $project: {
        _id: 0,
        mealType: '$_id',
        kcal: { $round: ['$kcal', 0] },
        entryCount: 1,
        // Average per day the meal was actually logged, not per day in range —
        // otherwise skipping breakfast makes breakfast look small rather than absent.
        avgKcal: { $round: [{ $divide: ['$kcal', { $size: '$days' }] }, 0] },
      },
    },
    { $sort: { kcal: -1 } },
  ]);

  return rows;
}

/** Most-logged foods, so the UI can offer a "log this again" shortcut. */
export async function topFoods({ from, to }, user, limit = 8) {
  return FoodEntry.aggregate([
    { $match: { userId: user._id, localDate: { $gte: from, $lte: to } } },
    {
      $group: {
        // Group by name rather than foodId: quick-add entries have no foodId,
        // and the user thinks of "porridge" as one thing either way.
        _id: { $toLower: '$name' },
        name: { $first: '$name' },
        foodId: { $first: '$foodId' },
        timesLogged: { $sum: 1 },
        totalKcal: { $sum: '$nutrients.kcal' },
      },
    },
    { $sort: { timesLogged: -1, totalKcal: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        name: 1,
        foodId: 1,
        timesLogged: 1,
        avgKcal: { $round: [{ $divide: ['$totalKcal', '$timesLogged'] }, 0] },
      },
    },
  ]);
}

/**
 * Weight readings with a 7-day trailing average.
 *
 * $setWindowFields does the averaging in the database. It works on a count of
 * documents rather than a span of dates, which suits string dates fine, and it
 * means the smoothing logic lives in one place instead of being reimplemented
 * per client.
 */
export async function weightSeries({ from, to }, user) {
  const rows = await WeightLog.aggregate([
    { $match: { userId: user._id, localDate: { $gte: from, $lte: to } } },
    { $sort: { localDate: 1 } },
    {
      $setWindowFields: {
        partitionBy: '$userId',
        sortBy: { localDate: 1 },
        output: {
          trend: {
            $avg: '$weightKg',
            window: { documents: [-6, 0] },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$localDate',
        weightKg: 1,
        trend: { $round: ['$trend', 2] },
        note: 1,
      },
    },
  ]);

  return rows;
}

/**
 * Everything the dashboard needs, in one request.
 *
 * Five pipelines in parallel rather than five endpoints: the dashboard always
 * wants all of it at once, and five round trips on a cold connection is the
 * difference between a page that feels instant and one that visibly assembles
 * itself. The cost is a coarser endpoint that cannot be cached per-widget.
 */
export async function dashboard(query, user) {
  const range = resolveRange(query, user);

  const [series, meals, foods, weights] = await Promise.all([
    dailySeries(range, user),
    mealBreakdown(range, user),
    topFoods(range, user),
    weightSeries(range, user),
  ]);

  const loggedDays = series.filter((d) => d.logged);

  // Averages over days actually logged. Dividing by every day in the range
  // would drag the average down for every day you simply did not open the app,
  // which reads as "you ate less" rather than "you did not record".
  const totals = {};
  for (const key of NUTRIENT_KEYS) {
    totals[key] = loggedDays.reduce((sum, d) => sum + (d[key] ?? 0), 0);
  }

  const averages = {};
  for (const key of NUTRIENT_KEYS) {
    averages[key] = loggedDays.length
      ? Math.round((totals[key] / loggedDays.length) * 10) / 10
      : 0;
  }

  return {
    range,
    series,
    meals,
    topFoods: foods,
    weight: weights.length ? movingAverage(weights, 7) : [],
    averages,
    macros: macroSplit(averages),
    streaks: computeStreaks(series),
    adherence: adherenceBreakdown(series),
    currentTarget: series.at(-1)?.targetKcal ?? null,
  };
}
