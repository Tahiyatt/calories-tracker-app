import * as goals from '../services/goalService.js';

export async function active(req, res) {
  res.json({ goal: await goals.getActiveGoal(req.user) });
}

export async function history(req, res) {
  res.json({ goals: await goals.listGoals(req.user) });
}

export async function create(req, res) {
  res.status(201).json({ goal: await goals.setGoal(req.body, req.user) });
}

export async function remove(req, res) {
  res.json(await goals.deleteGoal(req.params.id, req.user));
}
