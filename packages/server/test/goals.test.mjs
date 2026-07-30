import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, clearDb, signUp, auth } from './helpers.mjs';

let request;

before(async () => { request = await startTestApp(); });
after(stopTestApp);
beforeEach(clearDb);

const targets = (kcal) => ({ kcal, protein: 150, carbs: 200, fat: 60 });

describe('goal versioning', () => {
  test('a new goal closes the previous one instead of overwriting it', async () => {
    const { token } = await signUp(request);

    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) }).expect(201);

    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-03-01', targets: targets(2400) }).expect(201);

    const history = await request.get('/api/goals').set(auth(token));
    assert.equal(history.body.goals.length, 2, 'the old goal must still exist');

    const [current, previous] = history.body.goals; // sorted effectiveFrom desc
    assert.equal(current.effectiveTo, null);
    assert.equal(current.targets.kcal, 2400);

    // Closed the day before the new one starts — no gap, no overlap.
    assert.equal(previous.effectiveTo, '2026-02-28');
    assert.equal(previous.targets.kcal, 2000);
  });

  test('only one goal is ever active', async () => {
    const { token } = await signUp(request);

    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) });
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-03-01', targets: targets(2400) });

    const { Goal } = await import('../src/models/index.js');
    const active = await Goal.countDocuments({ effectiveTo: null });
    assert.equal(active, 1);
  });

  test('the partial unique index rejects a second active goal at the database level', async () => {
    const { token, user } = await signUp(request);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2000) });

    const { Goal } = await import('../src/models/index.js');
    await Goal.syncIndexes();

    // Bypass the service entirely — the guarantee should come from MongoDB.
    await assert.rejects(
      () => Goal.create({
        userId: user.id,
        effectiveFrom: '2026-06-01',
        effectiveTo: null,
        targets: targets(1800),
      }),
      (err) => err.code === 11000,
      'expected a duplicate key error from the partial unique index',
    );
  });

  test('a goal cannot start before the current one', async () => {
    const { token } = await signUp(request);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-03-01', targets: targets(2000) });

    const res = await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2400) });

    assert.equal(res.status, 400);
  });

  test('active returns the current goal', async () => {
    const { token } = await signUp(request);
    await request.post('/api/goals').set(auth(token))
      .send({ effectiveFrom: '2026-01-01', targets: targets(2200) });

    const res = await request.get('/api/goals/active').set(auth(token));
    assert.equal(res.body.goal.targets.kcal, 2200);
  });
});

describe('weight logs', () => {
  test('re-saving the same date upserts rather than duplicating', async () => {
    const { token } = await signUp(request);

    await request.put('/api/weights').set(auth(token))
      .send({ localDate: '2026-07-30', weightKg: 80.5 }).expect(200);
    await request.put('/api/weights').set(auth(token))
      .send({ localDate: '2026-07-30', weightKg: 80.1 }).expect(200);

    const res = await request.get('/api/weights').set(auth(token));
    assert.equal(res.body.weightLogs.length, 1);
    assert.equal(res.body.weightLogs[0].weightKg, 80.1);
  });
});
