// Single source of truth for enum-ish values. Imported by Zod schemas,
// Mongoose models, and the UI so they can never drift apart.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export const UNITS = ['g', 'ml', 'serving'];

export const FOOD_SOURCES = ['openfoodfacts', 'usda', 'user'];

export const NUTRITION_BASES = ['100g', '100ml'];

// Order matters for display. kcal and sodiumMg are integers; the rest are grams.
export const NUTRIENT_KEYS = [
  'kcal',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodiumMg',
];

export const MACRO_KEYS = ['protein', 'carbs', 'fat'];
