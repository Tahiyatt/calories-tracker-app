/**
 * Calories by meal slot.
 *
 * Plain divs rather than a chart component: four bars with one dimension is not
 * a job that needs a charting library, and the DOM version is lighter, keyboard
 * accessible and readable by a screen reader without extra work.
 */
export default function MealBars({ meals }) {
  if (meals.length === 0) {
    return <p className="hint">Log some entries and the split will appear here.</p>;
  }

  const max = Math.max(...meals.map((m) => m.kcal));

  return (
    <div>
      {meals.map((meal) => (
        <div className="meal-row" key={meal.mealType}>
          <span className="meal-name">{meal.mealType}</span>
          <span className="meal-track">
            <span className="meal-fill" style={{ width: `${(meal.kcal / max) * 100}%` }} />
          </span>
          <span className="meal-kcal">{meal.kcal}</span>
        </div>
      ))}
      <p className="hint">Total calories per meal across the range.</p>
    </div>
  );
}
