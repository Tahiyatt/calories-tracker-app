import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { upsertWeightLogSchema, localDateFor, formatLocalDate } from '@ct/shared';
import { api } from '../api.js';
import Field from '../components/Field.jsx';

export default function Weight() {
  const [logs, setLogs] = useState([]);
  const [serverError, setServerError] = useState(null);
  const today = localDateFor(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

  const refresh = () => api.weights().then(({ weightLogs }) => setLogs(weightLogs)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(upsertWeightLogSchema),
    defaultValues: { localDate: today },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.upsertWeight(values);
      await refresh();
    } catch (err) {
      setServerError(err.message);
    }
  };

  const remove = async (localDate) => {
    await api.deleteWeight(localDate).catch(() => {});
    await refresh();
  };

  return (
    <main>
      <h1>Weight</h1>

      <section>
        <h2>Log a weigh-in</h2>
        <p className="hint">
          One reading per day. Saving again for the same date replaces it rather than
          adding a duplicate.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="quick-add">
          <Field label="Date" error={formState.errors.localDate?.message}>
            <input type="date" max={today} {...register('localDate')} />
          </Field>

          <Field label="Weight (kg)" error={formState.errors.weightKg?.message}>
            <input type="number" step="0.1" {...register('weightKg', { valueAsNumber: true })} />
          </Field>

          <Field label="Note" error={formState.errors.note?.message}>
            <input placeholder="Optional" {...register('note')} />
          </Field>

          {serverError && <p className="form-error">{serverError}</p>}

          <button type="submit" disabled={formState.isSubmitting}>Save</button>
        </form>
      </section>

      <section>
        <h2>History</h2>
        {logs.length === 0 ? (
          <p className="hint">No weigh-ins logged yet.</p>
        ) : (
          <ul className="entry-list">
            {[...logs].reverse().map((log) => (
              <li key={log._id}>
                <span className="entry-name">{formatLocalDate(log.localDate)}</span>
                <span className="entry-kcal">{log.weightKg} kg</span>
                <button className="link-button" onClick={() => remove(log.localDate)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
