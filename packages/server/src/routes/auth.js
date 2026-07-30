import { Router } from 'express';
import { registerSchema, loginSchema, updateProfileSchema } from '@ct/shared';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.post('/register', validateBody(registerSchema), auth.register);
router.post('/login', validateBody(loginSchema), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);

router.post('/logout-all', requireAuth, auth.logoutAll);
router.get('/me', requireAuth, auth.me);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), auth.updateProfile);

export default router;
