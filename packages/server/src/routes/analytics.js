import { Router } from 'express';
import { rangeQuery } from '@ct/shared';
import { validateQuery } from '../middleware/validate.js';
import * as analytics from '../controllers/analyticsController.js';

const router = Router();

router.get('/dashboard', validateQuery(rangeQuery), analytics.dashboard);
router.get('/series', validateQuery(rangeQuery), analytics.series);
router.get('/weight', validateQuery(rangeQuery), analytics.weight);

export default router;
