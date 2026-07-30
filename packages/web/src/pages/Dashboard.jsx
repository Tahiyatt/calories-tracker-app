import { useEffect } from 'react';
import { RANGE_PRESETS, MACRO_KEYS, localDateFor, formatLocalDate } from '@ct/shared';
import { useDashboardStore } from '../store/useDashboardStore.js';
import NutritionPanel from '../components/NutritionPanel.jsx';
import CalorieTrend from '../components/CalorieTrend.jsx';
import MacroStack from '../components/MacroStack.jsx';
import WeightTrend from '../components/WeightTrend.jsx';
import MealBars from '../components/MealBars.jsx';
import StreakStats from '../components/StreakStats.jsx';
import TopFoods from '../components/TopFoods.jsx';

const MACRO_COLOR = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' };

export default function Dashboard() {
  const { days, data, status, error, load, setDays } = useDashboardStore();

  useEffect(() => { load(); }, [load]);

  if (status === 'loading' && !data) return <p className="centered">Loading your numbers…</p>;

  if (status === 'error' && !data) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="form-error">{error}</p>
        <p className="hint">Check the server is running, then reload.</p>
      </main>
    );
  }

  if (!data) return null;

  const today = localDateFor(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const todayRow = data.series.find((d) => d.date === today) ?? data.series.at(-1);
  const hasAnyData = data.streaks.daysLogged > 0;

  const targets = todayRow?.targetKcal
    ? {
        kcal: todayRow.targetKcal,
        protein: todayRow.targetProtein,
        carbs: todayRow.targetCarbs,
        fat: todayRow.targetFat,
      }
    : null;

  return (
    <main>
      <div className="day-header">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {formatLocalDate(data.range.from)} — {formatLocalDate(data.range.to)}
          </p>
        </div>
        <div className="range-picker">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              className={days === preset ? 'active' : ''}
              onClick={() => setDays(preset)}
            >
              {preset}D
            </button>
          ))}
        </div>
      </div>

      <section>
        <NutritionPanel
          date={formatLocalDate(todayRow?.date ?? today)}
          totals={todayRow ?? { kcal: 0 }}
          targets={targets}
          entryCount={todayRow?.entryCount ?? 0}
        />
      </section>

      {!hasAnyData ? (
        <section className="card">
          <h2>Nothing to chart yet</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Log a few days of meals and the trends will fill in here. Start on the Today page.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2>At a glance</h2>
            <StreakStats
              streaks={data.streaks}
              adherence={data.adherence}
              averages={data.averages}
              rangeDays={data.series.length}
            />
          </section>

          <section>
            <h2>Calories per day</h2>
            <CalorieTrend series={data.series} target={data.currentTarget} />
          </section>

          <section>
            <h2>Calories by macro</h2>
            <MacroStack series={data.series} />
            <div className="legend" style={{ marginTop: '0.75rem' }}>
              {MACRO_KEYS.map((key) => (
                <span className="legend-item" key={key}>
                  <span className="legend-swatch" style={{ background: MACRO_COLOR[key] }} />
                  {data.macros.share[key]}% of average day
                </span>
              ))}
            </div>
          </section>

          <div className="two-up">
            <section>
              <h2>By meal</h2>
              <MealBars meals={data.meals} />
            </section>

            <section>
              <h2>Logged most often</h2>
              <TopFoods foods={data.topFoods} />
            </section>
          </div>

          <section>
            <h2>Weight</h2>
            <WeightTrend weight={data.weight} />
          </section>
        </>
      )}
    </main>
  );
}
