import { MACRO_KEYS } from '@ct/shared';

const MACRO_COLOR = {
  protein: 'var(--protein)',
  carbs: 'var(--carbs)',
  fat: 'var(--fat)',
};

const LABEL = { protein: 'Protein', carbs: 'Carbohydrate', fat: 'Fat' };

const pct = (value, target) => (target ? Math.round((value / target) * 100) : null);

/**
 * The signature element: today's intake rendered as a nutrition facts panel.
 *
 * The bar under each row fills toward the target the same way %DV works on a
 * printed label — full width means you hit it, and it turns red past it. Reading
 * a number against a target is the one thing this app exists to do, so this is
 * where the design spends its boldness.
 */
export default function NutritionPanel({ date, totals, targets, entryCount }) {
  const kcalPct = pct(totals.kcal, targets?.kcal);
  const kcalOver = kcalPct !== null && kcalPct > 100;

  return (
    <div className="np">
      <div className="np-head">
        <span className="np-title">Today</span>
        <span className="np-date">{date}</span>
      </div>

      <p className="np-servings">
        {entryCount === 0
          ? 'Nothing logged yet'
          : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} logged`}
      </p>

      <div className="np-kcal">
        <span className="np-kcal-label">Calories</span>
        <span>
          <span className="np-kcal-value">{Math.round(totals.kcal)}</span>
          {targets?.kcal && (
            <span className="np-kcal-target"> / {targets.kcal}</span>
          )}
        </span>
      </div>

      {targets?.kcal && (
        <div className="np-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span className="np-bar">
            <span
              className={`np-bar-fill${kcalOver ? ' is-over' : ''}`}
              style={{
                width: `${Math.min(kcalPct, 100)}%`,
                background: 'var(--ink)',
              }}
            />
          </span>
        </div>
      )}

      {MACRO_KEYS.map((key) => {
        const value = totals[key] ?? 0;
        const target = targets?.[key];
        const share = pct(value, target);
        const over = share !== null && share > 100;

        return (
          <div className="np-row" key={key}>
            <span className="np-row-name">
              <span
                className="np-row-swatch"
                style={{ background: MACRO_COLOR[key] }}
                aria-hidden="true"
              />
              {LABEL[key]}
            </span>

            <span className="np-row-amount">
              {Math.round(value)} g
              {target && <span className="muted"> / {target} g</span>}
            </span>

            <span className={`np-row-pct${over ? ' is-over' : ''}`}>
              {share === null ? '—' : `${share}%`}
            </span>

            {target && (
              <span className="np-bar">
                <span
                  className={`np-bar-fill${over ? ' is-over' : ''}`}
                  style={{
                    width: `${Math.min(share, 100)}%`,
                    background: MACRO_COLOR[key],
                  }}
                />
              </span>
            )}
          </div>
        );
      })}

      <p className="np-foot">
        {targets?.kcal
          ? 'Percentages are share of your daily target.'
          : 'Set a goal to see percentages against a target.'}
      </p>
    </div>
  );
}
