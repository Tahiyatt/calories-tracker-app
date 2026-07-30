import mongoose from 'mongoose';
import { FOOD_SOURCES, NUTRITION_BASES } from '@ct/shared';

const servingSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    grams: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * The catalog: normalised, cached facts about a food product.
 * Shared across all users. Mutable — corrections land here.
 * Nutrition is always stored per 100g / 100ml.
 */
const foodSchema = new mongoose.Schema(
  {
    source: { type: String, enum: FOOD_SOURCES, required: true },
    sourceId: { type: String, required: true },

    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },

    basis: { type: String, enum: NUTRITION_BASES, required: true },

    nutrients: {
      kcal: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sugar: { type: Number, default: 0 },
      sodiumMg: { type: Number, default: 0 },
    },

    servings: { type: [servingSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fetchedAt: Date,
  },
  { timestamps: true },
);

// Makes the cache an actual cache: one document per external product.
foodSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// Search local foods before hitting the external API.
foodSchema.index({ name: 'text', brand: 'text' });

export const Food = mongoose.model('Food', foodSchema);
