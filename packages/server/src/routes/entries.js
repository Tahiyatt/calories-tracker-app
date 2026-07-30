import { Router } from 'express';
import { z } from 'zod';
import {
  createFoodEntrySchema,
  quickAddFoodEntrySchema,
  updateFoodEntrySchema,
  listFoodEntriesSchema,
  objectId,
} from '@ct/shared';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import * as entries from '../controllers/foodEntryController.js';

const router = Router();
const idParam = z.object({ id: objectId });

router.get('/today', entries.today);
router.get('/', validateQuery(listFoodEntriesSchema), entries.list);
router.post('/', validateBody(createFoodEntrySchema), entries.create);
router.post('/quick', validateBody(quickAddFoodEntrySchema), entries.quickAdd);
router.patch(
  '/:id',
  validateParams(idParam),
  validateBody(updateFoodEntrySchema),
  entries.update,
);
router.delete('/:id', validateParams(idParam), entries.remove);

export default router;
