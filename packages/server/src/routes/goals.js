import { Router } from 'express';
import { z } from 'zod';
import { createGoalSchema, objectId } from '@ct/shared';
import { validateBody, validateParams } from '../middleware/validate.js';
import * as goals from '../controllers/goalController.js';

const router = Router();

router.get('/active', goals.active);
router.get('/', goals.history);
router.post('/', validateBody(createGoalSchema), goals.create);
router.delete('/:id', validateParams(z.object({ id: objectId })), goals.remove);

export default router;
