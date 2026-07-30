import { useState } from 'react';
import { scaleNutrients, MEAL_TYPES } from '@ct/shared';

/**
 * Choose a portion for a picked food, with a live nutrition preview.
 *
 * The preview calls scaleNutrients from @ct/shared — the same function the
 * server uses when it writes the entry. So what the user sees before confirming
 * is exactly what gets stored, with no second implementation to drift.
 */
export default function ServingPicker({ food, defaultMealType = 'breakfast', onAdd, onCancel }) {
  const hasServings = food.servings?.length > 0;

  const [unit, setUnit] = useState(hasServings ? 'serving' : 'g');
  const [servingLabel, setServingLabel] = useState(food.servings?.[0]?.label ?? '');
  const [quantity, setQuantity] = useState(1);
  const [mealType, setMealType] = useState(defaultMealType);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const massUnit = food.basis === '100ml' ? 'ml' : 'g';

  const chosenServing = food.servings?.find((s) => s.label === servingLabel);
  const grams =
    unit === 'serving' ? (chosenServing?.grams ?? 0) * quantity : Number(quantity) || 0;

  const preview = scaleNutrients(food.nutrients, grams);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await onAdd({
        foodId: food._id,
        quantity: Number(quantity),
        unit: unit === 'serving' ? 'serving' : massUnit,
        ...(unit === 'serving' ? { servingLabel } : {}),
        mealType,
        consumedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="serving-picker">
      <h3>
        {food.name}
        {food.brand && <span className="muted"> · {food.brand}</span>}
      </h3>

      <div className="picker-grid">
        <label className="field">
          <span className="field-label">Amount</span>
          <input
            type="number"
            min="0"
            step={unit === 'serving' ? '0.25' : '1'}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Measured in</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={!hasServings}
          >
            {hasServings && <option value="serving">servings</option>}
            <option value="mass">{massUnit}</option>
          </select>
        </label>

        {unit === 'serving' && (
          <label className="field wide">
            <span className="field-label">Serving</span>
            <select value={servingLabel} onChange={(e) => setServingLabel(e.target.value)}>
              {food.servings.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} ({s.grams} {massUnit})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span className="field-label">Meal</span>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <dl className="totals preview">
        <dt>That&apos;s</dt>
        <dd>
          {grams} {massUnit} · {preview.kcal} kcal
        </dd>
        <dt>Macros</dt>
        <dd>
          {preview.protein}p / {preview.carbs}c / {preview.fat}f
        </dd>
      </dl>

      {error && <p className="form-error">{error}</p>}

      <div className="picker-actions">
        <button type="button" onClick={submit} disabled={saving || grams <= 0}>
          {saving ? 'Adding…' : 'Add to log'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
