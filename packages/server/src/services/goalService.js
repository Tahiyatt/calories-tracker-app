import { shiftLocalDate } from '@ct/shared';
import { Goal } from '../models/index.js';
import { badRequest, notFound } from '../utils/httpError.js';

export function getActiveGoal(user) {
  return Goal.findOne({ userId: user._id, effectiveTo: null }).lean();
}

export function listGoals(user) {
  return Goal.find({ userId: user._id }).sort({ effectiveFrom: -1 }).lean();
}

/** The goal that was in force on a given day — what adherence must be measured against. */
export function getGoalForDate(user, localDate) {
  return Goal.findOne({
    userId: user._id,
    effectiveFrom: { $lte: localDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: localDate } }],
  }).lean();
}

/**
 * Setting a new goal closes the active one rather than overwriting it, so past
 * days stay graded against the target that was actually in force at the time.
 *
 * The close must happen before the insert: the partial unique index permits
 * only one document per user with effectiveTo: null, so inserting first would
 * be rejected. That ordering means there is a brief window with no active goal
 * if the insert then fails. A transaction would close the window, but requires
 * a replica set and adds real complexity — the tradeoff taken here is that the
 * failure is visible and recoverable by simply retrying.
 */
export async function setGoal(input, user) {
  const current = await Goal.findOne({ userId: user._id, effectiveTo: null });

  if (current) {
    if (input.effectiveFrom <= current.effectiveFrom) {
      throw badRequest(
        `New goal must start after the current one (${current.effectiveFrom})`,
      );
    }
    current.effectiveTo = shiftLocalDate(input.effectiveFrom, -1);
    await current.save();
  }

  return Goal.create({
    userId: user._id,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    targets: input.targets,
    targetWeightKg: input.targetWeightKg,
    weeklyRateKg: input.weeklyRateKg,
  });
}

export async function deleteGoal(id, user) {
  const goal = await Goal.findOne({ _id: id, userId: user._id });
  if (!goal) throw notFound('Goal not found');
  if (goal.effectiveTo !== null) {
    throw badRequest('Only the active goal can be deleted; history is append-only');
  }

  await goal.deleteOne();

  // Reopen the most recent closed goal so the user is never left with none.
  const previous = await Goal.findOne({ userId: user._id, effectiveTo: { $ne: null } })
    .sort({ effectiveFrom: -1 });

  if (previous) {
    previous.effectiveTo = null;
    await previous.save();
  }

  return { reopened: previous?._id ?? null };
}
