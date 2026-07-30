import { useEffect } from 'react';
import { scaleNutrients, sumNutrients, localDateFor, MEAL_TYPES } from '@ct/shared';
import { useHealthStore } from './store/useHealthStore.js';

// Proof that the shared package resolves in the browser and not just on the
// server: this is the same scaleNutrients the API will use to write entries.
const YOGURT_PER_100G = { kcal: 59, protein: 10.3, carbs: 3.6, fat: 0.4 };
const oneContainer = scaleNutrients(YOGURT_PER_100G, 170);
const dailyTotal = sumNutrients([{ nutrients: oneContainer }, { nutrients: oneContainer }]);

export default function App() {
  const { status, data, error, check } = useHealthStore();

  useEffect(() => {
    check();
  }, [check]);

  return (
    <main>
      <h1>Calorie tracker</h1>
      <p className="subtitle">Phase 0 skeleton — verifying the stack is wired end to end.</p>

      <section>
        <h2>Server connection</h2>

        {status === 'loading' && <p>Checking…</p>}

        {status === 'error' && (
          <>
            <p className="bad">Cannot reach the API</p>
            <p className="hint">
              {error}. Start the server with <code>npm run dev:server</code>, or run{' '}
              <code>npm run dev</code> to start both.
            </p>
          </>
        )}

        {status === 'ok' && (
          <dl>
            <dt>API</dt>
            <dd className="ok">reachable</dd>
            <dt>Database</dt>
            <dd className={data.db === 'connected' ? 'ok' : 'bad'}>{data.db}</dd>
            <dt>Uptime</dt>
            <dd>{data.uptimeSeconds}s</dd>
          </dl>
        )}

        {status === 'ok' && data.db !== 'connected' && (
          <p className="hint">
            The API is up but Mongo is not connected. Check <code>MONGODB_URI</code> in your{' '}
            <code>.env</code>, and that your IP is allowlisted in MongoDB Atlas.
          </p>
        )}

        <p>
          <button onClick={check} disabled={status === 'loading'}>
            Check again
          </button>
        </p>
      </section>

      <section>
        <h2>Shared package</h2>
        <dl>
          <dt>Today</dt>
          <dd>{localDateFor(new Date(), 'America/New_York')}</dd>
          <dt>Meal slots</dt>
          <dd>{MEAL_TYPES.join(', ')}</dd>
          <dt>170 g yogurt</dt>
          <dd>
            {oneContainer.kcal} kcal · {oneContainer.protein} g protein
          </dd>
          <dt>Two containers</dt>
          <dd>
            {dailyTotal.kcal} kcal · {dailyTotal.protein} g protein
          </dd>
        </dl>
        <p className="hint">
          These numbers come from <code>@ct/shared</code>, the same module the server imports.
        </p>
      </section>
    </main>
  );
}
