import { z } from 'zod';
import { localDate } from './common.js';

export const upsertWeightLogSchema = z.object({
  localDate,
  weightKg: z.number().positive().max(700),
  measuredAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

export const listWeightLogsSchema = z.object({
  from: localDate.optional(),
  to: localDate.optional(),
});
