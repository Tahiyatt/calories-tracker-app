import { sumNutrients, localDateFor } from '@ct/shared';
import * as entries from '../services/foodEntryService.js';

export async function create(req, res) {
  const entry = await entries.createFromFood(req.body, req.user);
  res.status(201).json({ entry });
}

export async function quickAdd(req, res) {
  const entry = await entries.createFromQuickAdd(req.body, req.user);
  res.status(201).json({ entry });
}

/**
 * Returns entries plus totals. Totals are computed with sumNutrients from
 * @ct/shared — the same function the browser uses for optimistic updates, so
 * the two can never disagree about what a day adds up to.
 */
export async function list(req, res) {
  const query = req.validatedQuery ?? {};
  const found = await entries.listEntries(query, req.user);

  res.json({
    entries: found,
    totals: sumNutrients(found),
    date: query.date ?? null,
  });
}

export async function today(req, res) {
  const date = localDateFor(new Date(), req.user.profile?.timezone);
  const found = await entries.listEntries({ date }, req.user);
  res.json({ date, entries: found, totals: sumNutrients(found) });
}

export async function update(req, res) {
  const entry = await entries.updateEntry(req.params.id, req.body, req.user);
  res.json({ entry });
}

export async function remove(req, res) {
  await entries.deleteEntry(req.params.id, req.user);
  res.status(204).end();
}
