import { resolveGrams, scaleNutrients, localDateFor, NUTRIENT_KEYS } from '@ct/shared';
import { Food, FoodEntry } from '../models/index.js';
import { badRequest, notFound } from '../utils/httpError.js';

/**
 * Build an entry from a Food document in the catalog.
 *
 * This is the function that enforces the snapshot rule: name, brand,
 * servingLabel and nutrients are copied out of the Food and frozen onto the
 * entry. foodId is kept for provenance only. A later correction to the Food
 * must never move a number the user already logged.
 */
async function buildFromFood(input, user) {
  const food = await Food.findById(input.foodId);
  if (!food) throw notFound('Food not found');

  let grams;
  try {
    grams = resolveGrams({
      quantity: input.quantity,
      unit: input.unit,
      servingLabel: input.servingLabel,
      food,
    });
  } catch (err) {
    throw badRequest(err.message);
  }

  return {
    userId: user._id,
    foodId: food._id,
    name: food.name,
    brand: food.brand,
    quantity: input.quantity,
    unit: input.unit,
    servingLabel: input.servingLabel,
    grams,
    nutrients: scaleNutrients(food.nutrients, grams),
    mealType: input.mealType,
    consumedAt: input.consumedAt,
    localDate: localDateFor(input.consumedAt, user.profile?.timezone),
  };
}

/**
 * Build an entry from numbers the user typed in. No Food exists to derive
 * from, so the supplied nutrients ARE the snapshot. foodId stays null.
 */
function buildFromQuickAdd(input, user) {
  const nutrients = {};
  for (const key of NUTRIENT_KEYS) nutrients[key] = input.nutrients[key] ?? 0;

  return {
    userId: user._id,
    foodId: null,
    name: input.name,
    brand: input.brand,
    quantity: input.grams ?? 1,
    unit: input.grams ? 'g' : 'serving',
    servingLabel: input.grams ? undefined : 'portion',
    grams: input.grams ?? 0,
    nutrients,
    mealType: input.mealType,
    consumedAt: input.consumedAt,
    localDate: localDateFor(input.consumedAt, user.profile?.timezone),
  };
}

export async function createFromFood(input, user) {
  return FoodEntry.create(await buildFromFood(input, user));
}

export async function createFromQuickAdd(input, user) {
  return FoodEntry.create(buildFromQuickAdd(input, user));
}

export async function listEntries(query, user) {
  const filter = { userId: user._id };

  if (query.date) {
    filter.localDate = query.date;
  } else if (query.from || query.to) {
    // localDate is 'YYYY-MM-DD', which sorts lexicographically the same way it
    // sorts chronologically — so plain string comparison gives a date range.
    filter.localDate = {};
    if (query.from) filter.localDate.$gte = query.from;
    if (query.to) filter.localDate.$lte = query.to;
  }

  if (query.mealType) filter.mealType = query.mealType;

  return FoodEntry.find(filter).sort({ localDate: 1, consumedAt: 1 }).lean();
}

/**
 * Update an entry the user owns.
 *
 * Changing quantity or unit re-resolves grams and re-scales nutrients from the
 * Food. That is not a violation of immutability: the user is restating what they
 * ate, so a fresh snapshot is correct. What must never happen is the numbers
 * changing without the user asking.
 */
export async function updateEntry(id, patch, user) {
  const entry = await FoodEntry.findOne({ _id: id, userId: user._id });
  if (!entry) throw notFound('Entry not found');

  if (patch.mealType) entry.mealType = patch.mealType;

  if (patch.consumedAt) {
    entry.consumedAt = patch.consumedAt;
    entry.localDate = localDateFor(patch.consumedAt, user.profile?.timezone);
  }

  const portionChanged =
    patch.quantity !== undefined ||
    patch.unit !== undefined ||
    patch.servingLabel !== undefined;

  if (portionChanged) {
    const quantity = patch.quantity ?? entry.quantity;
    const unit = patch.unit ?? entry.unit;
    const servingLabel = patch.servingLabel ?? entry.servingLabel;

    if (entry.foodId) {
      const food = await Food.findById(entry.foodId);
      if (!food) throw badRequest('Cannot resize: original food record is gone');

      let grams;
      try {
        grams = resolveGrams({ quantity, unit, servingLabel, food });
      } catch (err) {
        throw badRequest(err.message);
      }

      entry.quantity = quantity;
      entry.unit = unit;
      entry.servingLabel = servingLabel;
      entry.grams = grams;
      entry.nutrients = scaleNutrients(food.nutrients, grams);
    } else {
      // Quick-add entry: there is nothing to re-derive from, so scale the
      // frozen nutrients proportionally against the old quantity.
      const ratio = quantity / (entry.quantity || 1);
      const scaled = {};
      for (const key of NUTRIENT_KEYS) {
        scaled[key] = Math.round((entry.nutrients[key] ?? 0) * ratio * 100) / 100;
      }
      entry.quantity = quantity;
      entry.grams = entry.grams ? entry.grams * ratio : 0;
      entry.nutrients = scaled;
    }
  }

  // Explicit nutrient edits win over any derivation above.
  if (patch.nutrients) {
    for (const key of NUTRIENT_KEYS) {
      if (patch.nutrients[key] !== undefined) entry.nutrients[key] = patch.nutrients[key];
    }
  }

  await entry.save();
  return entry;
}

export async function deleteEntry(id, user) {
  const result = await FoodEntry.findOneAndDelete({ _id: id, userId: user._id });
  if (!result) throw notFound('Entry not found');
  return result;
}
