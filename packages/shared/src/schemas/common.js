import { z } from 'zod';
import { NUTRIENT_KEYS } from '../constants.js';

export const objectId = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Must be a 24-character hex ObjectId');

/** 'YYYY-MM-DD'. Used anywhere a user-facing calendar day is meant. */
export const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date');

const nutrientShape = Object.fromEntries(
  NUTRIENT_KEYS.map((key) => [key, z.number().nonnegative().default(0)]),
);

export const nutrients = z.object(nutrientShape);

/** Shared date-range query for the analytics endpoints. */
export const rangeQuery = z
  .object({
    from: localDate.optional(),
    to: localDate.optional(),
    days: z.coerce.number().int().min(1).max(366).optional(),
  })
  .refine((d) => !(d.days && (d.from || d.to)), {
    message: 'Use either days, or from/to — not both',
  });
