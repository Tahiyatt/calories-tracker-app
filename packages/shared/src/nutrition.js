import { NUTRIENT_KEYS } from './constants.js';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resolve a logged quantity into canonical grams.
 * 'g' and 'ml' pass through. 'serving' looks up the gram weight on the Food.
 */
export function resolveGrams({ quantity, unit, servingLabel, food }) {
  if (unit === 'g' || unit === 'ml') return quantity;

  if (unit === 'serving') {
    const serving = food?.servings?.find((s) => s.label === servingLabel);
    if (!serving) {
      throw new Error(`Food has no serving labelled "${servingLabel}"`);
    }
    return quantity * serving.grams;
  }

  throw new Error(`Unsupported unit "${unit}"`);
}

/**
 * Scale per-100g/ml nutrition to an absolute amount.
 * This is the one calculation the whole app depends on, which is exactly
 * why it lives in shared/ rather than in the server.
 */
export function scaleNutrients(per100, grams) {
  const factor = grams / 100;
  const out = {};
  for (const key of NUTRIENT_KEYS) {
    out[key] = round2((per100?.[key] ?? 0) * factor);
  }
  return out;
}

/** Add up nutrient objects — used for daily totals and meal subtotals. */
export function sumNutrients(entries) {
  const out = {};
  for (const key of NUTRIENT_KEYS) out[key] = 0;

  for (const entry of entries) {
    const n = entry?.nutrients ?? entry ?? {};
    for (const key of NUTRIENT_KEYS) out[key] = round2(out[key] + (n[key] ?? 0));
  }
  return out;
}

/**
 * The user's calendar date for an instant, as 'YYYY-MM-DD'.
 * 'en-CA' formats dates in ISO order, so no date library is needed.
 */
export function localDateFor(date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date instanceof Date ? date : new Date(date));
}

/** Percentage of a target consumed, clamped for display. Null target -> null. */
export function adherence(consumed, target) {
  if (!target) return null;
  return round2((consumed / target) * 100);
}
