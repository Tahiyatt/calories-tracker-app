import { z } from 'zod';
import { localDate } from './common.js';

export const targetsSchema = z.object({
  kcal: z.number().positive().max(20000),
  protein: z.number().nonnegative().max(1000),
  carbs: z.number().nonnegative().max(2000),
  fat: z.number().nonnegative().max(1000),
});

/**
 * Creating a goal closes the currently active one server-side.
 * effectiveTo is never client-supplied.
 */
export const createGoalSchema = z.object({
  effectiveFrom: localDate,
  targets: targetsSchema,
  targetWeightKg: z.number().positive().max(700).optional(),
  weeklyRateKg: z.number().min(-2).max(2).optional(),
});
