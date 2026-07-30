/**
 * Turns a raw Open Food Facts product into one of our Food documents.
 *
 * This exists because OFF's shape is not ours and never will be. Passing raw
 * responses through would mean every consumer — the entry service, the UI, the
 * mobile app later — has to know about OFF's field names, unit quirks and
 * missing data. One translation layer here keeps that knowledge in one file,
 * and means swapping in USDA later touches only this file plus a client.
 */

const KJ_PER_KCAL = 4.184;

/** OFF stores per-100g values under keys suffixed _100g. */
const num = (value) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
};

/**
 * Calories per 100 g.
 * Prefers the explicit kcal field; falls back to converting kJ, because many
 * European products only carry energy in kilojoules.
 */
function extractKcal(nutriments) {
  const kcal = num(nutriments['energy-kcal_100g']);
  if (kcal !== null) return kcal;

  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments.energy_100g);
  if (kj !== null) return Math.round((kj / KJ_PER_KCAL) * 100) / 100;

  return null;
}

/**
 * Sodium in milligrams per 100 g.
 * OFF stores sodium and salt in GRAMS, and our schema stores sodium in mg — a
 * silent 1000x error if you copy the field across without looking. Where sodium
 * is absent, it is derived from salt using the standard 2.5 salt:sodium ratio.
 */
function extractSodiumMg(nutriments) {
  const sodiumG = num(nutriments.sodium_100g);
  if (sodiumG !== null) return Math.round(sodiumG * 1000 * 100) / 100;

  const saltG = num(nutriments.salt_100g);
  if (saltG !== null) return Math.round((saltG / 2.5) * 1000 * 100) / 100;

  return 0;
}

/**
 * Whether this product is measured by weight or volume.
 * OFF uses the _100g suffix for both, so the unit has to come from the
 * package quantity text. Drinks logged as 100 g would be subtly wrong.
 */
function extractBasis(product) {
  const text = `${product.quantity ?? ''} ${product.serving_size ?? ''}`.toLowerCase();
  return /\b(ml|cl|l|litre|liter|fl\.? ?oz)\b/.test(text) ? '100ml' : '100g';
}

/** "38 g", "1 cup (240 ml)", "2 biscuits (25g)" -> grams, or null. */
export function parseServingGrams(servingSize) {
  if (typeof servingSize !== 'string') return null;

  // Prefer a value inside parentheses: "1 cup (240 ml)" -> 240.
  const parenthesised = servingSize.match(/\(([^)]*)\)/);
  const candidates = [parenthesised?.[1], servingSize].filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/([\d]+(?:[.,]\d+)?)\s*(g|gram|grammes?|ml|mL)\b/i);
    if (match) {
      const value = Number(match[1].replace(',', '.'));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return null;
}

/** Build the servings list: the labelled portion, and the whole package. */
function extractServings(product) {
  const servings = [];

  const servingGrams =
    num(product.serving_quantity) ?? parseServingGrams(product.serving_size);

  if (servingGrams && servingGrams > 0) {
    servings.push({
      label: (product.serving_size ?? '1 serving').toString().trim().slice(0, 60),
      grams: servingGrams,
    });
  }

  const packageGrams = num(product.product_quantity);
  if (packageGrams && packageGrams > 0 && packageGrams !== servingGrams) {
    servings.push({
      label: `whole package${product.quantity ? ` (${product.quantity})` : ''}`.slice(0, 60),
      grams: packageGrams,
    });
  }

  // Always give the UI something selectable, even with no serving data at all.
  if (servings.length === 0) servings.push({ label: '100 g', grams: 100 });

  return servings;
}

const cleanBrand = (brands) =>
  typeof brands === 'string' ? brands.split(',')[0].trim().slice(0, 200) || undefined : undefined;

/**
 * Returns a Food-shaped object, or null if the product is too incomplete to be
 * useful. Rejecting is the point: OFF has millions of records where someone
 * scanned a barcode and never filled in nutrition. Storing those would fill our
 * cache with entries that look like results but cannot be logged.
 */
export function normalizeOffProduct(product) {
  if (!product || typeof product !== 'object') return null;

  const code = product.code ?? product._id;
  const name = typeof product.product_name === 'string' ? product.product_name.trim() : '';
  const nutriments = product.nutriments;

  if (!code || !name || !nutriments || typeof nutriments !== 'object') return null;

  const kcal = extractKcal(nutriments);
  if (kcal === null || kcal < 0 || kcal > 900) return null; // 900 kcal/100g ~ pure fat

  return {
    source: 'openfoodfacts',
    sourceId: String(code),
    name: name.slice(0, 200),
    brand: cleanBrand(product.brands),
    basis: extractBasis(product),
    nutrients: {
      kcal,
      protein: num(nutriments.proteins_100g) ?? 0,
      carbs: num(nutriments.carbohydrates_100g) ?? 0,
      fat: num(nutriments.fat_100g) ?? 0,
      fiber: num(nutriments.fiber_100g) ?? 0,
      sugar: num(nutriments.sugars_100g) ?? 0,
      sodiumMg: extractSodiumMg(nutriments),
    },
    servings: extractServings(product),
    fetchedAt: new Date(),
  };
}

/** Normalise a batch, silently dropping anything unusable. */
export function normalizeMany(products) {
  return products.map(normalizeOffProduct).filter(Boolean);
}
