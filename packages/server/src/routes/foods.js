import { Router } from 'express';
import { foodSearchSchema, barcodeSchema, createUserFoodSchema } from '@ct/shared';
import { validateQuery, validateParams, validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as food from '../controllers/foodController.js';

const router = Router();

// Generous, because local-only searches never leave our database.
const searchLimit = rateLimit({ capacity: 30, refillPerMinute: 60, key: 'food-search' });

// Tight, because each of these can consume one of Open Food Facts' 15/min
// product reads, shared across every user of this deployment.
const barcodeLimit = rateLimit({ capacity: 5, refillPerMinute: 10, key: 'food-barcode' });

router.get('/search', searchLimit, validateQuery(foodSearchSchema), food.search);
router.get('/barcode/:barcode', barcodeLimit, validateParams(barcodeSchema), food.byBarcode);
router.post('/', validateBody(createUserFoodSchema), food.createUserFood);

export default router;
