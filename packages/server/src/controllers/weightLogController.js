import * as weights from '../services/weightLogService.js';

export async function upsert(req, res) {
  res.status(200).json({ weightLog: await weights.upsertWeight(req.body, req.user) });
}

export async function list(req, res) {
  res.json({ weightLogs: await weights.listWeights(req.validatedQuery ?? {}, req.user) });
}

export async function remove(req, res) {
  await weights.deleteWeight(req.params.localDate, req.user);
  res.status(204).end();
}
