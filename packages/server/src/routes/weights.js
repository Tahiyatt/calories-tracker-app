import { Router } from 'express';
import { z } from 'zod';
import { upsertWeightLogSchema, listWeightLogsSchema, localDate } from '@ct/shared';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import * as weights from '../controllers/weightLogController.js';

const router = Router();

router.get('/', validateQuery(listWeightLogsSchema), weights.list);
router.put('/', validateBody(upsertWeightLogSchema), weights.upsert);
router.delete('/:localDate', validateParams(z.object({ localDate })), weights.remove);

export default router;
