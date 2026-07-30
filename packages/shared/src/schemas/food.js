import { z } from 'zod';
import { FOOD_SOURCES, NUTRITION_BASES } from '../constants.js';
import { nutrients } from './common.js';

export const servingSchema = z.object({
  label: z.string().trim().min(1).max(60),
  grams: z.number().positive(),
});

export const foodSchema = z.object({
  source: z.enum(FOOD_SOURCES),
  sourceId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).optional(),
  basis: z.enum(NUTRITION_BASES),
  nutrients,
  servings: z.array(servingSchema).default([]),
});

/** A food the user typed in themselves rather than pulling from an API. */
export const createUserFoodSchema = foodSchema.omit({
  source: true,
  sourceId: true,
});

export const foodSearchSchema = z.object({
  q: z.string().trim().min(2, 'Search for at least 2 characters').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Opt in to hitting Open Food Facts. Off by default: their search endpoint
  // allows 10 requests/minute per IP and the docs explicitly say not to use it
  // for search-as-you-type, so remote lookups must be a deliberate action.
  remote: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

/**
 * EAN-8 / UPC-A / EAN-13. Kept loose on purpose — Open Food Facts normalises
 * barcodes itself, and rejecting an odd-length code here would just block a
 * lookup that would have worked.
 */
export const barcodeSchema = z.object({
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'A barcode is 8 to 14 digits'),
});
