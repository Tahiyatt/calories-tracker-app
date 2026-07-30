import { z } from 'zod';
import { MEAL_TYPES, UNITS } from '../constants.js';
import { objectId, localDate } from './common.js';

/**
 * What a client is allowed to send when logging food.
 *
 * Deliberately excludes grams, nutrients, and localDate: the server derives
 * those from the Food document and the user's timezone. A client that could
 * declare its own calorie totals would make every number in the app unfalsifiable.
 */
export const createFoodEntrySchema = z
  .object({
    foodId: objectId.nullish(),
    name: z.string().trim().min(1).max(200),
    brand: z.string().trim().max(200).optional(),
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

export const updateFoodEntrySchema = z.object({
  quantity: z.number().positive().max(100000).optional(),
  unit: z.enum(UNITS).optional(),
  servingLabel: z.string().trim().max(60).optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  consumedAt: z.coerce.date().optional(),
});

export const listFoodEntriesSchema = z.object({
  from: localDate.optional(),
  to: localDate.optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
});
