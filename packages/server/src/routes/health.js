import { Router } from 'express';
import { dbStatus } from '../config/db.js';

const router = Router();

router.get('/health', (req, res) => {
  const db = dbStatus();
  res.status(db === 'connected' ? 200 : 503).json({
    ok: db === 'connected',
    db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
