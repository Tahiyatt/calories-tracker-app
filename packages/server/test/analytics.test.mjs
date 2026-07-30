import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, clearDb, signUp, auth } from './helpers.mjs';

let request;

before(async () => { request = await startTestApp(); });
after(stopTestApp);
beforeEach(clearDb);

const targets = (kcal) => ({ kcal, protein: 150, carbs: 200, fat: 60 });

/** Log one entry on a given local date. Noon UTC keeps it unambiguous. */
const log = (token, localDate, kcal, mealType = 'lunch', extra = {}) =>
  request.post('/api/entries/quick').set(auth(token)).send({
    name: `Meal ${kcal}`,
    nutrients: { kcal, protein: 30, carbs: 40, fat: 15, ...extra },
    mealType,
    consumedAt: `${localDate}T12:00:00Z`,
  });

describe('daily series', () => {
  test('returns one row per day in range, with gaps marked unlogged', async () => {
    const { token } = await signUp(request);
    await log(token, '2026-07-28', 2000);
    await log(token, '2026-07-30', 1800);

    const res = await request
      .get('/api/analytics/series?from=2026-07-28&to=2026-07-31')
      .set(auth(token));

    assert.equal(res.status, 200);
    const { series } = res.body;
    assert.equal(series.length, 4);
    assert.deepEqual(series.map((d) => d.date), [
      '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31',
    ]);
    assert.equal(series[0].logged, true);
    assert.equal(series[1].logged, false);
    assert.equal(series[1].kcal, 0);
    assert.equal(series[2].kcal, 1800);
  });

  test('sums multiple entries within one day', async () => {
    const { token } = await signUp(request);
    await log(token, '2026-07-30', 500, 'breakfast');
    await log(token, '2026-07-30', 700, 'lunch');
    await log(token, '2026-07-30', 400, 'dinner');

    const res = await request
      .get('/api/analytics/series?from=2026-07-30&to=2026-07-30')
      .set(auth(token));

    assert.equal(res.body.series[0].kcal, 1600);
    assert.equal(res.body.series[0].entryCount, 3);
  });
});

describe('correlated $lookup: each day joined to the goal in force that day', () => {
  test('days before and after a goal change get different targets', async () => {
    const { token } = await signUp(request);

    // Two goals: 2000 from Jan, replaced by 2400 from 30 July.
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) }).expect(201);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-07-30', targets: targets(2400) }).expect(201);

    await log(token, '2026-07-28', 1900);
    await log(token, '2026-07-31', 2300);

    const res = await request
      .get('/api/analytics/series?from=2026-07-28&to=2026-07-31')
      .set(auth(token));

    const byDate = Object.fromEntries(res.body.series.map((d) => [d.date, d]));

    // This is the assertion the whole append-only goal design exists for.
    assert.equal(byDate['2026-07-28'].targetKcal, 2000, 'day under the old goal');
    assert.equal(byDate['2026-07-29'].targetKcal, 2000, 'boundary day, still old');
    assert.equal(byDate['2026-07-30'].targetKcal, 2400, 'first day of the new goal');
    assert.equal(byDate['2026-07-31'].targetKcal, 2400, 'day under the new goal');
  });

  test('days before any goal existed have no target', async () => {
    const { token } = await signUp(request);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-07-30', targets: targets(2000) });

    await log(token, '2026-07-28', 1900);

    const res = await request
      .get('/api/analytics/series?from=2026-07-28&to=2026-07-30')
      .set(auth(token));

    const early = res.body.series.find((d) => d.date === '2026-07-28');
    assert.equal(early.targetKcal, undefined);
  });

  test('one user\'s goals never leak into another user\'s series', async () => {
    const alice = await signUp(request);
    const bob = await signUp(request);

    await request.post('/api/goals').set(auth(alice.token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) });

    await log(bob.token, '2026-07-30', 1500);

    const res = await request
      .get('/api/analytics/series?from=2026-07-30&to=2026-07-30')
      .set(auth(bob.token));

    assert.equal(res.body.series[0].targetKcal, undefined);
  });
});

describe('$setWindowFields: weight trend', () => {
  test('computes a trailing average over the readings', async () => {
    const { token } = await signUp(request);
    const weights = [
      ['2026-07-25', 80.0], ['2026-07-26', 81.0], ['2026-07-27', 79.0],
      ['2026-07-28', 80.0], ['2026-07-29', 82.0],
    ];

    for (const [localDate, weightKg] of weights) {
      await request.put('/api/weights').set(auth(token)).send({ localDate, weightKg });
    }

    const res = await request
      .get('/api/analytics/weight?from=2026-07-25&to=2026-07-29')
      .set(auth(token));

    const series = res.body.weight;
    assert.equal(series.length, 5);
    assert.equal(series[0].trend, 80, 'first point averages itself');
    assert.equal(series[1].trend, 80.5, 'second averages two readings');
    assert.equal(series[4].trend, 80.4, 'fifth averages all five');
  });
});

describe('dashboard', () => {
  test('assembles series, meals, streaks and averages in one response', async () => {
    const { token } = await signUp(request);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) });

    await log(token, '2026-07-28', 600, 'breakfast');
    await log(token, '2026-07-28', 900, 'dinner');
    await log(token, '2026-07-29', 800, 'breakfast');

    const res = await request.get('/api/analytics/dashboard?days=30').set(auth(token));
    assert.equal(res.status, 200);

    const body = res.body;
    assert.ok(Array.isArray(body.series));
    assert.ok(Array.isArray(body.meals));
    assert.ok(body.streaks);
    assert.ok(body.adherence);
    assert.ok(body.macros);

    const breakfast = body.meals.find((m) => m.mealType === 'breakfast');
    assert.equal(breakfast.kcal, 1400);
    assert.equal(breakfast.entryCount, 2);

    assert.equal(body.streaks.daysLogged, 2);
  });

  test('averages divide by days logged, not days in range', async () => {
    const { token } = await signUp(request);
    // Two logged days totalling 3000 kcal, inside a 30-day window.
    await log(token, '2026-07-28', 2000);
    await log(token, '2026-07-29', 1000);

    const res = await request
      .get('/api/analytics/dashboard?from=2026-07-01&to=2026-07-30')
      .set(auth(token));

    // 3000 / 2 logged days = 1500. Dividing by 30 would give 100.
    assert.equal(res.body.averages.kcal, 1500);
  });

  test('top foods counts repeats regardless of capitalisation', async () => {
    const { token } = await signUp(request);

    for (const name of ['Porridge', 'porridge', 'PORRIDGE']) {
      await request.post('/api/entries/quick').set(auth(token)).send({
        name,
        nutrients: { kcal: 300 },
        mealType: 'breakfast',
        consumedAt: '2026-07-30T08:00:00Z',
      });
    }

    const res = await request.get('/api/analytics/dashboard?days=7').set(auth(token));
    const top = res.body.topFoods[0];
    assert.equal(top.timesLogged, 3);
    assert.equal(top.avgKcal, 300);
  });

  test('rejects days and from/to used together', async () => {
    const { token } = await signUp(request);
    const res = await request
      .get('/api/analytics/dashboard?days=7&from=2026-07-01')
      .set(auth(token));

    assert.equal(res.status, 400);
  });
});
