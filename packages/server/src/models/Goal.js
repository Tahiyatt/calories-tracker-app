import mongoose from 'mongoose';

/**
 * Append-only. Changing a target closes the active goal (effectiveTo = today)
 * and inserts a new one, so past days are always graded against the target
 * that was actually in force at the time.
 */
const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 'YYYY-MM-DD' strings, matching FoodEntry.localDate so adherence
    // pipelines can compare them directly.
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null },

    targets: {
      kcal: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
    },

    targetWeightKg: Number,
    weeklyRateKg: Number,
  },
  { timestamps: true },
);

goalSchema.index({ userId: 1, effectiveFrom: -1 });

// A partial unique index: MongoDB itself guarantees at most one active goal
// per user. Invariants enforced by the database are much harder to violate
// by accident than invariants enforced in application code.
goalSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { effectiveTo: null } },
);

export const Goal = mongoose.model('Goal', goalSchema);
