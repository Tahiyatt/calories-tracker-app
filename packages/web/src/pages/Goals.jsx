import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createGoalSchema, localDateFor, formatLocalDate } from '@ct/shared';
import { useGoalStore } from '../store/useGoalStore.js';
import { api } from '../api.js';
import Field from '../components/Field.jsx';

export default function Goals() {
  const { goal, load, save } = useGoalStore();
  const [history, setHistory] = useState([]);
  const [serverError, setServerError] = useState(null);
  const today = localDateFor(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

  const refreshHistory = () =>
    api.goalHistory().then(({ goals }) => setHistory(goals)).catch(() => {});

  useEffect(() => { load(); refreshHistory(); }, [load]);

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(createGoalSchema),
    defaultValues: { effectiveFrom: today },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await save(values);
      await refreshHistory();
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <main>
      <h1>Goals</h1>

      <section>
        <h2>Current target</h2>
        {goal ? (
          <dl className="totals">
            <dt>Calories</dt><dd>{goal.targets.kcal}</dd>
            <dt>Protein</dt><dd>{goal.targets.protein} g</dd>
            <dt>Carbs</dt><dd>{goal.targets.carbs} g</dd>
            <dt>Fat</dt><dd>{goal.targets.fat} g</dd>
            <dt>Since</dt><dd>{formatLocalDate(goal.effectiveFrom)}</dd>
          </dl>
        ) : (
          <p className="hint">No goal set yet.</p>
        )}
      </section>

      <section>
        <h2>Set a new target</h2>
        <p className="hint">
          This closes the current goal rather than overwriting it, so past days stay
          measured against the target that was actually in force.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="quick-add">
          <Field label="Starting from" error={formState.errors.effectiveFrom?.message}>
            <input type="date" {...register('effectiveFrom')} />
          </Field>

          <Field label="Calories" error={formState.errors.targets?.kcal?.message}>
            <input type="number" {...register('targets.kcal', { valueAsNumber: true })} />
          </Field>

          <Field label="Protein (g)" error={formState.errors.targets?.protein?.message}>
            <input type="number" {...register('targets.protein', { valueAsNumber: true })} />
          </Field>

          <Field label="Carbs (g)" error={formState.errors.targets?.carbs?.message}>
            <input type="number" {...register('targets.carbs', { valueAsNumber: true })} />
          </Field>

          <Field label="Fat (g)" error={formState.errors.targets?.fat?.message}>
            <input type="number" {...register('targets.fat', { valueAsNumber: true })} />
          </Field>

          {serverError && <p className="form-error">{serverError}</p>}

          <button type="submit" disabled={formState.isSubmitting}>Save goal</button>
        </form>
      </section>

      {history.length > 1 && (
        <section>
          <h2>History</h2>
          <ul className="entry-list">
            {history.map((g) => (
              <li key={g._id}>
                <span className="entry-name">
                  {formatLocalDate(g.effectiveFrom)} →{' '}
                  {g.effectiveTo ? formatLocalDate(g.effectiveTo) : 'now'}
                </span>
                <span className="entry-kcal">{g.targets.kcal} kcal</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
