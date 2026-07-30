import * as analytics from '../services/analyticsService.js';

export async function dashboard(req, res) {
  res.json(await analytics.dashboard(req.validatedQuery ?? {}, req.user));
}

export async function series(req, res) {
  const range = analytics.resolveRange(req.validatedQuery ?? {}, req.user);
  res.json({ range, series: await analytics.dailySeries(range, req.user) });
}

export async function weight(req, res) {
  const range = analytics.resolveRange(req.validatedQuery ?? {}, req.user);
  res.json({ range, weight: await analytics.weightSeries(range, req.user) });
}
