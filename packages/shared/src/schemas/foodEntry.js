import { z } from 'zod';
import { MEAL_TYPES, UNITS, NUTRIENT_KEYS } from '../constants.js';
import { objectId, localDate } from './common.js';

/**
 * Log an entry from a Food document in the catalog.
 *
 * Excludes grams, nutrients and localDate: the server derives those from the
 * Food and the user's timezone. A client that could declare its own calorie
 * totals would make every number in the app unfalsifiable.
 */
export const createFoodEntrySchema = z
  .object({
    foodId: objectId,
    quantity: z.number().positive().max(100000),
    unit: z.enum(UNITS),
    servingLabel: z.string().trim().max(60).optional(),
    mealType: z.enum(MEAL_TYPES),
    consumedAt: z.coerce.date(),
  })
  .refine((data) => data.unit !== 'serving' || Boolean(data.servingLabel), {
    message: 'servingLabel is required when unit is "serving"',
    path: ['servingLabel'],
  });

/**
 * Quick-add: the user types the numbers in by hand. This is the only logging
 * path available until Phase 2 populates the Food catalog from an external API.
 *
 * Nutrients ARE client-supplied here, and that is not a contradiction of the
 * rule above — there is no upstream source to derive them from. The user is the
 * source. Totals are absolute (for the whole portion), not per 100 g.
 */
export const quickAddFoodEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).optional(),
  grams: z.number().positive().max(100000).optional(),
  nutrients: z.object({
    kcal: z.number().nonnegative().max(30000),
    protein: z.number().nonnegative().max(5000).default(0),
    carbs: z.number().nonnegative().max(5000).default(0),
    fat: z.number().nonnegative().max(5000).default(0),
    fiber: z.number().nonnegative().max(5000).default(0),
    sugar: z.number().nonnegative().max(5000).default(0),
    sodiumMg: z.number().nonnegative().max(500000).default(0),
  }),
  mealType: z.enum(MEAL_TYPES),
  consumedAt: z.coerce.date(),
});

export const updateFoodEntrySchema = z
  .object({
    quantity: z.number().positive().max(100000).optional(),
    unit: z.enum(UNITS).optional(),
    servingLabel: z.string().trim().max(60).optional(),
    mealType: z.enum(MEAL_TYPES).optional(),
    consumedAt: z.coerce.date().optional(),
    nutrients: z
      .object(
        Object.fromEntries(
          NUTRIENT_KEYS.map((k) => [k, z.number().nonnegative().optional()]),
        ),
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listFoodEntriesSchema = z
  .object({
    date: localDate.optional(),
    from: localDate.optional(),
    to: localDate.optional(),
    mealType: z.enum(MEAL_TYPES).optional(),
  })
  .refine((d) => !(d.date && (d.from || d.to)), {
    message: 'Use either date, or from/to — not both',
  });
