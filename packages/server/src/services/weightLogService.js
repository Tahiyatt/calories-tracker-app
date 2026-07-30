import { WeightLog } from '../models/index.js';
import { notFound } from '../utils/httpError.js';

/**
 * One weigh-in per day, enforced by a unique index on (userId, localDate).
 * Re-entering today's weight is therefore an upsert, not a duplicate, so trend
 * charts never have to choose between three readings from the same Tuesday.
 */
export function upsertWeight(input, user) {
  return WeightLog.findOneAndUpdate(
    { userId: user._id, localDate: input.localDate },
    {
      $set: {
        weightKg: input.weightKg,
        measuredAt: input.measuredAt ?? new Date(),
        note: input.note,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export function listWeights(query, user) {
  const filter = { userId: user._id };

  if (query.from || query.to) {
    filter.localDate = {};
    if (query.from) filter.localDate.$gte = query.from;
    if (query.to) filter.localDate.$lte = query.to;
  }

  return WeightLog.find(filter).sort({ localDate: 1 }).lean();
}

export async function deleteWeight(localDate, user) {
  const result = await WeightLog.findOneAndDelete({ userId: user._id, localDate });
  if (!result) throw notFound('No weight logged for that date');
  return result;
}
