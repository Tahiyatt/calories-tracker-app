import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  quickAddFoodEntrySchema,
  MEAL_TYPES,
  MACRO_KEYS,
  shiftLocalDate,
  formatLocalDate,
  localDateFor,
} from '@ct/shared';
import { useEntriesStore } from '../store/useEntriesStore.js';
import { useGoalStore } from '../store/useGoalStore.js';
import Field from '../components/Field.jsx';

// The form does not collect consumedAt — it's set at submit time — so drop it
// from the schema rather than writing a second, drifting copy.
const quickAddFormSchema = quickAddFoodEntrySchema.omit({ consumedAt: true });

export default function Today() {
  const { date, entries, totals, status, error, load, setDate, quickAdd, remove } =
    useEntriesStore();
  const { goal, load: loadGoal } = useGoalStore();

  useEffect(() => { load(); loadGoal(); }, [load, loadGoal]);

  const today = localDateFor(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(quickAddFormSchema),
    defaultValues: { mealType: 'breakfast', nutrients: {} },
  });

  const onSubmit = async (values) => {
    await quickAdd({ ...values, consumedAt: new Date().toISOString() });
    reset({ mealType: values.mealType, nutrients: {} });
  };

  return (
    <main>
      <header className="day-header">
        <button onClick={() => setDate(shiftLocalDate(date, -1))} aria-label="Previous day">
          ←
        </button>
        <h1>{date === today ? 'Today' : formatLocalDate(date)}</h1>
        <button
          onClick={() => setDate(shiftLocalDate(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          →
        </button>
      </header>

      <section>
        <h2>Totals</h2>
        <dl className="totals">
          <dt>Calories</dt>
          <dd>
            {totals.kcal}
            {goal?.targets?.kcal ? <span className="muted"> / {goal.targets.kcal}</span> : null}
          </dd>
          {MACRO_KEYS.map((key) => (
            <div key={key} className="totals-row">
              <dt>{key}</dt>
              <dd>
                {totals[key]} g
                {goal?.targets?.[key] ? (
                  <span className="muted"> / {goal.targets[key]} g</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        {!goal && (
          <p className="hint">No goal set yet — add one on the Goals page to see targets.</p>
        )}
      </section>

      <section>
        <h2>Log something</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="quick-add">
          <Field label="Food" error={formState.errors.name?.message}>
            <input placeholder="Greek yogurt" {...register('name')} />
          </Field>

          <Field label="Meal" error={formState.errors.mealType?.message}>
            <select {...register('mealType')}>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>

          <Field label="Calories" error={formState.errors.nutrients?.kcal?.message}>
            <input
              type="number"
              step="1"
              placeholder="100"
              {...register('nutrients.kcal', { valueAsNumber: true })}
            />
          </Field>

          {MACRO_KEYS.map((key) => (
            <Field
              key={key}
              label={`${key} (g)`}
              error={formState.errors.nutrients?.[key]?.message}
            >
              <input
                type="number"
                step="0.1"
                {...register(`nutrients.${key}`, { valueAsNumber: true })}
              />
            </Field>
          ))}

          <button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Adding…' : 'Add entry'}
          </button>
        </form>
        <p className="hint">
          Typing calories by hand is the Phase 1 path. Phase 2 adds food search.
        </p>
      </section>

      <section>
        <h2>Entries</h2>

        {status === 'loading' && <p>Loading…</p>}
        {status === 'error' && <p className="form-error">{error}</p>}
        {status === 'ready' && entries.length === 0 && (
          <p className="hint">Nothing logged for this day yet.</p>
        )}

        {MEAL_TYPES.map((meal) => {
          const forMeal = entries.filter((e) => e.mealType === meal);
          if (forMeal.length === 0) return null;

          return (
            <div key={meal} className="meal-group">
              <h3>{meal}</h3>
              <ul className="entry-list">
                {forMeal.map((entry) => (
                  <li key={entry._id}>
                    <span className="entry-name">{entry.name}</span>
                    <span className="entry-kcal">{entry.nutrients.kcal} kcal</span>
                    <button
                      className="link-button"
                      onClick={() => remove(entry._id)}
                      aria-label={`Delete ${entry.name}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}
