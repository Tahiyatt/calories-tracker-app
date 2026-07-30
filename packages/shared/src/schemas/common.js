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
