import mongoose from 'mongoose';
import { MEAL_TYPES, UNITS } from '@ct/shared';

/**
 * The diary: one immutable line per thing eaten.
 *
 * name, brand, servingLabel and nutrients are SNAPSHOTS taken at write time.
 * foodId is provenance only — never the source of the displayed numbers.
 * If an upstream correction changes a Food, historical entries must not move.
 */
const foodEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      default: null,
    },

    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },

    quantity: { type: Number, required: true },
    unit: { type: String, enum: UNITS, required: true },
    servingLabel: String,
    // The resolved canonical amount. Stored so the conversion is auditable.
    grams: { type: Number, required: true },

    nutrients: {
      kcal: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sugar: { type: Number, default: 0 },
      sodiumMg: { type: Number, default: 0 },
    },

    mealType: { type: String, enum: MEAL_TYPES, required: true },

    consumedAt: { type: Date, required: true },
    // 'YYYY-MM-DD' in the user's timezone. Redundant with consumedAt on
    // purpose: "what did I eat today" is a local-calendar question, and
    // timezone maths inside aggregation pipelines is miserable.
    localDate: { type: String, required: true },
  },
  { timestamps: true },
);

// The workhorse. Serves the day view and every dashboard date-range query.
foodEntrySchema.index({ userId: 1, localDate: 1 });

export const FoodEntry = mongoose.model('FoodEntry', foodEntrySchema);
