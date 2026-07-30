import mongoose from 'mongoose';

const weightLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    localDate: { type: String, required: true },
    weightKg: { type: Number, required: true },
    measuredAt: Date,
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

// One weigh-in per day: re-entering today's weight is an upsert, not a
// duplicate, so trend charts never have to pick between three Tuesdays.
weightLogSchema.index({ userId: 1, localDate: 1 }, { unique: true });

export const WeightLog = mongoose.model('WeightLog', weightLogSchema);
