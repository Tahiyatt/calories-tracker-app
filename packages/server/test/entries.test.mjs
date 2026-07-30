import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, stopTestApp, clearDb, signUp, auth } from './helpers.mjs';

let request;

before(async () => { request = await startTestApp(); });
after(stopTestApp);
beforeEach(clearDb);

/** A food at 59 kcal/100g with a 170 g serving — the yoghurt from the schema design. */
async function createYoghurt(token) {
  const res = await request
    .post('/api/foods')
    .set(auth(token))
    .send({
      name: 'Greek yoghurt',
      brand: 'Testco',
      basis: '100g',
      nutrients: { kcal: 59, protein: 10.3, carbs: 3.6, fat: 0.4 },
      servings: [{ label: '1 container', grams: 170 }],
    });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.food;
}

describe('quick add', () => {
  test('stores the entry and computes localDate from the user timezone', async () => {
    const { token } = await signUp(request, { profile: { timezone: 'America/New_York' } });

    const res = await request
      .post('/api/entries/quick')
      .set(auth(token))
      .send({
        name: 'Porridge',
        nutrients: { kcal: 320, protein: 12 },
        mealType: 'breakfast',
        // 03:00 UTC is still the previous evening in New York.
        consumedAt: '2026-07-30T03:00:00Z',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.entry.localDate, '2026-07-29');
    assert.equal(res.body.entry.nutrients.kcal, 320);
    assert.equal(res.body.entry.foodId, null);
  });

  test('defaults unspecified macros to zero rather than undefined', async () => {
    const { token } = await signUp(request);
    const res = await request.post('/api/entries/quick').set(auth(token)).send({
      name: 'Black coffee',
      nutrients: { kcal: 2 },
      mealType: 'breakfast',
      consumedAt: new Date().toISOString(),
    });

    assert.equal(res.body.entry.nutrients.fat, 0);
    assert.equal(res.body.entry.nutrients.sodiumMg, 0);
  });
});

describe('logging from a food', () => {
  test('resolves a serving to grams and scales nutrition', async () => {
    const { token } = await signUp(request);
    const food = await createYoghurt(token);

    const res = await request.post('/api/entries').set(auth(token)).send({
      foodId: food._id,
      quantity: 1,
      unit: 'serving',
      servingLabel: '1 container',
      mealType: 'breakfast',
      consumedAt: '2026-07-30T08:15:00Z',
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.entry.grams, 170);
    // 59 kcal/100g x 170 g
    assert.equal(res.body.entry.nutrients.kcal, 100.3);
    assert.equal(res.body.entry.nutrients.protein, 17.51);
  });

  test('rejects a serving label the food does not have', async () => {
    const { token } = await signUp(request);
    const food = await createYoghurt(token);

    const res = await request.post('/api/entries').set(auth(token)).send({
      foodId: food._id,
      quantity: 1,
      unit: 'serving',
      servingLabel: 'a bathtub',
      mealType: 'lunch',
      consumedAt: new Date().toISOString(),
    });

    assert.equal(res.status, 400);
  });
});

describe('snapshot immutability', () => {
  test('correcting a Food does not change entries already logged', async () => {
    const { token } = await signUp(request);
    const food = await createYoghurt(token);

    const created = await request.post('/api/entries').set(auth(token)).send({
      foodId: food._id,
      quantity: 1,
      unit: 'serving',
      servingLabel: '1 container',
      mealType: 'breakfast',
      consumedAt: '2026-07-30T08:15:00Z',
    });

    const originalKcal = created.body.entry.nutrients.kcal;
    assert.equal(originalKcal, 100.3);

    // Simulate an upstream correction landing on the catalog document.
    const { Food } = await import('../src/models/index.js');
    await Food.updateOne({ _id: food._id }, { $set: { 'nutrients.kcal': 51 } });

    const after = await request
      .get('/api/entries?date=2026-07-30')
      .set(auth(token));

    // This is the whole point of Phase 0's snapshot decision: history must not
    // move when somebody edits the catalog.
    assert.equal(after.body.entries[0].nutrients.kcal, originalKcal);
    assert.equal(after.body.entries[0].name, 'Greek yoghurt');
  });
});

describe('ownership', () => {
  test('one user cannot read or delete another user\'s entries', async () => {
    const alice = await signUp(request);
    const bob = await signUp(request);

    const created = await request.post('/api/entries/quick').set(auth(alice.token)).send({
      name: 'Alice lunch',
      nutrients: { kcal: 600 },
      mealType: 'lunch',
      consumedAt: '2026-07-30T12:00:00Z',
    });

    const bobsView = await request.get('/api/entries?date=2026-07-30').set(auth(bob.token));
    assert.equal(bobsView.body.entries.length, 0);

    const bobsDelete = await request
      .delete(`/api/entries/${created.body.entry._id}`)
      .set(auth(bob.token));
    assert.equal(bobsDelete.status, 404);

    // And Alice's entry survived the attempt.
    const alicesView = await request.get('/api/entries?date=2026-07-30').set(auth(alice.token));
    assert.equal(alicesView.body.entries.length, 1);
  });
});

describe('totals and deletion', () => {
  test('list returns summed totals for the day', async () => {
    const { token } = await signUp(request);

    for (const kcal of [300, 450, 200]) {
      await request.post('/api/entries/quick').set(auth(token)).send({
        name: `Item ${kcal}`,
        nutrients: { kcal, protein: 10 },
        mealType: 'lunch',
        consumedAt: '2026-07-30T12:00:00Z',
      });
    }

    const res = await request.get('/api/entries?date=2026-07-30').set(auth(token));
    assert.equal(res.body.entries.length, 3);
    assert.equal(res.body.totals.kcal, 950);
    assert.equal(res.body.totals.protein, 30);
  });

  test('delete removes the entry', async () => {
    const { token } = await signUp(request);
    const created = await request.post('/api/entries/quick').set(auth(token)).send({
      name: 'Temp',
      nutrients: { kcal: 100 },
      mealType: 'snack',
      consumedAt: '2026-07-30T15:00:00Z',
    });

    await request.delete(`/api/entries/${created.body.entry._id}`).set(auth(token)).expect(204);

    const after = await request.get('/api/entries?date=2026-07-30').set(auth(token));
    assert.equal(after.body.entries.length, 0);
  });
});
